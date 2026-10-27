import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// P13 Guideline Clarity Score loop: the simulated month puts TV-04 at GCS 60 (UNCLEAR); the worker
// generated three examples; a brand admin approves them → TV-04 v2, re-embedded, scored afresh.
// Needs the local stack with the worker and `make simulate-activity` run first: E2E_WORKER=1.
async function signInAs(page: Page, label: string) {
  await page.goto("/login");
  await page
    .getByRole("region", { name: "Try a demo role" })
    .getByRole("button", { name: label, exact: true })
    .click();
  await page.waitForURL(/\/(drafts|review)$/);
}
const row = (page: Page, code: string) =>
  page
    .getByRole("table", { name: /Guideline watchlist/ })
    .getByRole("row")
    .filter({ has: page.getByRole("rowheader", { name: new RegExp(`^${code} `) }) });

test.describe.configure({ mode: "serial" });
const RUN = process.env.E2E_WORKER === "1";

test("an UNCLEAR rule's generated examples are approved into a new version", async ({ page }) => {
  test.skip(!RUN, "set E2E_WORKER=1 after `make simulate-activity` (local stack + worker)");
  test.setTimeout(120_000);
  await signInAs(page, "Brand admin");
  await page.goto("/insights");

  await expect(page.getByText("Illustrative data")).toBeVisible();
  await expect(page.getByText("blockers caught this week")).toBeVisible();
  await expect(row(page, "TV-04")).toContainText("41");
  await expect(row(page, "TV-04")).toContainText("60");
  await expect(row(page, "TV-04")).toContainText("UNCLEAR");
  await expect(row(page, "VS-02")).toContainText("73");
  await expect(row(page, "VS-02")).toContainText("watch");
  await expect(row(page, "CL-03")).toContainText("clear");
  await expect(
    page.getByRole("table").filter({ hasText: "Findings per cited rule" }).getByRole("row"),
  ).not.toHaveCount(1);

  // The worker has written three suggestions; review them in the drawer.
  const review = row(page, "TV-04").getByRole("button", { name: /Review 3 examples/ });
  await expect(review).toBeVisible({ timeout: 60_000 });
  await review.click();
  const drawer = page.getByRole("dialog", { name: /Suggested examples/ });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole("checkbox")).toHaveCount(3);

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);

  // Keep two of the three.
  await drawer.getByRole("checkbox").nth(2).uncheck();
  await drawer.getByRole("button", { name: "Approve 2 examples" }).click();
  await expect(page.getByText(/Added 2 examples to TV-04 as version 2/)).toBeVisible();
  await expect(drawer).toBeHidden();

  // After: v2 starts a fresh score; v1's UNCLEAR score stays visible next to it.
  await expect(row(page, "TV-04")).toContainText("v2");
  await expect(row(page, "TV-04")).toContainText("v1: GCS 60 (UNCLEAR)");
  await expect(row(page, "TV-04")).toContainText("added 2 generated examples");
  await expect(row(page, "TV-04")).toContainText("insufficient data");
});
