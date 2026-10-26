import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type DimensionQuality = {
  dimension: string;
  precision: number;
  recall: number;
  maxSeverity: string;
  /** Clamped to suggestion by the precision gate (invariant 10). */
  capped: boolean;
};

export type EvalSummary = {
  generatedAt: string;
  rows: number;
  dimensions: DimensionQuality[];
  p95TotalMs: number | null;
  intentP95Ms: number | null;
};

/**
 * The committed P14 golden-set report (`apps/worker/eval/report.json`), if this checkout has one.
 * Missing or malformed → null, and the UI shows TARGET values instead of measured ones.
 */
export async function readEvalReport(): Promise<EvalSummary | null> {
  for (const base of [process.cwd(), join(process.cwd(), "apps/web")]) {
    try {
      const raw = JSON.parse(await readFile(join(base, "../worker/eval/report.json"), "utf8"));
      const dims = raw?.metrics?.dimensions ?? {};
      return {
        generatedAt: String(raw.generated_at ?? ""),
        rows: Array.isArray(raw.rows) ? raw.rows.length : 0,
        dimensions: Object.entries(dims).map(([dimension, d]) => {
          const m = d as { precision?: number; recall?: number; max_severity?: string };
          return {
            dimension,
            precision: m.precision ?? 0,
            recall: m.recall ?? 0,
            maxSeverity: m.max_severity ?? "suggestion",
            capped: (m.precision ?? 0) < 0.85 && m.max_severity === "suggestion",
          };
        }),
        p95TotalMs: raw?.latency?.total?.p95 ?? null,
        intentP95Ms: raw?.intent_latency?.p95 ?? null,
      };
    } catch {
      /* try the next base */
    }
  }
  return null;
}
