import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

/**
 * Product buttons (DESIGN.md §5): 6px radius, 36px tall, background change over 120ms, no wipe.
 * `default`/`outline`/`destructive` are kept as aliases of `primary`/`secondary`/`danger`.
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border border-transparent text-sm font-medium whitespace-nowrap transition-colors duration-[120ms] outline-none select-none disabled:cursor-not-allowed disabled:opacity-55 data-disabled:cursor-not-allowed data-disabled:opacity-55 aria-invalid:border-danger [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary: "bg-accent text-accent-fg hover:bg-accent-hover",
        default: "bg-accent text-accent-fg hover:bg-accent-hover",
        secondary: "border-control text-fg hover:bg-hover aria-expanded:bg-hover bg-transparent",
        outline: "border-control text-fg hover:bg-hover aria-expanded:bg-hover bg-transparent",
        ghost: "text-fg-muted hover:bg-hover hover:text-fg aria-expanded:bg-hover",
        danger: "border-danger text-danger hover:bg-danger hover:text-canvas bg-transparent",
        destructive: "border-danger text-danger hover:bg-danger hover:text-canvas bg-transparent",
        link: "text-accent-soft h-auto px-0 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-3",
        xs: "h-6 gap-1 rounded-sm px-2 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 px-2.5 text-[0.8125rem] [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 px-4",
        icon: "size-9",
        "icon-xs": "size-6 rounded-sm [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "primary",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
