-- Round 3, improvement 1: read-only MCP server.
-- A token is scoped to ONE campaign of ONE org. Only its SHA-256 hash is stored; the plaintext is
-- returned once by create_mcp_token(). The worker resolves a hash with resolve_mcp_token() and reads
-- facts with mcp_campaign_facts(); both are service-role only.

create table public.mcp_tokens (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  campaign_id uuid not null,
  label text not null check (length(btrim(label)) between 1 and 80),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  foreign key (org_id, campaign_id) references public.campaigns (org_id, id) on delete cascade
);

create index mcp_tokens_org_idx on public.mcp_tokens (org_id, created_at desc);

alter table public.mcp_tokens enable row level security;

-- Brand admins list their org's tokens. There is no insert/update/delete policy: tokens are created
-- and revoked only through the functions below, so a revoked token can't be un-revoked.
create policy mcp_tokens_select on public.mcp_tokens for select to authenticated
  using (public.has_org_role(org_id, array['brand_admin']::public.member_role[]));

revoke all on public.mcp_tokens from anon, authenticated;
-- token_hash is deliberately not readable by app users.
grant select (id, org_id, campaign_id, label, created_by, created_at, last_used_at, revoked_at)
  on public.mcp_tokens to authenticated;

-- Max live tokens per org. Keeps a leaked admin session from minting thousands.
create or replace function public.create_mcp_token(p_org uuid, p_campaign uuid, p_label text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text := 'ek_' || encode(extensions.gen_random_bytes(24), 'hex');
  v_label text := btrim(coalesce(p_label, ''));
  v_id uuid;
begin
  if not public.has_org_role(p_org, array['brand_admin']::public.member_role[]) then
    raise exception 'only a brand admin can create MCP tokens' using errcode = '42501';
  end if;
  if length(v_label) not between 1 and 80 then
    raise exception 'label must be 1-80 characters' using errcode = '22023';
  end if;
  if not exists (select 1 from public.campaigns c where c.id = p_campaign and c.org_id = p_org) then
    raise exception 'campaign not found in this organisation' using errcode = '22023';
  end if;
  if (select count(*) from public.mcp_tokens t where t.org_id = p_org and t.revoked_at is null) >= 20 then
    raise exception 'too many active MCP tokens; revoke one first' using errcode = '54000';
  end if;

  insert into public.mcp_tokens (org_id, campaign_id, label, token_hash, created_by)
  values (p_org, p_campaign, v_label,
          encode(extensions.digest(v_token, 'sha256'), 'hex'), (select auth.uid()))
  returning id into v_id;

  insert into public.audit_events (org_id, actor_id, event)
  values (p_org, (select auth.uid()),
          jsonb_build_object('type', 'mcp_token', 'action', 'create', 'token_id', v_id,
                             'campaign_id', p_campaign));
  return v_token;
end;
$$;
revoke execute on function public.create_mcp_token(uuid, uuid, text) from public, anon;
grant execute on function public.create_mcp_token(uuid, uuid, text) to authenticated, service_role;

-- Idempotent. Returns true when this call revoked the token.
create or replace function public.revoke_mcp_token(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  select t.org_id into v_org from public.mcp_tokens t where t.id = p_id;
  if v_org is null or not public.has_org_role(v_org, array['brand_admin']::public.member_role[]) then
    raise exception 'only a brand admin of this organisation can revoke this token'
      using errcode = '42501';
  end if;
  update public.mcp_tokens t set revoked_at = now() where t.id = p_id and t.revoked_at is null;
  if not found then
    return false;
  end if;
  insert into public.audit_events (org_id, actor_id, event)
  values (v_org, (select auth.uid()),
          jsonb_build_object('type', 'mcp_token', 'action', 'revoke', 'token_id', p_id));
  return true;
end;
$$;
revoke execute on function public.revoke_mcp_token(uuid) from public, anon;
grant execute on function public.revoke_mcp_token(uuid) to authenticated, service_role;

-- Worker only: hash in, scope out (no row when unknown or revoked). last_used_at is written at most
-- once a minute per token so a busy client doesn't turn every call into a write.
create or replace function public.resolve_mcp_token(p_hash text)
returns table (token_id uuid, org_id uuid, campaign_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.mcp_tokens t set last_used_at = now()
  where t.token_hash = p_hash and t.revoked_at is null
    and (t.last_used_at is null or t.last_used_at < now() - interval '1 minute');
  return query
    select t.id, t.org_id, t.campaign_id from public.mcp_tokens t
    where t.token_hash = p_hash and t.revoked_at is null;
end;
$$;
revoke execute on function public.resolve_mcp_token(text) from public, anon, authenticated;
grant execute on function public.resolve_mcp_token(text) to service_role;

-- Worker only: the facts an MCP caller may see. Same predicates as match_vault's fact branch:
-- this org, this campaign or org-wide, not expired, not never_send.
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
