import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

/**
 * Buttons (DESIGN.md §7.1): flat, 4px radius, no shadow. `primary` is solid ink, `highlight` is
 * the yellow button with an ink outline, `secondary`/`outline` are ink-outlined, `ghost` is bare.
 * Focus uses the global 2px outline (never a ring). `default`/`destructive` alias primary/danger.
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-sm border-2 border-transparent text-sm font-semibold whitespace-nowrap transition-colors duration-100 select-none disabled:cursor-not-allowed disabled:opacity-50 data-disabled:cursor-not-allowed data-disabled:opacity-50 aria-invalid:border-danger [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary: "bg-accent text-accent-fg hover:bg-accent-hover",
        default: "bg-accent text-accent-fg hover:bg-accent-hover",
        highlight:
          "border-outline bg-highlight text-highlight-fg hover:bg-accent hover:text-accent-fg",
        secondary: "border-outline text-fg hover:bg-hover aria-expanded:bg-hover bg-transparent",
        outline: "border-outline text-fg hover:bg-hover aria-expanded:bg-hover bg-transparent",
        ghost: "text-fg hover:bg-hover aria-expanded:bg-hover",
        /** On an ink surface (the featured card): page-coloured fill, ink text. */
        inverse: "bg-canvas text-fg hover:bg-highlight hover:text-highlight-fg",
        danger: "border-danger text-danger hover:bg-danger hover:text-canvas bg-transparent",
        destructive: "border-danger text-danger hover:bg-danger hover:text-canvas bg-transparent",
        link: "text-fg h-auto border-0 px-0 underline underline-offset-4 hover:decoration-2",
      },
      size: {
        default: "h-10 px-4",
        xs: "h-7 gap-1 px-2 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 px-3 text-[0.8125rem] [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-12 px-5 text-[0.9375rem]",
        icon: "size-10",
        "icon-xs": "size-7 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-12",
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
