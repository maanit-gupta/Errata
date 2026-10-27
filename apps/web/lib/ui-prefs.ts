/** Cookie names for per-browser UI preferences (DESIGN.md §6.0, §7.4, §8). */
export const THEME_COOKIE = "bl_theme";
export const SIDEBAR_COOKIE = "bl_sidebar";
export const TIPCARD_COOKIE = "bl_tipcard";
export const FLASH_COOKIE = "bl_flash";
export const SKIP_LANDING_COOKIE = "bl_skip_landing";
export const ANNOUNCE_COOKIE = "bl_announce";
export const SHORTCUTS_KEY = "bl_shortcuts";

export type ThemeChoice = "dark" | "light" | "system";

const YEAR = 60 * 60 * 24 * 365;

/** Client-side cookie write (preferences only; nothing sensitive). */
export function setPrefCookie(name: string, value: string, maxAge = YEAR) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; samesite=lax`;
}

/** Apply a theme choice to <html> immediately and remember it. */
export function applyTheme(choice: ThemeChoice) {
  const root = document.documentElement;
  if (choice === "system") delete root.dataset.theme;
  else root.dataset.theme = choice;
  setPrefCookie(THEME_COOKIE, choice);
  window.dispatchEvent(new CustomEvent("bl-theme", { detail: choice }));
}

/** Whether single-key shortcuts are on (WCAG 2.1.4: they can be turned off). */
export function shortcutsEnabled(): boolean {
  try {
    return localStorage.getItem(SHORTCUTS_KEY) !== "off";
  } catch {
    return true;
  }
}
