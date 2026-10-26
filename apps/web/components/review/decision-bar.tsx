"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { StateBadge } from "@/components/brand/state-badge";
import { Button } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/input";
import {
  approve,
  archive,
  escalate,
  markPublishReady,
  requestChanges,
  signOff,
  type ReviewResult,
} from "@/lib/review/actions";

type Props = {
  contentId: string;
  state: string;
  can: { review: boolean; specialist: boolean; markReady: boolean; archive: boolean };
  openWarnings: { id: string; label: string }[];
};

const area = "w-full rounded-md border border-control bg-elevated px-3 py-2 text-sm";

export function DecisionBar({ contentId, state, can, openWarnings }: Props) {
  const id = useId();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [changes, setChanges] = useState("");
  const [signoff, setSignoff] = useState("");
  const [route, setRoute] = useState("legal");
  const [routeWhy, setRouteWhy] = useState("");
  const [archiveWhy, setArchiveWhy] = useState("");
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<ReviewResult>) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        setError(null);
        toast.success(r.message);
        router.refresh();
      } else {
        setError(r.error);
        toast.error(r.error);
      }
    });

  if (state === "publish_ready") {
    return (
      <div className="space-y-2 text-sm">
        <p className="flex flex-wrap items-center gap-3">
          <StateBadge state="publish_ready" className="h-7 px-2.5" />
          <button
            type="button"
            onClick={() =>
              document
                .querySelector<HTMLElement>('[role="tab"][id$="audit"], [role="tab"]:last-child')
                ?.click()
            }
            className="text-accent-soft underline-offset-4 hover:underline"
          >
            Audit trail ↗
          </button>
        </p>
        <p className="text-fg-muted">
          Approved and ready. BrandLens never publishes: post it in your own channel.
        </p>
      </div>
    );
  }

  const anything = can.review || can.specialist || can.markReady || can.archive;
  if (!anything) {
    return (
      <p className="bg-hover rounded-md p-3 text-sm">
        No decision is waiting on you for this content.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {error ? (
        <p role="alert" className="border-danger text-danger rounded-md border p-3 text-sm">
          {error}
        </p>
      ) : null}

      {can.review ? (
        <>
          <section aria-labelledby={`${id}-approve`} className="space-y-2">
            <h3 id={`${id}-approve`} className="mono-label text-fg-faint">
              Approve
            </h3>
            {openWarnings.length ? (
              <p className="text-fg-muted text-xs">
                Each open warning needs an override reason before approval.
              </p>
            ) : null}
            {openWarnings.map((w) => (
              <div key={w.id} className="space-y-1">
                <label htmlFor={`${id}-ov-${w.id}`} className="text-xs font-medium">
                  Override reason for {w.label}
                </label>
                <textarea
                  id={`${id}-ov-${w.id}`}
                  rows={2}
                  className={area}
                  value={overrides[w.id] ?? ""}
                  onChange={(e) => setOverrides((o) => ({ ...o, [w.id]: e.target.value }))}
                />
              </div>
            ))}
            <Button
              disabled={
                pending || openWarnings.some((w) => (overrides[w.id] ?? "").trim().length < 3)
              }
              onClick={() =>
                run(() =>
                  approve({
                    contentId,
                    overrides: openWarnings.map((w) => ({
                      findingId: w.id,
                      reason: overrides[w.id] ?? "",
                    })),
                  }),
                )
              }
            >
              Approve
            </Button>
          </section>
          <section aria-labelledby={`${id}-esc`} className="space-y-2">
            <h3 id={`${id}-esc`} className="mono-label text-fg-faint">
              Send to a specialist
            </h3>
            <label htmlFor={`${id}-route`} className="sr-only">
              Specialist
            </label>
            <select
              id={`${id}-route`}
              value={route}
              onChange={(e) => setRoute(e.target.value)}
              className={fieldClass}
            >
              <option value="legal">Legal</option>
              <option value="a11y">Accessibility</option>
              <option value="brand">Brand</option>
            </select>
            <label htmlFor={`${id}-routewhy`} className="sr-only">
              Why (optional)
            </label>
            <input
              id={`${id}-routewhy`}
              placeholder="Why (optional)"
              value={routeWhy}
              onChange={(e) => setRouteWhy(e.target.value)}
              className={area}
            />
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => run(() => escalate(contentId, route, routeWhy))}
            >
              Send to specialist
            </Button>
          </section>
        </>
      ) : null}

      {can.specialist ? (
        <section aria-labelledby={`${id}-sign`} className="space-y-2">
          <h3 id={`${id}-sign`} className="mono-label text-fg-faint">
            Sign off
          </h3>
          <label htmlFor={`${id}-signwhy`} className="text-xs font-medium">
            Reason (required)
          </label>
          <textarea
            id={`${id}-signwhy`}
            rows={2}
            className={area}
            value={signoff}
            onChange={(e) => setSignoff(e.target.value)}
          />
          <Button
            disabled={pending || signoff.trim().length < 3}
            onClick={() => run(() => signOff(contentId, signoff))}
          >
            Sign off
          </Button>
        </section>
      ) : null}

      {can.review || can.specialist ? (
        <section aria-labelledby={`${id}-changes`} className="space-y-2">
          <h3 id={`${id}-changes`} className="mono-label text-fg-faint">
            Request changes
          </h3>
          <label htmlFor={`${id}-changeswhy`} className="text-xs font-medium">
            What needs to change (required)
          </label>
          <textarea
            id={`${id}-changeswhy`}
            rows={2}
            className={area}
            value={changes}
            onChange={(e) => setChanges(e.target.value)}
          />
          <Button
            variant="outline"
            disabled={pending || changes.trim().length < 3}
            onClick={() => run(() => requestChanges(contentId, changes))}
          >
            Request changes
          </Button>
        </section>
      ) : null}

      {can.markReady ? (
        <Button disabled={pending} onClick={() => run(() => markPublishReady(contentId))}>
          Mark publish-ready
        </Button>
      ) : null}

      {can.archive ? (
        <details className="text-sm">
          <summary className="text-fg-muted cursor-pointer">Archive</summary>
          <div className="mt-2 space-y-2">
            <label htmlFor={`${id}-arch`} className="text-xs font-medium">
              Reason
            </label>
            <input
              id={`${id}-arch`}
              value={archiveWhy}
              onChange={(e) => setArchiveWhy(e.target.value)}
              className={area}
            />
            <Button
              variant="destructive"
              size="sm"
              disabled={pending}
              onClick={() => run(() => archive(contentId, archiveWhy))}
            >
              Archive content
            </Button>
          </div>
        </details>
      ) : null}
    </div>
  );
}
