"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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

const area = "w-full rounded-md border border-input bg-card px-3 py-2 text-sm";

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
      <p className="border-success rounded-md border p-3 text-sm">
        <span className="bg-success text-background mr-2 rounded-full px-2 py-0.5 text-xs font-semibold">
          Publish ready
        </span>
        Approved and ready. BrandLens never publishes; see the{" "}
        <a href="#audit" className="underline">
          audit trail
        </a>
        .
      </p>
    );
  }

  const anything = can.review || can.specialist || can.markReady || can.archive;
  if (!anything) {
    return (
      <p className="bg-muted rounded-md p-3 text-sm">
        No decision is waiting on you for this content.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {error ? (
        <p
          role="alert"
          className="border-accent-text text-accent-text rounded-md border p-3 text-sm"
        >
          {error}
        </p>
      ) : null}

      {can.review ? (
        <>
          <section aria-labelledby={`${id}-approve`} className="space-y-2">
            <h3 id={`${id}-approve`} className="font-sans text-sm font-semibold">
              Approve
            </h3>
            {openWarnings.length ? (
              <p className="text-muted-foreground text-xs">
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
            <h3 id={`${id}-esc`} className="font-sans text-sm font-semibold">
              Send to a specialist
            </h3>
            <label htmlFor={`${id}-route`} className="sr-only">
              Specialist
            </label>
            <select
              id={`${id}-route`}
              value={route}
              onChange={(e) => setRoute(e.target.value)}
              className="border-input bg-card h-8 w-full rounded-md border px-2 text-sm"
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
          <h3 id={`${id}-sign`} className="font-sans text-sm font-semibold">
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
          <h3 id={`${id}-changes`} className="font-sans text-sm font-semibold">
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
          <summary className="text-muted-foreground cursor-pointer">Archive</summary>
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
