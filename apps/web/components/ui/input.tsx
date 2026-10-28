import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";
import { cn } from "cn";

/** Text input (DESIGN.md §7.2): 2px ink outline, 4px radius, 40px tall. */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "border-control bg-elevated text-fg placeholder:text-fg-faint file:text-fg aria-invalid:border-danger h-10 w-full min-w-0 rounded-sm border-2 px-3 py-1 text-[0.9375rem] transition-colors file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-semibold disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

/** Shared class for native <textarea>/<select> so they match Input. */
export const fieldClass =
  "border-control bg-elevated text-fg placeholder:text-fg-faint aria-invalid:border-danger min-h-10 w-full rounded-sm border-2 px-3 py-2 text-[0.9375rem] disabled:cursor-not-allowed disabled:opacity-50 [&>option]:bg-elevated";

export { Input };
