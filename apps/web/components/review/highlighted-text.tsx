import { cpToUtf16 } from "@/lib/editor/offsets";

type Span = { id: string; start: number; end: number; severity: string; label: string };

/** Read-only version text with finding highlights (worker spans are code points). */
export function HighlightedText({ text, spans }: { text: string; spans: Span[] }) {
  const sorted = spans
    .map((s) => ({ ...s, from: cpToUtf16(text, s.start), to: cpToUtf16(text, s.end) }))
    .filter((s) => s.to > s.from)
    .sort((a, b) => a.from - b.from);
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  for (const s of sorted) {
    if (s.from < cursor) continue; // overlapping highlight: first one wins
    if (s.from > cursor) parts.push(text.slice(cursor, s.from));
    parts.push(
      <mark
        key={s.id}
        id={`hl-${s.id}`}
        className={`finding-hl finding-${s.severity} bg-transparent text-inherit`}
        title={s.label}
      >
        {text.slice(s.from, s.to)}
        <span className="sr-only"> ({s.label})</span>
      </mark>,
    );
    cursor = s.to;
  }
  parts.push(text.slice(cursor));
  return <div className="text-base leading-7 whitespace-pre-wrap">{parts}</div>;
}
