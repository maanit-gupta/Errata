-- Private buckets (SPEC §3). The first path segment is the org id; drafts and renders carry the
-- content id as the second segment: drafts/{org}/{content}/{n}/..., renders/{org}/{content}/...
insert into storage.buckets (id, name, public)
values ('guides', 'guides', false),
       ('assets', 'assets', false),
       ('drafts', 'drafts', false),
       ('renders', 'renders', false)
on conflict (id) do nothing;

-- True when segment 2 is a content in the org named by segment 1.
create or replace function public.storage_content_in_org(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.contents c
    where c.id = public.storage_path_uuid(p_name, 2)
      and c.org_id = public.storage_path_uuid(p_name, 1)
  );
$$;
revoke execute on function public.storage_content_in_org(text) from public, anon;
grant execute on function public.storage_content_in_org(text) to authenticated, service_role;

create policy "guides: staff read" on storage.objects for select to authenticated
  using (bucket_id = 'guides' and public.is_org_staff(public.storage_path_uuid(name, 1)));
create policy "assets: members read" on storage.objects for select to authenticated
  using (bucket_id = 'assets' and public.is_org_member(public.storage_path_uuid(name, 1)));

create policy "vault buckets: admin insert" on storage.objects for insert to authenticated
  with check (
    bucket_id in ('guides', 'assets')
    and public.has_org_role(public.storage_path_uuid(name, 1), array['brand_admin']::public.member_role[])
  );
create policy "vault buckets: admin update" on storage.objects for update to authenticated
  using (
    bucket_id in ('guides', 'assets')
    and public.has_org_role(public.storage_path_uuid(name, 1), array['brand_admin']::public.member_role[])
  );
create policy "vault buckets: admin delete" on storage.objects for delete to authenticated
  using (
    bucket_id in ('guides', 'assets')
    and public.has_org_role(public.storage_path_uuid(name, 1), array['brand_admin']::public.member_role[])
  );

-- Drafts are immutable like versions: read and insert only.
create policy "drafts: readers read" on storage.objects for select to authenticated
  using (
    bucket_id = 'drafts'
    and public.storage_content_in_org(name)
    and public.can_read_content(public.storage_path_uuid(name, 2))
  );
create policy "drafts: editors insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'drafts'
    and public.storage_content_in_org(name)
    and public.can_edit_content(public.storage_path_uuid(name, 2))
  );

-- Renders are written by the worker (service role).
create policy "renders: readers read" on storage.objects for select to authenticated
  using (
    bucket_id = 'renders'
    and public.storage_content_in_org(name)
    and public.can_read_content(public.storage_path_uuid(name, 2))
  );
