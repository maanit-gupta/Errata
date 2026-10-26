-- RLS helpers. security definer so policies can read memberships without recursing into its RLS.
create or replace function public.is_org_member(org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = org and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.has_org_role(org uuid, roles public.member_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = org and m.user_id = (select auth.uid()) and m.role = any (roles)
  );
$$;

-- Every role except agency_creator: the "internal team" that sees full rule text and all content.
create or replace function public.is_org_staff(org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_org_role(org, array['creator', 'manager', 'specialist', 'brand_admin']::public.member_role[]);
$$;

-- SPEC §2: agencies see only content they own; everyone else in the org sees all org content.
create or replace function public.can_read_content(p_content_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.contents c
    where c.id = p_content_id
      and (public.is_org_staff(c.org_id)
           or (c.owner_id = (select auth.uid()) and public.is_org_member(c.org_id)))
  );
$$;

create or replace function public.can_read_version(p_version_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.versions v
    where v.id = p_version_id and public.can_read_content(v.content_id)
  );
$$;

-- First path segment of a storage object name as an org id; null if it isn't a uuid.
create or replace function public.storage_path_uuid(p_name text, p_segment int)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return (string_to_array(p_name, '/'))[p_segment]::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

revoke execute on function public.is_org_member(uuid) from public, anon;
revoke execute on function public.has_org_role(uuid, public.member_role[]) from public, anon;
revoke execute on function public.is_org_staff(uuid) from public, anon;
revoke execute on function public.can_read_content(uuid) from public, anon;
revoke execute on function public.can_read_version(uuid) from public, anon;
grant execute on function public.is_org_member(uuid) to authenticated, service_role;
grant execute on function public.has_org_role(uuid, public.member_role[]) to authenticated, service_role;
grant execute on function public.is_org_staff(uuid) to authenticated, service_role;
grant execute on function public.can_read_content(uuid) to authenticated, service_role;
grant execute on function public.can_read_version(uuid) to authenticated, service_role;
