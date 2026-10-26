"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { parseFactsCsv, parseGlossaryCsv, type RowError } from "@/lib/vault/csv";

type Kind = "facts" | "glossary";

/** Pick a CSV, preview it with the same validation the server runs, then import. */
export function CsvImport({
  kind,
  campaigns = [],
}: {
  kind: Kind;
  campaigns?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const id = useId();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{
    rows: { code: string; summary: string }[];
    errors: RowError[];
  } | null>(null);
  const [pending, start] = useTransition();

  async function onFile(f: File | null) {
    setFile(f);
    setPreview(null);
    if (!f) return;
    const text = await f.text();
    if (kind === "facts") {
      const r = parseFactsCsv(text, campaigns);
      setPreview({
        rows: r.rows.map((x) => ({ code: x.code, summary: x.statement })),
        errors: r.errors,
      });
    } else {
      const r = parseGlossaryCsv(text);
      setPreview({
        rows: r.rows.map((x) => ({
          code: x.code,
          summary: `${x.preferred}${x.variants.length ? ` (not ${x.variants.join(", ")})` : ""}`,
        })),
        errors: r.errors,
      });
    }
  }

  function submit() {
    if (!file) return;
    start(async () => {
      const body = new FormData();
      body.set("kind", kind);
      body.set("file", file);
      const res = await fetch("/api/vault/import", { method: "POST", body });
      const json = (await res.json()) as { imported?: number; error?: string; errors?: RowError[] };
      if (!res.ok) {
        toast.error(json.error ?? `${json.errors?.length ?? 0} row(s) have errors.`);
        if (json.errors) setPreview((p) => (p ? { ...p, errors: json.errors! } : p));
        return;
      }
      toast.success(`Imported ${json.imported} ${kind === "facts" ? "facts" : "glossary terms"}.`);
      setFile(null);
      setPreview(null);
      router.refresh();
    });
  }

  return (
    <section
      aria-labelledby={`${id}-h`}
      className="border-border mb-8 rounded-lg border border-dashed p-4"
    >
      <h2 id={`${id}-h`} className="font-heading text-lg">
        Import {kind === "facts" ? "facts" : "glossary"} from CSV
      </h2>
      <p className="text-muted-foreground mb-3 text-sm">
        {kind === "facts"
          ? "Columns: code, campaign, kind, statement, value_json, required_disclaimer, valid_until, never_send."
          : "Columns: code, preferred, variants (separated by |), banned, case_sensitive, note."}{" "}
        Rows with the same code are updated.
      </p>
      <label htmlFor={`${id}-file`} className="text-sm font-medium">
        CSV file
      </label>
      <input
        id={`${id}-file`}
        type="file"
        accept=".csv,text/csv"
        className="file:border-border file:bg-card mt-1 block text-sm file:mr-3 file:rounded-md file:border file:px-3 file:py-1.5"
        onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
      />

      {preview ? (
        <div className="mt-4 space-y-3" aria-live="polite">
          {preview.errors.length ? (
            <div role="alert" className="border-accent-text rounded-md border p-3">
              <p className="text-accent-text mb-1 text-sm font-medium">
                {preview.errors.length} row{preview.errors.length === 1 ? "" : "s"} can&apos;t be
                imported. Fix the file and choose it again.
              </p>
              <ul className="list-disc pl-5 text-sm">
                {preview.errors.map((e) => (
                  <li key={`${e.line}-${e.message}`}>
                    Line {e.line}: {e.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <table className="w-full text-left text-sm">
            <caption className="text-muted-foreground mb-1 text-left text-sm">
              Preview: {preview.rows.length} valid row{preview.rows.length === 1 ? "" : "s"}
            </caption>
            <thead>
              <tr className="border-border border-b">
                <th scope="col" className="py-1 pr-3 font-medium">
                  Code
                </th>
                <th scope="col" className="py-1 font-medium">
                  {kind === "facts" ? "Statement" : "Term"}
                </th>
              </tr>
            </thead>
            <tbody>
              {preview.rows.slice(0, 50).map((r) => (
                <tr key={r.code} className="border-border border-b last:border-0">
                  <td className="py-1 pr-3 font-mono text-xs">{r.code}</td>
                  <td className="py-1">{r.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Button
            onClick={submit}
            disabled={pending || preview.errors.length > 0 || preview.rows.length === 0}
          >
            {pending
              ? "Importing…"
              : `Import ${preview.rows.length} row${preview.rows.length === 1 ? "" : "s"}`}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
