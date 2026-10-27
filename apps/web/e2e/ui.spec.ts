import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "@playwright/test";
import { expectNoSeriousA11yViolations, setTheme, signInAsDemo, type Theme } from "./helpers";

/**
 * UI gate (DESIGN.md §7.5, §12): axe on every product route, in both themes, with zero serious or
 * critical violations. With SCREENS=<phase>, also saves full-page screenshots to
 * docs/screens/<phase>/ for the README and the judges.
 *
 * Read-only: it only visits pages. Needs `make dev-web-local` against a seeded DB.
 */

type Route = {
  name: string;
  path: string | ((page: import("@playwright/test").Page) => Promise<string>);
  role: string | null;
};

const firstLink = (prefix: string) => async (page: import("@playwright/test").Page) => {
  await page.goto(prefix);
  await page.waitForLoadState("networkidle").catch(() => {});
  const links = page.locator(`main a[href^="${prefix}/"]:not([href$="/new"])`);
  // An empty DB (fresh `make db-reset`) has nothing to open: audit the list page instead.
  if ((await links.count()) === 0) return prefix;
  return (await links.first().getAttribute("href")) ?? prefix;
};

const ROUTES: Route[] = [
  { name: "kitchen-sink", path: "/dev/kitchen-sink", role: null },
  { name: "landing", path: "/", role: null },
  { name: "ai-use-public", path: "/ai-use", role: null },
  { name: "login", path: "/login", role: null },
  { name: "drafts", path: "/drafts", role: "Creator" },
  { name: "draft-new", path: "/drafts/new", role: "Creator" },
  { name: "draft-detail", path: firstLink("/drafts"), role: "Creator" },
  { name: "review", path: "/review", role: "Brand admin" },
  { name: "review-detail", path: firstLink("/review"), role: "Brand admin" },
  { name: "vault-rules", path: "/vault?tab=rules", role: "Brand admin" },
  { name: "vault-facts", path: "/vault?tab=facts", role: "Brand admin" },
  { name: "vault-glossary", path: "/vault?tab=glossary", role: "Brand admin" },
  { name: "vault-campaigns", path: "/vault?tab=campaigns", role: "Brand admin" },
  { name: "vault-assets", path: "/vault?tab=assets", role: "Brand admin" },
  { name: "vault-guides", path: "/vault?tab=guides", role: "Brand admin" },
  { name: "insights", path: "/insights", role: "Brand admin" },
  { name: "audit", path: "/audit", role: "Brand admin" },
  { name: "settings", path: "/settings", role: "Brand admin" },
  { name: "ai-use", path: "/settings/ai-use", role: "Brand admin" },
];

const only = process.env.UI_ROUTES?.split(",");
const phase = process.env.SCREENS;

for (const theme of ["dark", "light"] as Theme[]) {
  for (const r of ROUTES.filter((x) => !only || only.includes(x.name))) {
    test(`${r.name} · ${theme}: no serious a11y violations`, async ({ page, context, baseURL }) => {
      test.setTimeout(90_000);
      await setTheme(context, baseURL!, theme);
      await page.emulateMedia({ reducedMotion: "reduce" });
      if (r.role) await signInAsDemo(page, r.role);
      const path = typeof r.path === "string" ? r.path : await r.path(page);
      await page.goto(path);
      await page.waitForLoadState("networkidle").catch(() => {});
      await expectNoSeriousA11yViolations(page, `${r.name}/${theme}`);
      if (phase) {
        const dir = join(__dirname, "../../../docs/screens", phase);
        mkdirSync(dir, { recursive: true });
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.screenshot({ path: join(dir, `${r.name}-${theme}.png`), fullPage: true });
      }
    });
  }
}
