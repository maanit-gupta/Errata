-- Retrieval (pipeline stage 4): top-k approved rule cards plus in-scope facts by cosine
-- similarity. Never returns never_send items. Service role only: it returns full rule bodies.
create or replace function public.match_vault(
  p_org uuid,
  p_campaign uuid,
  p_embedding extensions.vector,
  p_k int,
  p_dimensions public.dimension[] default null
)
returns table (
  id uuid,
  code text,
  kind text,
  dimension public.dimension,
  title text,
  content text,
  severity public.severity,
  value jsonb,
  similarity double precision
)
language sql
stable
security definer
set search_path = ''
as $$
  select * from (
    (
      select r.id, r.code, 'rule'::text, r.dimension, r.title, r.body, r.severity, null::jsonb,
             1 - (r.embedding operator(extensions.<=>) p_embedding)
      from public.rule_cards r
      where r.org_id = p_org
        and r.status = 'approved'
        and not r.never_send
        and r.embedding is not null
        and (p_dimensions is null or r.dimension = any (p_dimensions))
      order by r.embedding operator(extensions.<=>) p_embedding
      limit p_k
    )
    union all
    (
      select f.id, f.code, 'fact'::text, 'facts'::public.dimension, f.code, f.statement, null::public.severity,
             f.value, 1 - (f.embedding operator(extensions.<=>) p_embedding)
      from public.facts f
      where f.org_id = p_org
        and (f.campaign_id is null or f.campaign_id = p_campaign)
        and (f.valid_until is null or f.valid_until > now())
        and not f.never_send
        and f.embedding is not null
        and (p_dimensions is null or 'facts' = any (p_dimensions))
      order by f.embedding operator(extensions.<=>) p_embedding
      limit p_k
    )
  ) as m (id, code, kind, dimension, title, content, severity, value, similarity)
  order by m.similarity desc
  limit p_k;
$$;

revoke execute on function public.match_vault(uuid, uuid, extensions.vector, int, public.dimension[])
  from public, anon, authenticated;
grant execute on function public.match_vault(uuid, uuid, extensions.vector, int, public.dimension[])
  to service_role;
