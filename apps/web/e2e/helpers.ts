import AxeBuilder from "@axe-core/playwright";
import { expect, type BrowserContext, type Page } from "@playwright/test";

/** One-click demo sign-in from the login page's demo panel. */
export async function signInAsDemo(page: Page, label: string) {
  await page.goto("/login");
  await page
    .getByRole("region", { name: "Try a demo role" })
    .getByRole("button", { name: new RegExp(`^${label}\\b`) })
    .click();
  await page.waitForURL(/\/(drafts|review)$/);
}

/** Switch role from the demo strip (DESIGN.md §7.2). */
export async function switchDemoRole(page: Page, label: string) {
  await page.getByRole("button", { name: "Switch role" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: new RegExp(`^${label}\\b`) })
    .click();
  await expect(page.getByTestId("role-pill")).toHaveText(label);
}

export type Theme = "dark" | "light";

/** Theme preference cookie read by the root layout. */
export async function setTheme(context: BrowserContext, baseURL: string, theme: Theme) {
  await context.addCookies([{ name: "bl_theme", value: theme, url: baseURL }]);
}

/** WCAG 2.2 AA via axe; the gate is zero serious or critical violations (DESIGN.md §7.5). */
export async function expectNoSeriousA11yViolations(page: Page, label = page.url()) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  const bad = results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map(
      (v) =>
        `${label} ${v.id} (${v.impact}): ${v.help} → ${v.nodes
          .map((n) => n.target.join(" "))
          .slice(0, 3)
          .join(" | ")}`,
    );
  expect(bad).toEqual([]);
}

/** Back-compat: zero violations of any impact. */
export async function expectNoA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
}
