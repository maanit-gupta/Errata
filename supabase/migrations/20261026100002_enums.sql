-- Enums (SPEC §3).
create type public.member_role as enum ('agency_creator', 'creator', 'manager', 'specialist', 'brand_admin');
create type public.specialist_kind as enum ('legal', 'a11y');
create type public.dimension as enum ('tone', 'terms', 'facts', 'claims', 'visual', 'access');
create type public.severity as enum ('blocker', 'warning', 'suggestion');
create type public.content_state as enum (
  'draft', 'ai_check', 'needs_revision', 'in_review', 'changes_requested',
  'specialist_review', 'approved', 'publish_ready', 'archived'
);
create type public.finding_status as enum ('open', 'accepted', 'edited', 'dismissed', 'routed', 'superseded');
create type public.dismiss_reason as enum ('approved_exception', 'doesnt_apply', 'ai_wrong');
create type public.decision_action as enum ('approve', 'request_changes', 'sign_off', 'override', 'mark_ready', 'archive');

create type public.campaign_status as enum ('planned', 'active', 'ended');
create type public.guide_source_kind as enum ('pdf', 'docx', 'url');
create type public.guide_status as enum ('uploaded', 'parsing', 'drafted', 'failed');
create type public.rule_status as enum ('draft', 'approved', 'archived');
create type public.fact_kind as enum ('product', 'event', 'fee', 'rate', 'date', 'venue', 'other');
create type public.asset_kind as enum ('logo', 'palette', 'font', 'reference_image');
create type public.content_format as enum ('text', 'markdown', 'html', 'docx', 'image', 'pdf');
create type public.run_status as enum ('queued', 'running', 'done', 'failed');
create type public.finding_source as enum ('deterministic', 'llm');
create type public.suggestion_status as enum ('pending', 'approved', 'rejected');
