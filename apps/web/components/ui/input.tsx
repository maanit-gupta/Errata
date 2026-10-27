import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";
import { cn } from "cn";

/** Text input (DESIGN.md §2): 1px `--border-control` outline (3:1, WCAG 1.4.11), 6px radius. */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "border-control text-fg placeholder:text-fg-faint file:text-fg aria-invalid:border-danger h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-sm transition-colors file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:cursor-not-allowed disabled:opacity-55",
        className,
      )}
      {...props}
    />
  );
}

/** Shared class for native <textarea>/<select> so they match Input. */
export const fieldClass =
  "border-control text-fg placeholder:text-fg-faint aria-invalid:border-danger w-full rounded-md border bg-transparent px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-55 [&>option]:bg-elevated";

export { Input };
