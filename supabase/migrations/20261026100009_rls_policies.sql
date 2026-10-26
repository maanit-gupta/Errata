-- RLS for every table (SPEC §2). Helpers come from the previous migration.

-- Extra helpers that need the full schema.
create or replace function public.version_org(p_version_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.org_id from public.versions v join public.contents c on c.id = v.content_id
  where v.id = p_version_id;
$$;

-- Owner (or brand admin) may save versions / upload drafts while the content is editable.
create or replace function public.can_edit_content(p_content_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.contents c
    where c.id = p_content_id
      and c.state in ('draft', 'needs_revision')
      and public.is_org_member(c.org_id)
      and (c.owner_id = (select auth.uid())
           or public.has_org_role(c.org_id, array['brand_admin']::public.member_role[]))
  );
$$;

-- Who may resolve findings / override on a version (SPEC §2 footnote ²): the owner and admins
-- always; managers while it is in_review; specialists while it is routed to their kind.
create or replace function public.can_act_on_version(p_version_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.versions v
    join public.contents c on c.id = v.content_id
    join public.memberships m on m.org_id = c.org_id and m.user_id = (select auth.uid())
    where v.id = p_version_id
      and (c.owner_id = m.user_id
           or m.role = 'brand_admin'
           or (m.role = 'manager' and c.state = 'in_review')
           or (m.role = 'specialist' and c.state = 'specialist_review'
               and c.route_to = m.specialist_kind::text))
  );
$$;

revoke execute on function public.version_org(uuid) from public, anon;
revoke execute on function public.can_edit_content(uuid) from public, anon;
revoke execute on function public.can_act_on_version(uuid) from public, anon;
grant execute on function public.version_org(uuid) to authenticated, service_role;
grant execute on function public.can_edit_content(uuid) to authenticated, service_role;
grant execute on function public.can_act_on_version(uuid) to authenticated, service_role;

-- anon never touches app tables.
revoke all on all tables in schema public from anon;

alter table public.profiles enable row level security;
alter table public.organisations enable row level security;
alter table public.memberships enable row level security;
alter table public.campaigns enable row level security;
alter table public.brand_guides enable row level security;
alter table public.rule_cards enable row level security;
alter table public.facts enable row level security;
alter table public.glossary_terms enable row level security;
alter table public.assets enable row level security;
alter table public.contents enable row level security;
alter table public.versions enable row level security;
alter table public.review_runs enable row level security;
alter table public.findings enable row level security;
alter table public.decisions enable row level security;
alter table public.comments enable row level security;
alter table public.audit_events enable row level security;
alter table public.example_suggestions enable row level security;

-- profiles: yourself, plus anyone you share an org with (display names in the UI).
create policy profiles_select on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or exists (select 1 from public.memberships m where m.user_id = profiles.id and public.is_org_member(m.org_id))
  );
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- organisations
create policy organisations_select on public.organisations for select to authenticated
  using (public.is_org_member(id));
create policy organisations_update on public.organisations for update to authenticated
  using (public.has_org_role(id, array['brand_admin']::public.member_role[]))
  with check (public.has_org_role(id, array['brand_admin']::public.member_role[]));

-- memberships
create policy memberships_select on public.memberships for select to authenticated
  using (public.is_org_member(org_id));
create policy memberships_admin_write on public.memberships for all to authenticated
  using (public.has_org_role(org_id, array['brand_admin']::public.member_role[]))
  with check (public.has_org_role(org_id, array['brand_admin']::public.member_role[]));

-- campaigns
create policy campaigns_select on public.campaigns for select to authenticated
  using (public.is_org_member(org_id));
create policy campaigns_write on public.campaigns for all to authenticated
  using (public.has_org_role(org_id, array['manager', 'brand_admin']::public.member_role[]))
  with check (public.has_org_role(org_id, array['manager', 'brand_admin']::public.member_role[]));

-- Vault: admins write; the internal team reads guides and full rule cards; every member reads
-- facts, glossary and assets. Agencies read rules only through rule_cards_public.
create policy brand_guides_select on public.brand_guides for select to authenticated
  using (public.is_org_staff(org_id));
create policy brand_guides_admin_write on public.brand_guides for all to authenticated
  using (public.has_org_role(org_id, array['brand_admin']::public.member_role[]))
  with check (public.has_org_role(org_id, array['brand_admin']::public.member_role[]));

create policy rule_cards_select on public.rule_cards for select to authenticated
  using (public.is_org_staff(org_id));
create policy rule_cards_admin_write on public.rule_cards for all to authenticated
  using (public.has_org_role(org_id, array['brand_admin']::public.member_role[]))
  with check (public.has_org_role(org_id, array['brand_admin']::public.member_role[]));

create policy facts_select on public.facts for select to authenticated
  using (public.is_org_member(org_id));
create policy facts_admin_write on public.facts for all to authenticated
  using (public.has_org_role(org_id, array['brand_admin']::public.member_role[]))
  with check (public.has_org_role(org_id, array['brand_admin']::public.member_role[]));

create policy glossary_terms_select on public.glossary_terms for select to authenticated
  using (public.is_org_member(org_id));
create policy glossary_terms_admin_write on public.glossary_terms for all to authenticated
  using (public.has_org_role(org_id, array['brand_admin']::public.member_role[]))
  with check (public.has_org_role(org_id, array['brand_admin']::public.member_role[]));

create policy assets_select on public.assets for select to authenticated
  using (public.is_org_member(org_id));
create policy assets_admin_write on public.assets for all to authenticated
  using (public.has_org_role(org_id, array['brand_admin']::public.member_role[]))
  with check (public.has_org_role(org_id, array['brand_admin']::public.member_role[]));

-- SPEC §2 ¹: agencies see a rule's summary, never body or source_page. This view runs as its
-- owner (bypassing rule_cards RLS) and re-applies org membership itself.
create view public.rule_cards_public
with (security_barrier = true)
as
select r.id, r.org_id, r.code, r.dimension, r.title, r.summary, r.severity, r.status, r.version,
       r.created_at, r.updated_at
from public.rule_cards r
where r.status = 'approved' and public.is_org_member(r.org_id);

revoke all on public.rule_cards_public from anon;
grant select on public.rule_cards_public to authenticated;

-- contents: state/routing columns are guarded by a trigger (next migration).
create policy contents_select on public.contents for select to authenticated
  using (
    public.is_org_staff(org_id)
    or (owner_id = (select auth.uid()) and public.is_org_member(org_id))
  );
create policy contents_insert on public.contents for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and state = 'draft'
    and public.has_org_role(org_id, array['agency_creator', 'creator', 'manager', 'brand_admin']::public.member_role[])
  );
create policy contents_update on public.contents for update to authenticated
  using (
    public.is_org_member(org_id)
    and (owner_id = (select auth.uid())
         or public.has_org_role(org_id, array['manager', 'brand_admin']::public.member_role[]))
  )
  with check (public.is_org_member(org_id));

-- versions: immutable; inserted by whoever may edit the content.
create policy versions_select on public.versions for select to authenticated
  using (public.can_read_content(content_id));
create policy versions_insert on public.versions for insert to authenticated
  with check (public.can_edit_content(content_id) and created_by = (select auth.uid()));
revoke update, delete, truncate on public.versions from authenticated;

-- review_runs: read-only for users; enqueue_review() inserts, the worker (service role) updates.
create policy review_runs_select on public.review_runs for select to authenticated
  using (public.is_org_member(org_id) and public.can_read_version(version_id));
revoke insert, update, delete, truncate on public.review_runs from authenticated;

-- findings: written by the worker; users may only change resolution columns.
create policy findings_select on public.findings for select to authenticated
  using (public.is_org_member(org_id) and public.can_read_version(version_id));
create policy findings_update on public.findings for update to authenticated
  using (public.is_org_member(org_id) and public.can_act_on_version(version_id))
  with check (public.is_org_member(org_id) and public.can_act_on_version(version_id));
revoke insert, update, delete, truncate on public.findings from authenticated;
grant update (status, dismiss_reason, dismiss_note) on public.findings to authenticated;

-- decisions: transition functions write approve/sign_off/...; reviewers insert overrides.
create policy decisions_select on public.decisions for select to authenticated
  using (public.is_org_member(org_id) and public.can_read_version(version_id));
create policy decisions_insert_override on public.decisions for insert to authenticated
  with check (
    action = 'override'
    and actor_id = (select auth.uid())
    and org_id = public.version_org(version_id)
    and public.has_org_role(org_id, array['manager', 'specialist', 'brand_admin']::public.member_role[])
    and public.can_act_on_version(version_id)
    and exists (
      select 1 from public.findings f
      where f.id = decisions.finding_id and f.version_id = decisions.version_id
    )
  );

revoke update, delete, truncate on public.decisions from authenticated;

-- comments: anyone who can read the version may comment; authors may delete their own.
create policy comments_select on public.comments for select to authenticated
  using (public.is_org_member(org_id) and public.can_read_version(version_id));
create policy comments_insert on public.comments for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and org_id = public.version_org(version_id)
    and public.can_read_version(version_id)
  );
create policy comments_delete on public.comments for delete to authenticated
  using (author_id = (select auth.uid()));

-- audit_events: readable by managers, specialists and admins; written only by definer functions.
create policy audit_events_select on public.audit_events for select to authenticated
  using (public.has_org_role(org_id, array['manager', 'specialist', 'brand_admin']::public.member_role[]));
revoke insert, update, delete, truncate on public.audit_events from authenticated;

-- example_suggestions: brand admins review generated examples.
create policy example_suggestions_select on public.example_suggestions for select to authenticated
  using (public.has_org_role(org_id, array['manager', 'brand_admin']::public.member_role[]));
create policy example_suggestions_update on public.example_suggestions for update to authenticated
  using (public.has_org_role(org_id, array['brand_admin']::public.member_role[]))
  with check (public.has_org_role(org_id, array['brand_admin']::public.member_role[]));
