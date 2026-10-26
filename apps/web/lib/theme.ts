import "server-only";
import { cookies } from "next/headers";
import { THEME_COOKIE, type ThemeChoice } from "@/lib/ui-prefs";

/** The visitor's theme choice; `system` follows the OS (dark when it has no preference). */
export async function getThemeChoice(): Promise<ThemeChoice> {
  const v = (await cookies()).get(THEME_COOKIE)?.value;
  return v === "dark" || v === "light" ? v : "system";
}
