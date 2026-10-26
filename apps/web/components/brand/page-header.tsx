import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  /** Small mono label above the title, e.g. "VAULT · RULE CARDS". */
  eyebrow?: string;
  description?: ReactNode;
  actions?: ReactNode;
  /** Chips beside the title (state, risk, illustrative-data pill). */
  meta?: ReactNode;
};

/** Product page title (DESIGN.md §2.5): 32px, weight 400, mono eyebrow. */
export function PageHeader({ title, eyebrow, description, actions, meta }: PageHeaderProps) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 space-y-1.5">
        {eyebrow ? <p className="mono-label text-fg-faint">{eyebrow}</p> : null}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[2rem] leading-[1.15] tracking-[-0.015em]">{title}</h1>
          {meta}
        </div>
        {description ? <div className="text-fg-muted max-w-2xl text-sm">{description}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
