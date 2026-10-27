import { z } from "zod";
import type { createClient } from "@/lib/supabase/server";
import { SIGNED_URL_TTL_S } from "@/lib/limits";

/** `review_runs.pages` (P12): one rendered thumbnail per PDF page; finding boxes are in its pixels. */
const manifest = z.array(
  z.object({
    n: z.number().int().positive(),
    width: z.number().positive(),
    height: z.number().positive(),
    path: z.string().min(1),
  }),
);

export type PdfPageView = { n: number; width: number; height: number; src: string };

/** Signed, short-lived URLs for a run's page renders (private `renders` bucket, SPEC §3). */
export async function signedPages(
  supabase: Awaited<ReturnType<typeof createClient>>,
  pages: unknown,
): Promise<PdfPageView[]> {
  const parsed = manifest.safeParse(pages);
  if (!parsed.success || !parsed.data.length) return [];
  const { data } = await supabase.storage.from("renders").createSignedUrls(
    parsed.data.map((p) => p.path),
    SIGNED_URL_TTL_S,
  );
  const url = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
  return parsed.data.flatMap((p) => {
    const src = url.get(p.path);
    return src ? [{ n: p.n, width: p.width, height: p.height, src }] : [];
  });
}
