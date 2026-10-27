import { diffWords } from "diff";

type Resolved = { id: string; codes: string; quote: string; status: string };

/** Word diff between the previous and current versions, plus the findings the changes resolved. */
export function VersionDiff({
  previous,
  current,
  resolved,
  previousN,
  currentN,
}: {
  previous: string;
  current: string;
  resolved: Resolved[];
  previousN: number;
  currentN: number;
}) {
  const parts = diffWords(previous, current);
  return (
    <div className="space-y-3">
      <p className="text-fg-muted text-sm">
        Version {previousN} → version {currentN}.{" "}
        <span className="text-fg font-medium">Removed</span> text is struck through;{" "}
        <span className="text-fg font-medium">added</span> text is underlined.
      </p>
      <p className="border-line bg-code rounded-md border p-4 leading-7 whitespace-pre-wrap">
        {parts.map((p, i) =>
          p.added ? (
            <ins key={i} className="bg-success-bg decoration-success underline decoration-2">
              <span aria-hidden className="text-success font-mono text-xs">
                +
              </span>
              {p.value}
            </ins>
          ) : p.removed ? (
            <del key={i} className="bg-blocker-bg text-fg-muted decoration-blocker">
              <span aria-hidden className="text-blocker font-mono text-xs">
                −
              </span>
              {p.value}
            </del>
          ) : (
            <span key={i}>{p.value}</span>
          ),
        )}
      </p>
      {resolved.length ? (
        <div>
          <h3 className="mono-label text-fg-faint mb-1.5">Findings these changes resolved</h3>
          <ul className="space-y-1 text-sm">
            {resolved.map((r) => (
              <li key={r.id}>
                <span className="mono-id text-accent-soft">resolves {r.codes}</span> “{r.quote}” ·{" "}
                <span className="text-fg-muted">{r.status}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
