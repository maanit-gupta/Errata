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
      <p className="text-muted-foreground text-sm">
        Version {previousN} → version {currentN}.{" "}
        <span className="text-foreground font-medium">Removed</span> text is struck through;{" "}
        <span className="text-foreground font-medium">added</span> text is underlined.
      </p>
      <p className="border-border bg-card rounded-md border p-3 leading-7 whitespace-pre-wrap">
        {parts.map((p, i) =>
          p.added ? (
            <ins key={i} className="bg-success/15 decoration-success underline decoration-2">
              {p.value}
            </ins>
          ) : p.removed ? (
            <del key={i} className="bg-blocker/10 text-muted-foreground decoration-accent-text">
              {p.value}
            </del>
          ) : (
            <span key={i}>{p.value}</span>
          ),
        )}
      </p>
      {resolved.length ? (
        <div>
          <h3 className="mb-1 font-sans text-sm font-medium">Findings these changes resolved</h3>
          <ul className="space-y-1 text-sm">
            {resolved.map((r) => (
              <li key={r.id}>
                <span className="font-mono text-xs">{r.codes}</span> “{r.quote}” ·{" "}
                <span className="text-muted-foreground">{r.status}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
