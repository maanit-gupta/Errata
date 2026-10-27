import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env";

/** Sidebar "● worker ok" (DESIGN.md §6.0): proxies the worker's /healthz with a short timeout. */
export async function GET() {
  const base = serverEnv().WORKER_URL;
  if (!base) return NextResponse.json({ status: "unknown" });
  try {
    const res = await fetch(new URL("/healthz", base), {
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    return NextResponse.json({ status: res.ok ? "ok" : "down" });
  } catch {
    return NextResponse.json({ status: "down" });
  }
}
