"use client";

import { MoreHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/brand/modal";
import { StateBadge } from "@/components/brand/state-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

type Open = null | "override" | "escalate" | "signoff" | "changes" | "archive";

const area = "w-full rounded-sm border-2 border-control bg-canvas px-3 py-2 text-sm";
const MIN_REASON = 3;

/**
 * DecisionBar (DESIGN.md §6.5): a sticky row of actions; each one that needs a reason opens its
 * own dialog. Approve with open warnings opens "Override with rationale" with one required reason
 * per warning. Archive lives in the overflow menu behind a confirm dialog.
 */
export function DecisionBar({ contentId, state, can, openWarnings }: Props) {
  const id = useId();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState<Open>(null);
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
        setOpen(null);
        toast.success(r.message);
        router.refresh();
      } else {
        setOpen(null);
        setError(r.error);
        toast.error(r.error);
      }
    });

  const dialog = (which: Exclude<Open, null>) => ({
    open: open === which,
    onOpenChange: (o: boolean) => setOpen(o ? which : null),
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
            className="text-accent-soft font-semibold underline underline-offset-4"
          >
            Audit trail ↗
          </button>
        </p>
        <p className="text-fg-muted">
          Approved and ready. Errata never publishes: post it in your own channel.
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

  const overridesReady = openWarnings.every(
    (w) => (overrides[w.id] ?? "").trim().length >= MIN_REASON,
  );
  const doApprove = () =>
    run(() =>
      approve({
        contentId,
        overrides: openWarnings.map((w) => ({ findingId: w.id, reason: overrides[w.id] ?? "" })),
      }),
    );

  return (
    <div className="space-y-3">
      {error ? (
        <p role="alert" className="border-danger text-danger rounded-lg border-2 p-3 text-sm">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {can.review ? (
          <Button
            disabled={pending}
            onClick={() => (openWarnings.length ? setOpen("override") : doApprove())}
          >
            Approve
          </Button>
        ) : null}
        {can.specialist ? (
          <Button disabled={pending} onClick={() => setOpen("signoff")}>
            Sign off
          </Button>
        ) : null}
        {can.markReady ? (
          <Button disabled={pending} onClick={() => run(() => markPublishReady(contentId))}>
            Mark publish-ready
          </Button>
        ) : null}
        {can.review || can.specialist ? (
          <Button variant="outline" disabled={pending} onClick={() => setOpen("changes")}>
            Request changes
          </Button>
        ) : null}
        {can.review ? (
          <Button variant="ghost" disabled={pending} onClick={() => setOpen("escalate")}>
            Send to specialist
          </Button>
        ) : null}
        {can.archive ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon" aria-label="More decisions" />}
            >
              <MoreHorizontal aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem variant="destructive" onClick={() => setOpen("archive")}>
                Archive…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        {openWarnings.length && can.review ? (
          <p className="text-fg-muted text-xs">
            {openWarnings.length} open warning{openWarnings.length === 1 ? "" : "s"} need an
            override reason to approve.
          </p>
        ) : null}
      </div>

      <Modal
        {...dialog("override")}
        title="Override with rationale"
        description="Each open warning needs a reason. Overrides are audited and feed the rule's clarity score."
        confirm={
          <Button disabled={pending || !overridesReady} focusableWhenDisabled onClick={doApprove}>
            Approve with overrides
          </Button>
        }
      >
        <div className="space-y-3">
          {openWarnings.map((w) => (
            <div key={w.id} className="space-y-1">
              <label htmlFor={`${id}-ov-${w.id}`} className="text-sm font-medium">
                Override reason for {w.label}
              </label>
              <textarea
                id={`${id}-ov-${w.id}`}
                rows={2}
                required
                className={area}
                value={overrides[w.id] ?? ""}
                onChange={(e) => setOverrides((o) => ({ ...o, [w.id]: e.target.value }))}
              />
            </div>
          ))}
        </div>
      </Modal>

      <Modal
        {...dialog("signoff")}
        title="Sign off"
        description="Your sign-off moves this content to Approved and is recorded in the audit trail."
        confirm={
          <Button
            disabled={pending || signoff.trim().length < MIN_REASON}
            focusableWhenDisabled
            onClick={() => run(() => signOff(contentId, signoff))}
          >
            Confirm sign-off
          </Button>
        }
      >
        <div className="space-y-1">
          <label htmlFor={`${id}-signwhy`} className="text-sm font-medium">
            Reason (required)
          </label>
          <textarea
            id={`${id}-signwhy`}
            rows={3}
            required
            className={area}
            value={signoff}
            onChange={(e) => setSignoff(e.target.value)}
          />
        </div>
      </Modal>

      <Modal
        {...dialog("changes")}
        title="Request changes"
        description="The creator gets this note and the content goes back to them as Needs revision."
        confirm={
          <Button
            disabled={pending || changes.trim().length < MIN_REASON}
            focusableWhenDisabled
            onClick={() => run(() => requestChanges(contentId, changes))}
          >
            Send request
          </Button>
        }
      >
        <div className="space-y-1">
          <label htmlFor={`${id}-changeswhy`} className="text-sm font-medium">
            What needs to change (required)
          </label>
          <textarea
            id={`${id}-changeswhy`}
            rows={3}
            required
            className={area}
            value={changes}
            onChange={(e) => setChanges(e.target.value)}
          />
        </div>
      </Modal>

      <Modal
        {...dialog("escalate")}
        title="Send to a specialist"
        description="Routes this content to a specialist queue. They sign off or request changes."
        confirm={
          <Button
            disabled={pending}
            onClick={() => run(() => escalate(contentId, route, routeWhy))}
          >
            Send
          </Button>
        }
      >
        <div className="space-y-3">
          <div className="space-y-1">
            <label htmlFor={`${id}-route`} className="text-sm font-medium">
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
          </div>
          <div className="space-y-1">
            <label htmlFor={`${id}-routewhy`} className="text-sm font-medium">
              Why (optional)
            </label>
            <input
              id={`${id}-routewhy`}
              value={routeWhy}
              onChange={(e) => setRouteWhy(e.target.value)}
              className={area}
            />
          </div>
        </div>
      </Modal>

      <Modal
        {...dialog("archive")}
        title="Archive this content?"
        description="Archived content leaves every queue. The audit trail is kept."
        confirm={
          <Button
            variant="danger"
            disabled={pending}
            onClick={() => run(() => archive(contentId, archiveWhy))}
          >
            Archive content
          </Button>
        }
      >
        <div className="space-y-1">
          <label htmlFor={`${id}-arch`} className="text-sm font-medium">
            Reason
          </label>
          <input
            id={`${id}-arch`}
            value={archiveWhy}
            onChange={(e) => setArchiveWhy(e.target.value)}
            className={area}
          />
        </div>
      </Modal>
    </div>
  );
}
