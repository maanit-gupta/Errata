import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  /** Small mono label above the title, e.g. "VAULT · RULE CARDS". */
  eyebrow?: string;
  description?: ReactNode;
  actions?: ReactNode;
};

export function PageHeader({ title, eyebrow, description, actions }: PageHeaderProps) {
  return (
    <header className="border-rule mb-8 flex flex-wrap items-end justify-between gap-4 border-b pb-6">
      <div className="space-y-1.5">
        {eyebrow ? (
          <p className="text-muted-foreground font-mono text-xs tracking-wider uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-heading text-3xl leading-tight sm:text-4xl">{title}</h1>
        {description ? <div className="text-muted-foreground max-w-2xl">{description}</div> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}
