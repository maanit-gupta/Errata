import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// P15 accessibility sweep: axe (WCAG 2.2 AA tags) on every main page, light and dark, for the
// role that sees the most of the app plus a reviewer. Needs the app running in demo mode.

const PAGES: Record<string, string[]> = {
  "Brand admin": ["/drafts", "/review", "/vault", "/insights", "/settings", "/settings/ai-use"],
  Legal: ["/review", "/settings"],
};

async function signInAsDemo(page: Page, label: string) {
  await page.goto("/login");
  await page
    .getByRole("region", { name: "Try a demo role" })
    .getByRole("button", { name: label, exact: true })
    .click();
  await page.waitForURL(/\/(drafts|review)$/);
}

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

for (const scheme of ["light", "dark"] as const) {
  test.describe(`${scheme} theme`, () => {
    test.use({ colorScheme: scheme });

    test("login page", async ({ page }) => {
      await page.goto("/login");
      expect(await seriousViolations(page)).toEqual([]);
    });

    for (const [role, paths] of Object.entries(PAGES)) {
      test(`${role}: main pages`, async ({ page }) => {
        // P15: the CSP (next.config.ts) must not block anything the app loads.
        const blocked: string[] = [];
        page.on("console", (m) => {
          if (m.type() === "error" && m.text().includes("Content Security Policy"))
            blocked.push(m.text());
        });
        await signInAsDemo(page, role);
        for (const path of paths) {
          await page.goto(path);
          await page.waitForLoadState("networkidle");
          expect(await seriousViolations(page), path).toEqual([]);
        }
        expect(blocked).toEqual([]);
      });
    }
  });
}

// P15 keyboard walkthrough: sign in, skip to content and move through the nav without a mouse,
// with a visible focus indicator on every stop.
test("keyboard-only: demo sign-in, skip link and nav", async ({ page }) => {
  await page.goto("/login");
  const admin = page
    .getByRole("region", { name: "Try a demo role" })
    .getByRole("button", { name: "Brand admin", exact: true });
  await admin.focus();
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/drafts$/);

  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main")).toBeFocused();

  const urls: Record<string, RegExp> = {
    "Review queue": /\/review$/,
    "Rule cards": /\/vault\?tab=rules$/,
    Insights: /\/insights$/,
  };
  for (const [name, url] of Object.entries(urls)) {
    // The review link's name gains "<n> waiting" when the queue isn't empty.
    const link = page
      .getByRole("navigation")
      .getByRole("link", { name: new RegExp(`^${name} ?(\\d+ waiting)?$`) });
    await link.focus();
    const outline = await link.evaluate((el) => {
      const s = getComputedStyle(el);
      return s.outlineStyle !== "none" || s.boxShadow !== "none";
    });
    expect(outline, `${name} has a visible focus indicator`).toBe(true);
    await page.keyboard.press("Enter");
    await page.waitForURL(url);
  }
});
