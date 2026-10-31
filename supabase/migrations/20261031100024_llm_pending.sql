-- R3, improvement 3: "AI check pending" instead of a silent degraded result.
-- When every LLM provider is rate-limited (or 5xx/timeout), the worker saves the deterministic
-- findings at once, keeps the run `running` with llm_pending = true and the content in ai_check,
-- and queues a delayed retry of the LLM pass (pgmq.send with a delay, in the same transaction, so a
-- pending run can't lose its retry). The retry re-runs the pipeline through the same citation gate
-- and replaces the run's findings (idempotent per run). After the last attempt the run finishes
-- degraded, as before. Only the worker writes these columns (no client update grant on runs).

alter table public.review_runs
  add column llm_pending boolean not null default false,
  add column llm_attempts smallint not null default 0 check (llm_attempts >= 0),
  add column llm_next_at timestamptz;

comment on column public.review_runs.llm_pending is
  'Deterministic findings are saved; the LLM pass is waiting for a retry (R3).';
comment on column public.review_runs.llm_attempts is
  'LLM pass attempts that ended rate-limited or transient (R3).';
comment on column public.review_runs.llm_next_at is
  'When the next LLM retry is due (shown in the UI as "next try in ~N min").';

-- The load report and the stuck-run check look these up.
create index review_runs_llm_pending_idx on public.review_runs (llm_next_at) where llm_pending;
