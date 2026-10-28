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

/** Product page title (DESIGN.md §4): 32px/600, optional sans eyebrow and one-line description. */
export function PageHeader({ title, eyebrow, description, actions, meta }: PageHeaderProps) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 space-y-1.5">
        {eyebrow ? <p className="label text-fg-muted">{eyebrow}</p> : null}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[2rem] leading-[1.15] font-semibold tracking-[-0.02em]">{title}</h1>
          {meta}
        </div>
        {description ? (
          <div className="text-fg-muted max-w-2xl text-[0.9375rem]">{description}</div>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
