"use client";

import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import type { ReactElement, ReactNode } from "react";

/**
 * Supplementary hover/focus hint. Never the only place important information lives: disabled
 * actions also render their reason inline or via aria-describedby (DESIGN.md §5 Button).
 */
export function Hint({
  content,
  children,
  side = "top",
}: {
  content: ReactNode;
  /** A single focusable element. */
  children: ReactElement;
  side?: "top" | "bottom" | "left" | "right";
}) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger render={children} />
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Positioner side={side} sideOffset={6} className="z-50">
          <TooltipPrimitive.Popup className="bg-elevated text-fg border-line-strong shadow-pop max-w-xs rounded-md border px-2.5 py-1.5 text-xs leading-snug">
            {content}
          </TooltipPrimitive.Popup>
        </TooltipPrimitive.Positioner>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

export const HintProvider = TooltipPrimitive.Provider;
