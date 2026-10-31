-- Round 3, improvement 1: read-only MCP server (docs/MCP.md; build spec "Shift-Left MCP Server",
-- read-only subset). A key belongs to ONE user in ONE org and acts with that user's CURRENT
-- membership role (agency creators get the agency view). Only its SHA-256 hash is stored; the
-- plaintext is returned once by create_mcp_key(). The worker resolves keys with resolve_mcp_key()
-- and reads facts with mcp_campaign_facts(); both are service-role only.

create table public.mcp_api_keys (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default 'Claude / Cursor' check (length(btrim(name)) between 1 and 80),
  key_prefix text not null check (key_prefix ~ '^bl_mcp_[0-9a-f]{4}$'),  -- shown in the UI
  key_hash text not null unique check (key_hash ~ '^[0-9a-f]{64}$'),
  last_used_at timestamptz,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index mcp_api_keys_org_idx on public.mcp_api_keys (org_id, created_at desc);
create index mcp_api_keys_user_idx on public.mcp_api_keys (user_id);

alter table public.mcp_api_keys enable row level security;

-- Members see their own keys; brand admins see every key in the org. No insert/update/delete
-- policy: keys are created and revoked only through the functions below, so a key's role, org and
-- expiry can't be edited and a revoked key can't be revived.
create policy mcp_api_keys_select on public.mcp_api_keys for select to authenticated
  using (
    (user_id = (select auth.uid()) and public.is_org_member(org_id))
    or public.has_org_role(org_id, array['brand_admin']::public.member_role[])
  );

revoke all on public.mcp_api_keys from anon, authenticated;
-- key_hash is deliberately not readable by app users.
grant select (id, org_id, user_id, name, key_prefix, last_used_at, expires_at, revoked_at, created_at)
  on public.mcp_api_keys to authenticated;

-- Any member creates keys for themselves (1-365 days; at most 5 live keys per user).
create or replace function public.create_mcp_key(p_org uuid, p_name text, p_expires_in_days int default 90)
returns table (id uuid, raw_key text, key_prefix text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_hex text := encode(extensions.gen_random_bytes(24), 'hex');
  v_key text := 'bl_mcp_' || v_hex;
  v_name text := btrim(coalesce(p_name, ''));
  v_id uuid;
  v_exp timestamptz;
begin
  if v_uid is null or not public.is_org_member(p_org) then
    raise exception 'only members of this organisation can create MCP keys' using errcode = '42501';
  end if;
  if length(v_name) not between 1 and 80 then
    raise exception 'name must be 1-80 characters' using errcode = '22023';
  end if;
  if p_expires_in_days is null or p_expires_in_days not between 1 and 365 then
    raise exception 'expiry must be 1-365 days' using errcode = '22023';
  end if;
  if (select count(*) from public.mcp_api_keys k
      where k.user_id = v_uid and k.org_id = p_org and k.revoked_at is null
        and k.expires_at > now()) >= 5 then
    raise exception 'you already have 5 active MCP keys; revoke one first' using errcode = '54000';
  end if;

  insert into public.mcp_api_keys (org_id, user_id, name, key_prefix, key_hash, expires_at)
  values (p_org, v_uid, v_name, 'bl_mcp_' || left(v_hex, 4),
          encode(extensions.digest(v_key, 'sha256'), 'hex'),
          now() + make_interval(days => p_expires_in_days))
  returning mcp_api_keys.id, mcp_api_keys.expires_at into v_id, v_exp;

  insert into public.audit_events (org_id, actor_id, event)
  values (p_org, v_uid, jsonb_build_object('type', 'mcp_key', 'action', 'create', 'key_id', v_id,
                                           'expires_at', v_exp));
  return query select v_id, v_key, 'bl_mcp_' || left(v_hex, 4), v_exp;
end;
$$;
revoke execute on function public.create_mcp_key(uuid, text, int) from public, anon;
grant execute on function public.create_mcp_key(uuid, text, int) to authenticated;

-- The key's owner or a brand admin of its org. Idempotent: true when this call revoked it.
create or replace function public.revoke_mcp_key(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_owner uuid;
begin
  select k.org_id, k.user_id into v_org, v_owner from public.mcp_api_keys k where k.id = p_id;
  if v_org is null
     or not (v_owner = (select auth.uid())
             or public.has_org_role(v_org, array['brand_admin']::public.member_role[])) then
    raise exception 'only the key''s owner or a brand admin can revoke it' using errcode = '42501';
  end if;
  update public.mcp_api_keys k set revoked_at = now() where k.id = p_id and k.revoked_at is null;
  if not found then
    return false;
  end if;
  insert into public.audit_events (org_id, actor_id, event)
  values (v_org, (select auth.uid()),
          jsonb_build_object('type', 'mcp_key', 'action', 'revoke', 'key_id', p_id));
  return true;
end;
$$;
revoke execute on function public.revoke_mcp_key(uuid) from public, anon;
grant execute on function public.revoke_mcp_key(uuid) to authenticated;

-- Worker only: hash in, identity out. Nothing when unknown, revoked, expired, or the user is no
-- longer a member. The role is read from memberships NOW, so a demoted user's key is demoted too.
-- last_used_at is written at most once a minute per key.
create or replace function public.resolve_mcp_key(p_hash text)
returns table (key_id uuid, org_id uuid, user_id uuid, role public.member_role)
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.mcp_api_keys k set last_used_at = now()
  where k.key_hash = p_hash and k.revoked_at is null and k.expires_at > now()
    and (k.last_used_at is null or k.last_used_at < now() - interval '1 minute');
  return query
    select k.id, k.org_id, k.user_id, m.role
    from public.mcp_api_keys k
    join public.memberships m on m.org_id = k.org_id and m.user_id = k.user_id
    where k.key_hash = p_hash and k.revoked_at is null and k.expires_at > now();
end;
$$;
revoke execute on function public.resolve_mcp_key(text) from public, anon, authenticated;
grant execute on function public.resolve_mcp_key(text) to service_role;

-- Worker only: the facts an MCP caller may see for a campaign. Same predicates as match_vault's
-- fact branch: this org, this campaign or org-wide, not expired, not never_send.
create or replace function public.mcp_campaign_facts(p_org uuid, p_campaign uuid)
returns table (
  code text,
  kind text,
  statement text,
  value jsonb,
  required_disclaimer text,
  valid_until timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select f.code, f.kind::text, f.statement, f.value, f.required_disclaimer, f.valid_until
  from public.facts f
  where f.org_id = p_org
    and (f.campaign_id is null or f.campaign_id = p_campaign)
    and (f.valid_until is null or f.valid_until > now())
    and not f.never_send
  order by f.code;
$$;
revoke execute on function public.mcp_campaign_facts(uuid, uuid) from public, anon, authenticated;
grant execute on function public.mcp_campaign_facts(uuid, uuid) to service_role;
