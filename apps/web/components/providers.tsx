"use client";

import type { ReactNode } from "react";
import { HintProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: ReactNode }) {
  return <HintProvider delay={300}>{children}</HintProvider>;
}
