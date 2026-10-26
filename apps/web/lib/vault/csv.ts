import { z } from "zod";

/**
 * Facts and glossary CSV import (SPEC §12). Pure: parse + validate, no I/O.
 *
 * Facts:    code,campaign,kind,statement,value_json,required_disclaimer,valid_until,never_send
 * Glossary: code,preferred,variants(|-separated),banned,case_sensitive,note
 */

export type RowError = { line: number; message: string };
export type ParseResult<T> = { rows: T[]; errors: RowError[] };

/** RFC 4180: quoted fields, "" escapes, commas and newlines inside quotes, CRLF or LF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"' && field === "") {
      quoted = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

const blankToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);
const bool = (fallback: boolean) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? String(fallback) : v),
    z.stringbool({ error: "must be true or false" }),
  );

export const FACT_KINDS = ["product", "event", "fee", "rate", "date", "venue", "other"] as const;
const CODE = /^[A-Z]{1,3}-\d{1,4}$/;

const factRow = z.object({
  code: z.string().trim().regex(CODE, { error: "code must look like F-112 or E-19" }),
  campaign: z.preprocess(blankToNull, z.string().trim().nullable()),
  kind: z.enum(FACT_KINDS, { error: `kind must be one of ${FACT_KINDS.join(", ")}` }),
  statement: z.string().trim().min(1, { error: "statement is required" }),
  value_json: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? "{}" : v),
    z.string().transform((s, ctx) => {
      try {
        const parsed: unknown = JSON.parse(s);
        if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
          ctx.addIssue({ code: "custom", message: "value_json must be a JSON object" });
          return z.NEVER;
        }
        return parsed as Record<string, unknown>;
      } catch {
        ctx.addIssue({ code: "custom", message: "value_json is not valid JSON" });
        return z.NEVER;
      }
    }),
  ),
  required_disclaimer: z.preprocess(blankToNull, z.string().trim().nullable()),
  valid_until: z.preprocess(
    blankToNull,
    z.iso
      .datetime({ offset: true, error: "valid_until must be an ISO timestamp with offset" })
      .nullable(),
  ),
  never_send: bool(false),
});

const glossaryRow = z.object({
  code: z.string().trim().regex(CODE, { error: "code must look like G-07" }),
  preferred: z.string().trim().min(1, { error: "preferred is required" }),
  variants: z
    .string()
    .default("")
    .transform((s) =>
      s
        .split("|")
        .map((v) => v.trim())
        .filter(Boolean),
    ),
  banned: bool(false),
  case_sensitive: bool(true),
  note: z.preprocess(blankToNull, z.string().trim().nullable()),
});

export type FactInsert = {
  code: string;
  campaign_id: string | null;
  kind: (typeof FACT_KINDS)[number];
  statement: string;
  value: Record<string, unknown>;
  required_disclaimer: string | null;
  valid_until: string | null;
  never_send: boolean;
};

export type GlossaryInsert = {
  code: string;
  preferred: string;
  variants: string[];
  banned: boolean;
  case_sensitive: boolean;
  note: string | null;
};

export const FACT_COLUMNS = [
  "code",
  "campaign",
  "kind",
  "statement",
  "value_json",
  "required_disclaimer",
  "valid_until",
  "never_send",
] as const;
export const GLOSSARY_COLUMNS = [
  "code",
  "preferred",
  "variants",
  "banned",
  "case_sensitive",
  "note",
] as const;

function toRecords(
  text: string,
  columns: readonly string[],
): { records: { line: number; data: Record<string, string> }[]; errors: RowError[] } {
  const [header, ...body] = parseCsv(text);
  if (!header) return { records: [], errors: [{ line: 1, message: "the file is empty" }] };
  const names = header.map((h) =>
    h
      .trim()
      .toLowerCase()
      .replace(/\(.*\)$/, ""),
  );
  const missing = columns.filter((c) => !names.includes(c));
  if (missing.length) {
    return {
      records: [],
      errors: [{ line: 1, message: `missing column(s): ${missing.join(", ")}` }],
    };
  }
  return {
    records: body.map((cells, i) => ({
      line: i + 2,
      data: Object.fromEntries(names.map((n, j) => [n, cells[j] ?? ""])),
    })),
    errors: [],
  };
}

function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  const field = issue.path.join(".");
  return field ? `${field}: ${issue.message}` : issue.message;
}

function duplicates<T extends { code: string }>(rows: { line: number; row: T }[]): RowError[] {
  const seen = new Map<string, number>();
  const errors: RowError[] = [];
  for (const { line, row } of rows) {
    const prev = seen.get(row.code);
    if (prev) errors.push({ line, message: `code ${row.code} already appears on line ${prev}` });
    else seen.set(row.code, line);
  }
  return errors;
}

/** `campaigns` maps campaign names (case-insensitive) to ids within the org. */
export function parseFactsCsv(
  text: string,
  campaigns: { id: string; name: string }[],
): ParseResult<FactInsert> {
  const { records, errors } = toRecords(text, FACT_COLUMNS);
  const byName = new Map(campaigns.map((c) => [c.name.trim().toLowerCase(), c.id]));
  const ok: { line: number; row: FactInsert }[] = [];
  for (const { line, data } of records) {
    const parsed = factRow.safeParse(data);
    if (!parsed.success) {
      errors.push({ line, message: firstIssue(parsed.error) });
      continue;
    }
    const r = parsed.data;
    let campaignId: string | null = null;
    if (r.campaign) {
      campaignId = byName.get(r.campaign.toLowerCase()) ?? null;
      if (!campaignId) {
        errors.push({
          line,
          message: `campaign "${r.campaign}" doesn't exist in this organisation`,
        });
        continue;
      }
    }
    ok.push({
      line,
      row: {
        code: r.code,
        campaign_id: campaignId,
        kind: r.kind,
        statement: r.statement,
        value: r.value_json,
        required_disclaimer: r.required_disclaimer,
        valid_until: r.valid_until,
        never_send: r.never_send,
      },
    });
  }
  errors.push(...duplicates(ok));
  return { rows: ok.map((o) => o.row), errors: errors.sort((a, b) => a.line - b.line) };
}

export function parseGlossaryCsv(text: string): ParseResult<GlossaryInsert> {
  const { records, errors } = toRecords(text, GLOSSARY_COLUMNS);
  const ok: { line: number; row: GlossaryInsert }[] = [];
  for (const { line, data } of records) {
    const parsed = glossaryRow.safeParse(data);
    if (!parsed.success) {
      errors.push({ line, message: firstIssue(parsed.error) });
      continue;
    }
    ok.push({ line, row: parsed.data });
  }
  errors.push(...duplicates(ok));
  return { rows: ok.map((o) => o.row), errors: errors.sort((a, b) => a.line - b.line) };
}
