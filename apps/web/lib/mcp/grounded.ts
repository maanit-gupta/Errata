/**
 * In-app MCP grounded chat (R3 Hero E1). Pure and deterministic: no LLM is called. The draft is
 * written only from facts and approved rule cards the server loaded with the same filters as the
 * worker's `get_campaign_context` MCP tool (this campaign or org-wide, unexpired, never never_send),
 * so every number, date and venue in it traces to a cited fact ID.
 */

export type GroundFact = {
  code: string;
  kind: string;
  statement: string;
  value: unknown;
  required_disclaimer: string | null;
};
export type GroundRule = { code: string; title: string; summary: string | null };
/** never_send vault items: proven absent from the output, never sent anywhere. */
export type Canary = { code: string; text: string };

/** sessionStorage key the draft workspace reads once to prefill a fresh draft. */
export const groundedSeedKey = (contentId: string) => `errata:grounded:${contentId}`;

export const PRESETS = [
  {
    id: "webinar",
    label: "Draft Diwali SIP webinar caption",
    hint: "Prevents Hall B / Oct 18 context bleed",
    prompt: "Draft an Instagram caption inviting people to the Diwali SIP webinar.",
  },
  {
    id: "returns",
    label: "Draft PayWise Flexi-Cap returns post",
    hint: "Injects F-112 CAGR + SEBI disclaimer",
    prompt: "Draft a LinkedIn post about PayWise Flexi-Cap returns.",
  },
] as const;

export type GroundedResult = {
  text: string;
  factIds: string[];
  ruleIds: string[];
  canaries: number;
  leaked: number;
  intent: { goal: string; audience: string; cta: string; channel: string };
  title: string;
};

const words = (s: string) => new Set(s.toLowerCase().match(/[a-z0-9]+/g) ?? []);

const KIND_HINTS: Record<string, string[]> = {
  event: ["webinar", "event", "meet", "join", "register", "invite", "session", "live"],
  rate: ["return", "returns", "cagr", "performance", "growth", "flexi", "fund", "yield", "rate"],
  fee: ["fee", "fees", "exit", "load", "charge", "redeem", "redemption", "cost", "returns", "fund"],
  offer: ["offer", "cashback", "discount", "promo"],
};

/** Which facts the prompt is about. Nothing specific asked for: all of them. */
export function pickFacts(prompt: string, facts: GroundFact[]): GroundFact[] {
  const w = words(prompt);
  const hit = facts.filter(
    (f) =>
      (KIND_HINTS[f.kind] ?? []).some((h) => w.has(h)) ||
      [...words(f.statement)].some((t) => t.length > 4 && w.has(t)),
  );
  return hit.length ? hit : facts;
}

/** Lexical top-k over approved rule summaries (the worker ranks by embeddings; same pool). */
export function topRules(prompt: string, rules: GroundRule[], k = 3): GroundRule[] {
  const w = words(prompt);
  const score = (r: GroundRule) =>
    [...words(`${r.title} ${r.summary ?? ""}`)].filter((t) => t.length > 3 && w.has(t)).length;
  return [...rules]
    .map((r, i) => ({ r, s: score(r), i }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, k)
    .map((x) => x.r);
}

const rec = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

function eventLine(f: GroundFact): string {
  const v = rec(f.value);
  const name = str(v.name);
  const date = str(v.date);
  const time = str(v.time);
  const venue = str(v.venue);
  if (!name || !date) return `${f.statement}.`;
  const d = new Date(`${date}T00:00:00Z`);
  const day = Number.isNaN(d.getTime())
    ? date
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const at = time
    ? ` at ${new Date(`1970-01-01T${time}:00Z`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" })} IST`
    : "";
  const where = venue === "online" ? ", online" : venue ? ` at ${venue}` : "";
  return `Join the ${name}${where}, on ${day}${at}.`;
}

function factLine(f: GroundFact): string {
  if (f.kind === "event") return eventLine(f);
  if (f.kind === "rate") {
    const v = rec(f.value);
    const pct = typeof v.cagr_3y_pct === "number" ? v.cagr_3y_pct : null;
    const scheme = str(v.scheme);
    const asOf = str(v.as_of);
    const base =
      pct !== null && scheme
        ? `PayWise ${scheme} has a 3-year historical CAGR of ${pct}%${asOf ? ` as of ${asOf}` : ""}.`
        : `${f.statement}.`;
    return `${base} Past performance may or may not be sustained in future.`;
  }
  if (f.kind === "fee")
    return `Good to know: ${f.statement.replace(/^\w/, (c) => c.toLowerCase())}.`;
  return `${f.statement}.`;
}

/** The grounded draft for one prompt. Throws nothing; an empty vault gives an honest stub. */
export function buildGroundedDraft(input: {
  prompt: string;
  campaignName: string | null;
  facts: GroundFact[];
  rules: GroundRule[];
  canaries: Canary[];
}): GroundedResult {
  const facts = pickFacts(input.prompt, input.facts);
  const rules = topRules(input.prompt, input.rules);
  const w = words(input.prompt);
  const channel = w.has("linkedin")
    ? "linkedin_post"
    : w.has("email")
      ? "email"
      : w.has("push")
        ? "push_notification"
        : "instagram_caption";
  const hasEvent = facts.some((f) => f.kind === "event");
  const lines = facts.map(factLine);
  const cta = hasEvent
    ? "Register via the link in bio."
    : "Read the scheme details in the PayWise app.";
  const disclaimers = [...new Set(facts.map((f) => f.required_disclaimer).filter(Boolean))];
  const body = [...lines, cta, ...disclaimers].join(" ");
  const text = facts.length
    ? body
    : "No approved, unexpired facts are in context for this campaign, so there is nothing grounded to say yet. Add facts in the vault first.";
  const leaked = input.canaries.filter(
    (c) =>
      text.includes(c.code) ||
      (c.text.length > 8 && text.toLowerCase().includes(c.text.toLowerCase())),
  ).length;
  return {
    text,
    factIds: facts.map((f) => f.code),
    ruleIds: rules.map((r) => r.code),
    canaries: input.canaries.length,
    leaked,
    intent: {
      goal: hasEvent ? "Drive webinar registrations" : "Explain the scheme's track record",
      audience: "First-time SIP investors, 25-40",
      cta: hasEvent ? "Register for the webinar" : "Read the scheme details",
      channel,
    },
    title: hasEvent
      ? `${input.campaignName ?? "Campaign"} webinar caption (grounded)`
      : `${input.campaignName ?? "Campaign"} returns post (grounded)`,
  };
}
