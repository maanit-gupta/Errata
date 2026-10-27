/** Mirrors apps/worker/brandlens_worker/config.py (SPEC §14). */
export const MAX_WORDS = 2000;
export const PDF_MAX_PAGES = 40;

export function countWords(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}
