import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Marketing link-buttons (DESIGN.md §7.1): 48px, the product button variants, arrow on primary. */
export function Cta({
  href,
  children,
  variant = "primary",
  external = false,
  className,
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "highlight" | "outline" | "inverse";
  external?: boolean;
  className?: string;
}) {
  const cls = cn(buttonVariants({ variant, size: "lg" }), "group", className);
  const inner = (
    <>
      {children}
      {variant === "primary" || variant === "inverse" ? (
        <ArrowRight
          aria-hidden
          className="size-4 transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none"
        />
      ) : null}
    </>
  );
  return external ? (
    <a href={href} className={cls} target="_blank" rel="noreferrer">
      {inner}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  ) : (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  );
}
