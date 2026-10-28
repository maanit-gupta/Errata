"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Upload, X } from "lucide-react";
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
  const [open, setOpen] = useState(false);

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
      setOpen(false);
      router.refresh();
    });
  }

  const step = !preview ? 1 : pending ? 3 : 2;
  const downloadErrors = () => {
    if (!preview?.errors.length) return;
    const csv = [
      "line,message",
      ...preview.errors.map((e) => `${e.line},"${e.message.replace(/"/g, '""')}"`),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${kind}-import-errors.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setFile(null);
          setPreview(null);
        }
      }}
    >
      <Dialog.Trigger render={<Button variant="secondary" className="mb-4" />}>
        <Upload aria-hidden /> Import {kind === "facts" ? "facts" : "glossary"} CSV
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="bg-overlay fixed inset-0 z-40" />
        <Dialog.Popup className="bg-elevated border-line-strong shadow-pop fixed top-1/2 left-1/2 z-50 max-h-[85vh] w-[min(44rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-md border outline-none">
          <header className="border-line flex items-start gap-3 border-b px-5 py-4">
            <div className="flex-1 space-y-2">
              <ol className="mono-label flex gap-3" aria-label="Import steps">
                {["Upload", "Preview", "Import"].map((label, i) => (
                  <li
                    key={label}
                    aria-current={step === i + 1 ? "step" : undefined}
                    className={step === i + 1 ? "text-accent-soft" : "text-fg-faint"}
                  >
                    0{i + 1} {label}
                  </li>
                ))}
              </ol>
              <Dialog.Title className="text-xl">
                Import {kind === "facts" ? "facts" : "glossary"} from CSV
              </Dialog.Title>
            </div>
            <Dialog.Close
              aria-label="Close"
              className="text-fg-muted hover:bg-hover inline-flex size-8 items-center justify-center rounded-md"
            >
              <X aria-hidden className="size-4" />
            </Dialog.Close>
          </header>
          <div className="space-y-4 px-5 py-4">
            <Dialog.Description className="text-fg-muted text-sm">
              {kind === "facts"
                ? "Columns: code, campaign, kind, statement, value_json, required_disclaimer, valid_until, never_send."
                : "Columns: code, preferred, variants (separated by |), banned, case_sensitive, note."}{" "}
              Rows with the same code are updated. A file with any invalid row isn&apos;t imported.
            </Dialog.Description>
            <div className="border-control rounded-md border border-dashed p-4">
              <label htmlFor={`${id}-file`} className="text-sm font-medium">
                CSV file
              </label>
              <input
                id={`${id}-file`}
                type="file"
                accept=".csv,text/csv"
                className="file:border-control file:text-fg mt-2 block text-sm file:mr-3 file:rounded-md file:border file:bg-transparent file:px-3 file:py-1.5"
                onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
              />
            </div>

            {preview ? (
              <div className="space-y-3" aria-live="polite">
                {preview.errors.length ? (
                  <div role="alert" className="border-danger rounded-md border p-3">
                    <p className="text-danger mb-1 text-sm font-medium">
                      {preview.errors.length} row{preview.errors.length === 1 ? "" : "s"} can&apos;t
                      be imported. Fix the file and choose it again.
                    </p>
                    <ul className="list-disc pl-5 text-sm">
                      {preview.errors.map((e) => (
                        <li key={`${e.line}-${e.message}`}>
                          <span className="mono-id">row {e.line}</span>: {e.message}
                        </li>
                      ))}
                    </ul>
                    <Button variant="link" size="sm" onClick={downloadErrors}>
                      Download error report
                    </Button>
                  </div>
                ) : null}
                <div className="border-line max-h-64 overflow-y-auto rounded-md border">
                  <table className="w-full text-left text-sm">
                    <caption className="text-fg-muted px-3 py-2 text-left text-sm">
                      Preview: {preview.rows.length} valid row{preview.rows.length === 1 ? "" : "s"}
                    </caption>
                    <thead className="bg-canvas">
                      <tr className="border-line border-y">
                        <th
                          scope="col"
                          className="mono-label text-fg-faint px-3 py-1.5 font-medium"
                        >
                          Code
                        </th>
                        <th
                          scope="col"
                          className="mono-label text-fg-faint px-3 py-1.5 font-medium"
                        >
                          {kind === "facts" ? "Statement" : "Term"}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.slice(0, 50).map((r) => (
                        <tr key={r.code} className="border-line border-b last:border-0">
                          <td className="mono-id text-accent-soft px-3 py-1.5">{r.code}</td>
                          <td className="px-3 py-1.5">{r.summary}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>
          <footer className="border-line flex justify-end gap-2 border-t px-5 py-3">
            <Dialog.Close render={<Button variant="ghost" />}>Cancel</Dialog.Close>
            <Button
              onClick={submit}
              disabled={
                !preview || pending || preview.errors.length > 0 || preview.rows.length === 0
              }
            >
              {pending
                ? "Importing…"
                : preview
                  ? `Import ${preview.rows.length} row${preview.rows.length === 1 ? "" : "s"}`
                  : "Import"}
            </Button>
          </footer>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
