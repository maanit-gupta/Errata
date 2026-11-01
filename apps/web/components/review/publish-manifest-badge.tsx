import { ShieldAlert, ShieldCheck } from "lucide-react";

export type ManifestView = {
  hash: string | null;
  hashOf: string;
  facts: { code: string; valid_until: string | null }[];
  validUntil: string | null;
  issuedAt: string;
  revokedAt: string | null;
  revokedReason: string | null;
};

export type KillSwitchView = { factCode: string; cause: string; at: string };

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" });

/**
 * Hero 2: the publish-ready receipt (SHA-256 of the approved text, the facts it relies on, the
 * earliest expiry) and the fact kill-switch. Renders nothing when there's neither.
 */
export function PublishManifestBadge({
  manifest,
  killSwitch,
  error,
}: {
  manifest: ManifestView | null;
  killSwitch: KillSwitchView | null;
  error?: boolean;
}) {
  if (error)
    return <p className="text-fg-faint text-xs">Couldn&apos;t load the publish receipt.</p>;
  if (manifest && !manifest.revokedAt) {
    const until = manifest.validUntil ? day(manifest.validUntil) : null;
    const first = manifest.facts.find((f) => f.valid_until === manifest.validUntil)?.code;
    return (
      <details className="border-outline bg-elevated inline-block rounded-sm border-2 px-2 py-1 text-xs">
        <summary className="flex cursor-pointer items-center gap-1.5">
          <ShieldCheck aria-hidden className="text-success size-3.5" />
          <span className="font-semibold">Publish receipt</span>
          <span className="mono-id">
            {manifest.hash ? `${manifest.hash.slice(0, 12)}…` : "file"}
          </span>
          {until ? (
            <span className="text-fg-muted">
              · valid until {until}
              {first ? ` (${first})` : ""}
            </span>
          ) : null}
        </summary>
        <dl className="mt-2 grid grid-cols-[7rem_1fr] gap-x-2 gap-y-1">
          <dt className="text-fg-faint">SHA-256</dt>
          <dd className="mono-id break-all">{manifest.hash ?? "none (file version)"}</dd>
          <dt className="text-fg-faint">Hash of</dt>
          <dd>{manifest.hashOf}</dd>
          <dt className="text-fg-faint">Facts</dt>
          <dd className="mono-id">{manifest.facts.map((f) => f.code).join(", ") || "none"}</dd>
          <dt className="text-fg-faint">Issued</dt>
          <dd>{day(manifest.issuedAt)}</dd>
        </dl>
        <p className="text-fg-faint mt-1">
          If one of these facts changes or expires, this content goes back to revision on its own.
        </p>
      </details>
    );
  }
  const reason =
    manifest?.revokedReason ??
    (killSwitch ? `Fact ${killSwitch.factCode} ${killSwitch.cause} after approval.` : null);
  if (!reason) return null;
  return (
    <p
      role="status"
      className="bg-warning-bg border-warning inline-flex items-center gap-1.5 rounded-sm border-2 px-2 py-1 text-xs"
    >
      <ShieldAlert aria-hidden className="text-warning size-3.5" />
      <span>
        <span className="font-semibold">Approval revoked.</span> {reason}
      </span>
    </p>
  );
}
