-- Indexes: HNSW for retrieval, B-tree on every FK, (org_id, state), (org_id, code).
create index rule_cards_embedding_hnsw on public.rule_cards
  using hnsw (embedding extensions.vector_cosine_ops) with (m = 16, ef_construction = 64);
create index facts_embedding_hnsw on public.facts
  using hnsw (embedding extensions.vector_cosine_ops) with (m = 16, ef_construction = 64);

create index memberships_user_id_idx on public.memberships (user_id);
create index campaigns_org_id_idx on public.campaigns (org_id);

create index brand_guides_org_id_idx on public.brand_guides (org_id);
create index brand_guides_created_by_idx on public.brand_guides (created_by);
create index rule_cards_org_code_idx on public.rule_cards (org_id, code);
create index rule_cards_guide_id_idx on public.rule_cards (guide_id);
create index rule_cards_org_status_idx on public.rule_cards (org_id, status);
-- At most one approved version of each rule code; retrieval uses only that one.
create unique index rule_cards_one_approved_idx on public.rule_cards (org_id, code) where status = 'approved';
create index facts_org_code_idx on public.facts (org_id, code);
create index facts_campaign_id_idx on public.facts (org_id, campaign_id);
create index glossary_terms_org_code_idx on public.glossary_terms (org_id, code);
create index assets_org_id_idx on public.assets (org_id);

create index contents_org_state_idx on public.contents (org_id, state);
create index contents_campaign_idx on public.contents (org_id, campaign_id);
create index contents_owner_id_idx on public.contents (owner_id);
create index contents_current_version_idx on public.contents (current_version_id);
create index contents_review_queue_idx on public.contents (org_id, state, risk_score desc, created_at);
create index versions_created_by_idx on public.versions (created_by);
create index review_runs_org_id_idx on public.review_runs (org_id);
create index review_runs_version_id_idx on public.review_runs (version_id, created_at desc);
create index findings_org_id_idx on public.findings (org_id);
create index findings_version_id_idx on public.findings (version_id);
create index findings_run_id_idx on public.findings (run_id);
create index findings_rule_id_idx on public.findings (rule_id);
create index findings_fact_id_idx on public.findings (fact_id);
create index findings_resolved_by_idx on public.findings (resolved_by);

create index decisions_org_id_idx on public.decisions (org_id);
create index decisions_version_id_idx on public.decisions (version_id);
create index decisions_actor_id_idx on public.decisions (actor_id);
create index decisions_finding_id_idx on public.decisions (finding_id);
create index comments_org_id_idx on public.comments (org_id);
create index comments_version_id_idx on public.comments (version_id);
create index comments_author_id_idx on public.comments (author_id);
create index comments_parent_id_idx on public.comments (parent_id);
create index audit_events_org_at_idx on public.audit_events (org_id, at desc);
create index audit_events_actor_id_idx on public.audit_events (actor_id);
create index example_suggestions_org_id_idx on public.example_suggestions (org_id);
create index example_suggestions_rule_id_idx on public.example_suggestions (rule_id);
create index example_suggestions_decided_by_idx on public.example_suggestions (decided_by);
