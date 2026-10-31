-- Round 3: read-only MCP server. A token is scoped to ONE campaign of ONE org; the worker only
-- ever sees its SHA-256 hash. The plaintext is returned once, by create_mcp_token().
create table public.mcp_tokens (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  campaign_id uuid not null,
  label text not null check (length(label) between 1 and 80),
  token_hash text not null unique,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  foreign key (org_id, campaign_id) references public.campaigns (org_id, id) on delete cascade
);

alter table public.mcp_tokens enable row level security;

-- Brand admins can list and revoke their org's tokens. Inserts only go through create_mcp_token().
create policy mcp_tokens_select on public.mcp_tokens for select to authenticated
  using (public.has_org_role(org_id, array['brand_admin']::public.member_role[]));
create policy mcp_tokens_revoke on public.mcp_tokens for update to authenticated
  using (public.has_org_role(org_id, array['brand_admin']::public.member_role[]))
  with check (public.has_org_role(org_id, array['brand_admin']::public.member_role[]));
revoke all on public.mcp_tokens from anon, authenticated;
grant select on public.mcp_tokens to authenticated;
grant update (revoked_at) on public.mcp_tokens to authenticated;

create or replace function public.create_mcp_token(p_org uuid, p_campaign uuid, p_label text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text := 'ek_' || encode(extensions.gen_random_bytes(24), 'hex');
begin
  if not public.has_org_role(p_org, array['brand_admin']::public.member_role[]) then
    raise exception 'only a brand admin can create MCP tokens' using errcode = '42501';
  end if;
  insert into public.mcp_tokens (org_id, campaign_id, label, token_hash, created_by)
  values (p_org, p_campaign, p_label,
          encode(extensions.digest(v_token, 'sha256'), 'hex'), (select auth.uid()));
  return v_token;
end;
$$;
revoke execute on function public.create_mcp_token(uuid, uuid, text) from public, anon;
grant execute on function public.create_mcp_token(uuid, uuid, text) to authenticated, service_role;

-- Worker only: hash in, scope out (nothing when unknown or revoked).
create or replace function public.resolve_mcp_token(p_hash text)
returns table (org_id uuid, campaign_id uuid)
language sql
security definer
set search_path = ''
as $$
  update public.mcp_tokens t set last_used_at = now()
  where t.token_hash = p_hash and t.revoked_at is null
  returning t.org_id, t.campaign_id;
$$;
revoke execute on function public.resolve_mcp_token(text) from public, anon, authenticated;
grant execute on function public.resolve_mcp_token(text) to service_role;
