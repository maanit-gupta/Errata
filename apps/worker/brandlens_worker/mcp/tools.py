"""The three read-only MCP tools (build spec §4.4, read-only subset), the resource and the prompt.

Zero duplicate logic: precheck and claim checks run the pipeline's own Stage 1 (`ingest`) and
Stage 3 (`run_filters`) on the caller's text, retrieval uses `match_vault` (Stage 4), and the intent
check uses the Stage 6 thresholds (`config.INTENT_COSINE`). No external LLM is called by any tool.

Never echoed to the caller: never_send facts or rules (filtered in SQL; findings that cite one are
withheld and only counted), expired facts, other campaigns' facts, other orgs' anything, and for
agency creators the rule body, examples and source page. Logs and audit events carry IDs and
counts only, never draft or claim text.
"""

from __future__ import annotations

import asyncio
import logging
import time
from collections.abc import Callable, Sequence
from datetime import UTC, datetime
from typing import Any

import numpy as np
import numpy.typing as npt

from brandlens_worker import config
from brandlens_worker.mcp.auth import McpAuth, scrub_rule_for_role
from brandlens_worker.mcp.schemas import (
    CitedFindingOut,
    GetCampaignContextInput,
    PrecheckDraftFastInput,
    VerifyClaimEvidenceInput,
)
from brandlens_worker.mcp.store import Campaign, McpStore
from brandlens_worker.pipeline.filters import run_filters
from brandlens_worker.pipeline.ingest import ingest
from brandlens_worker.pipeline.intent import check_draft_intent
from brandlens_worker.pipeline.types import Finding

log = logging.getLogger(__name__)

Embed = Callable[[Sequence[str]], Any]


class ToolError(Exception):
    """A caller-facing tool failure (returned as an MCP tool result with isError: true)."""


def _vec(embed: Embed, text: str) -> list[float]:
    return [float(x) for x in np.asarray(embed([text])[0])]


async def _embed(embed: Embed, text: str) -> list[float]:
    # CPU-bound ONNX call: keep it off the event loop the queue consumers share.
    return await asyncio.to_thread(_vec, embed, text)


def _fact_out(f: dict[str, Any]) -> dict[str, Any]:
    return {
        "fact_id": f["code"],
        "kind": f.get("kind"),
        "statement": f["statement"],
        "canonical_value": f.get("value"),
        "required_disclaimer": f.get("required_disclaimer"),
        "valid_until": f["valid_until"].isoformat()
        if isinstance(f.get("valid_until"), datetime)
        else f.get("valid_until"),
    }


async def _campaign_in_org(store: McpStore, auth: McpAuth, campaign_id: str) -> Campaign:
    campaign = await store.campaign(auth.org_id, campaign_id)
    if campaign is None:
        raise ToolError("Campaign not found in your organisation.")
    return campaign


def _cited(f: Finding, doc_original: str, to_original: Any) -> CitedFindingOut:
    start, end = to_original(f.start, f.end)
    codes = f.codes or [c for c in (f.rule_id, f.fact_id) if c]
    if f.wcag_ref and not codes:
        codes = [f"WCAG {f.wcag_ref}"]
    return CitedFindingOut(
        code=codes[0],
        also_cites=codes[1:],
        dimension=f.dimension,
        severity=f.severity,
        quote=f.quote or doc_original[start:end],
        span={"start": start, "end": end},
        confidence=f.confidence,
        source=f.source,
        explanation=f.explanation,
        suggested_fix=f.rewrite,
    )


def deterministic_findings(text: str, mvault: Any) -> tuple[list[CitedFindingOut], int]:
    """Stage 1 + Stage 3 on `text`. Returns (findings the caller may see, withheld count)."""
    doc = ingest("text", body=text)
    shown: list[CitedFindingOut] = []
    withheld = 0
    for f in run_filters(doc, mvault.vault):
        if not f.cited:
            continue  # invariant 1: never show an uncited finding
        if set(f.codes) & mvault.internal_codes:
            withheld += 1
            continue
        shown.append(_cited(f, doc.original, doc.to_original))
    return shown, withheld


# --- tool 1 ------------------------------------------------------------------------------------


async def get_campaign_context(
    args: GetCampaignContextInput, auth: McpAuth, store: McpStore, embed: Embed
) -> dict[str, Any]:
    campaign = await store.find_active_campaign(auth.org_id, args.campaign_query)
    if campaign is None:
        names = [c.name for c in await store.active_campaigns(auth.org_id)]
        raise ToolError(
            f"No active campaign matches '{args.campaign_query}'. Active campaigns: "
            + (", ".join(names) if names else "none")
            + "."
        )
    i = args.intent
    vec = await _embed(embed, f"{campaign.name} {i.goal} {i.audience} {i.channel} {i.cta}")
    facts = await store.campaign_facts(auth.org_id, campaign.id)
    hits = await store.match(auth.org_id, campaign.id, vec, config.MCP_CONTEXT_RULES * 2)
    rule_ids = [h["id"] for h in hits if h["kind"] == "rule"][: config.MCP_CONTEXT_RULES]
    cards = {c["id"]: c for c in await store.rule_cards(auth.org_id, rule_ids)}
    rules = [scrub_rule_for_role(cards[r], auth) for r in rule_ids if r in cards]
    glossary = [
        {
            "term_id": g["code"],
            "use": g["preferred"],
            "not": list(g.get("variants") or []),
            "banned": bool(g.get("banned")),
        }
        for g in await store.glossary(auth.org_id)
    ]
    await store.audit(
        auth,
        {
            "type": "mcp_tool",
            "tool": "get_campaign_context",
            "campaign_id": campaign.id,
            "facts": len(facts),
            "rules": len(rules),
        },
    )
    return {
        "campaign": {
            "id": campaign.id,
            "name": campaign.name,
            "window": f"{campaign.starts_on} to {campaign.ends_on}",
        },
        "as_of": datetime.now(UTC).isoformat(timespec="seconds"),
        "mandatory_intent_contract": args.intent.model_dump(),
        "approved_facts": [_fact_out(f) for f in facts],
        "active_rule_cards": rules,
        "glossary": glossary,
        "governance_directive": (
            "Use ONLY the dates, venues, rates, fees and product names in approved_facts, with "
            "their required_disclaimer. Never promise guaranteed or assured returns, and no "
            "superlatives you can't back up. Keep the exact cta from mandatory_intent_contract. "
            "Write brand terms as in glossary. Cite the fact_id and rule codes you rely on."
        ),
    }


# --- tool 2 ------------------------------------------------------------------------------------


async def precheck_draft_fast(
    args: PrecheckDraftFastInput, auth: McpAuth, store: McpStore, embed: Embed
) -> dict[str, Any]:
    started = time.perf_counter()
    campaign = await _campaign_in_org(store, auth, str(args.campaign_id))
    mvault = await store.load_vault(auth.org_id, campaign)

    t = time.perf_counter()
    findings, withheld = await asyncio.to_thread(deterministic_findings, args.draft_text, mvault)
    embed_fn: Callable[[list[str]], npt.NDArray[np.float32]] | None = (
        (lambda texts: np.asarray(embed(texts), dtype=np.float32)) if args.baseline_text else None
    )
    intent = await asyncio.to_thread(
        check_draft_intent,
        args.draft_text,
        args.intent.model_dump(),
        baseline=args.baseline_text,
        embed=embed_fn,
    )
    checks_ms = round((time.perf_counter() - t) * 1000, 2)

    blockers = [f for f in findings if f.severity == "blocker"]
    blocked = bool(blockers) or not intent.passed
    await store.audit(
        auth,
        {
            "type": "mcp_tool",
            "tool": "precheck_draft_fast",
            "campaign_id": campaign.id,
            "findings": len(findings),
            "blockers": len(blockers),
            "withheld": withheld,
            "intent_passed": intent.passed,
        },
    )
    return {
        "status": "BLOCKED" if blocked else "PASS_DETERMINISTIC",
        "latency_ms": round((time.perf_counter() - started) * 1000, 2),
        "checks_ms": checks_ms,
        "blocker_count": len(blockers),
        "intent_verification": {
            "passed": intent.passed,
            "cta_retained": intent.cta_retained,
            "cosine_similarity": None
            if intent.cosine_similarity is None
            else round(intent.cosine_similarity, 4),
            "threshold": config.INTENT_COSINE,
            "failure_reason": intent.failure_reason,
        },
        "findings": [f.model_dump() for f in findings],
        "withheld_internal": withheld,
        "next_step": (
            "Rewrite the flagged spans using each finding's cited code and suggested_fix, then run "
            "precheck_draft_fast again."
            if blocked
            else "Deterministic checks pass. Paste the draft into Errata (New draft) for the full "
            "check, including the AI pass, and human approval. Nothing is published from here."
        ),
    }


# --- tool 3 ------------------------------------------------------------------------------------


async def verify_claim_evidence(
    args: VerifyClaimEvidenceInput, auth: McpAuth, store: McpStore, embed: Embed
) -> dict[str, Any]:
    """Deterministic first (CLAUDE.md invariant 3): the claims lexicon and Fact Vault numbers decide
    a blocker; the embedding match only finds the facts a clean claim must cite."""
    campaign = await _campaign_in_org(store, auth, str(args.campaign_id))
    mvault = await store.load_vault(auth.org_id, campaign)
    findings, withheld = await asyncio.to_thread(
        deterministic_findings, args.claim_statement, mvault
    )
    vec = await _embed(embed, args.claim_statement)
    facts_by_code = {f["code"]: f for f in await store.campaign_facts(auth.org_id, campaign.id)}
    fact_hits = [
        h
        for h in await store.match(auth.org_id, campaign.id, vec, 8, ["facts"])
        if h["code"] in facts_by_code
    ][: config.MCP_CLAIM_FACTS]
    rule_hits = [
        h
        for h in await store.match(auth.org_id, campaign.id, vec, 6, ["claims"])
        if h["kind"] == "rule"
    ][:3]
    cards = {c["id"]: c for c in await store.rule_cards(auth.org_id, [h["id"] for h in rule_hits])}

    blockers = [f for f in findings if f.severity == "blocker"]
    best = fact_hits[0] if fact_hits else None
    matched = bool(best and best["score"] >= config.MCP_CLAIM_FACT_MIN_SIM)
    if blockers:
        verdict = "BLOCKER"
    elif matched:
        verdict = "SUBSTANTIATED_CITE_FACT_AND_DISCLAIMER"
    else:
        verdict = "UNSUBSTANTIATED_NO_MATCHING_FACT"
    disclaimers = sorted(
        {d for h in fact_hits if (d := facts_by_code[h["code"]].get("required_disclaimer"))}
    )
    await store.audit(
        auth,
        {
            "type": "mcp_tool",
            "tool": "verify_claim_evidence",
            "campaign_id": campaign.id,
            "verdict": verdict,
            "blockers": len(blockers),
            "withheld": withheld,
        },
    )
    return {
        "verdict": verdict,
        "substantiated": verdict.startswith("SUBSTANTIATED"),
        "findings": [f.model_dump() for f in findings],
        "withheld_internal": withheld,
        "matching_facts": [
            {**_fact_out(facts_by_code[h["code"]]), "similarity": h["score"]} for h in fact_hits
        ],
        "required_disclaimers": disclaimers,
        "governing_claim_rules": [
            scrub_rule_for_role(cards[h["id"]], auth) for h in rule_hits if h["id"] in cards
        ],
        "similarity_threshold": config.MCP_CLAIM_FACT_MIN_SIM,
    }


# --- resource and prompt -------------------------------------------------------------------------

ACTIVE_CAMPAIGNS_URI = "brandvault://campaigns/active"


async def read_active_campaigns(auth: McpAuth, store: McpStore) -> dict[str, Any]:
    campaigns = await store.active_campaigns(auth.org_id)
    out = []
    for c in campaigns:
        facts = await store.campaign_facts(auth.org_id, c.id)
        out.append(
            {
                "id": c.id,
                "name": c.name,
                "window": f"{c.starts_on} to {c.ends_on}",
                "approved_facts": [_fact_out(f) for f in facts],
            }
        )
    await store.audit(
        auth, {"type": "mcp_resource", "uri": ACTIVE_CAMPAIGNS_URI, "campaigns": len(out)}
    )
    return {"as_of": datetime.now(UTC).isoformat(timespec="seconds"), "campaigns": out}


PROMPT_NAME = "brandlens-governed-draft"
PROMPT_ARGS = [
    {"name": "campaign_name", "description": "e.g. Diwali SIP 2026", "required": True},
    {"name": "goal", "description": "e.g. webinar sign-ups", "required": True},
    {"name": "audience", "description": "e.g. first-time investors", "required": True},
    {"name": "cta", "description": "e.g. Register now", "required": True},
    {"name": "channel", "description": "e.g. instagram_caption", "required": False},
]


def governed_draft_prompt(args: dict[str, str]) -> str:
    channel = args.get("channel") or "instagram_caption"
    return (
        f"You are writing a {channel} for the campaign '{args['campaign_name']}'.\n"
        f"Stated intent: goal: {args['goal']} | audience: {args['audience']} | "
        f"mandatory CTA: '{args['cta']}'.\n\n"
        "Follow this loop exactly:\n"
        "1. Call get_campaign_context for this campaign and intent.\n"
        "2. Draft the copy using ONLY the approved facts, glossary and rule cards it returns.\n"
        "3. Call precheck_draft_fast on your draft. If it returns BLOCKED, apply the cited fixes "
        "and run it again until it passes. Use verify_claim_evidence for any number or promise "
        "you're unsure of.\n"
        "4. Show me the clean draft with the rule and fact codes it relies on. Remind me to paste "
        "it into Errata for the full check and human approval; nothing is published from here."
    )
