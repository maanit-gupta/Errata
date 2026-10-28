"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { addComment } from "@/lib/review/actions";

export type CommentView = {
  id: string;
  author: string;
  body: string;
  at: string;
  findingLabel: string | null;
};

/** Render @Display Name mentions of org members as chips. */
function withMentions(body: string, names: string[]) {
  if (!names.length) return body;
  const escaped = names
    .sort((a, b) => b.length - a.length)
    .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`@(${escaped.join("|")})`, "g");
  const out: React.ReactNode[] = [];
  let last = 0;
  for (const m of body.matchAll(re)) {
    out.push(body.slice(last, m.index));
    out.push(
      <span key={m.index} className="bg-hover rounded-full px-1.5 py-0.5 text-xs font-medium">
        @{m[1]}
      </span>,
    );
    last = (m.index ?? 0) + m[0].length;
  }
  out.push(body.slice(last));
  return out;
}

export function Comments({
  contentId,
  versionId,
  comments,
  members,
  findings,
}: {
  contentId: string;
  versionId: string;
  comments: CommentView[];
  members: string[];
  findings: { id: string; label: string }[];
}) {
  const id = useId();
  const router = useRouter();
  const [body, setBody] = useState("");
  const [findingId, setFindingId] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="space-y-4">
      <ul className="space-y-3" aria-live="polite">
        {comments.map((c) => (
          <li key={c.id} className="border-outline bg-elevated rounded-lg border-2 p-3 text-sm">
            <p className="text-fg-muted mb-1 text-xs">
              <span className="text-fg font-medium">{c.author}</span> ·{" "}
              {new Date(c.at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
              {c.findingLabel ? (
                <>
                  {" "}
                  · on <span className="font-mono">{c.findingLabel}</span>
                </>
              ) : null}
            </p>
            <p className="whitespace-pre-wrap">{withMentions(c.body, members)}</p>
          </li>
        ))}
        {comments.length ? null : <li className="text-fg-muted text-sm">No comments yet.</li>}
      </ul>
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await addComment({
              contentId,
              versionId,
              body,
              findingId: findingId || undefined,
            });
            if (!r.ok) toast.error(r.error);
            else {
              setBody("");
              router.refresh();
            }
          });
        }}
      >
        <label htmlFor={`${id}-body`} className="text-sm font-medium">
          Add a comment
        </label>
        <textarea
          id={`${id}-body`}
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Use @Name to mention a teammate"
          className="border-control bg-elevated w-full rounded-sm border-2 px-3 py-2 text-sm"
        />
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={`${id}-anchor`} className="text-sm">
            About
          </label>
          <select
            id={`${id}-anchor`}
            value={findingId}
            onChange={(e) => setFindingId(e.target.value)}
            className="border-control bg-elevated h-8 rounded-sm border-2 px-2 text-sm"
          >
            <option value="">The whole version</option>
            {findings.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
          <Button type="submit" size="sm" disabled={pending || !body.trim()}>
            Comment
          </Button>
        </div>
      </form>
    </div>
  );
}
