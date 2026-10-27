"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Ctx = { label: string | null; set: (label: string | null) => void };
const CrumbContext = createContext<Ctx>({ label: null, set: () => {} });

export function CrumbProvider({ children }: { children: ReactNode }) {
  const [label, set] = useState<string | null>(null);
  return <CrumbContext.Provider value={{ label, set }}>{children}</CrumbContext.Provider>;
}

/** Detail pages name their last breadcrumb, e.g. the draft title. */
export function SetCrumb({ label }: { label: string }) {
  const { set } = useContext(CrumbContext);
  useEffect(() => {
    set(label);
    return () => set(null);
  }, [label, set]);
  return null;
}

export function useCrumbLabel() {
  return useContext(CrumbContext).label;
}
