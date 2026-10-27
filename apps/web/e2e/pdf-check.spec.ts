import AxeBuilder from "@axe-core/playwright";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

// Overlays and findings animate in (DESIGN §4); axe audits settled frames.
test.use({ reducedMotion: "reduce" });

// P12 PDF decks: upload the seeded 4-page deck, see per-page findings with overlays on the page
// renders, hidden text flagged, and "Show on page N" jumping to the finding's page and box.
// Needs web + worker against the seeded local DB with logo files uploaded
// (`make db-reset && make seed-assets-local && make dev-local`): E2E_WORKER=1.
const DECK = path.resolve(__dirname, "../../../fixtures/paywise/deck.pdf");
const TITLE = `Diwali deck ${Date.now()}`;

async function signInAs(page: Page, label: string) {
  await page.goto("/login");
  await page
    .getByRole("region", { name: "Try a demo role" })
    .getByRole("button", { name: label, exact: true })
    .click();
  await page.waitForURL(/\/(drafts|review)$/);
}
const findings = (page: Page) => page.getByRole("region", { name: /^Findings/ });
const card = (page: Page, code: string) =>
  findings(page)
    .getByRole("listitem")
    .filter({ has: page.getByRole("button", { name: new RegExp(`\\b${code}\\b`) }) })
    .first();
const pages = (page: Page) => page.getByRole("navigation", { name: "Pages" });

test.describe.configure({ mode: "serial" });
const RUN = process.env.E2E_WORKER === "1" || !!process.env.E2E_BASE_URL;

test("a seeded deck shows page findings with overlays, hidden text and page jumps", async ({
  page,
}) => {
  test.skip(!RUN, "set E2E_WORKER=1 (local) or E2E_BASE_URL (deployed)");
  test.setTimeout(240_000);
  await signInAs(page, "Creator");
  await page.goto("/drafts/new");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Title").fill(TITLE);
  await page.getByRole("button", { name: "Create draft" }).click();
  await page.waitForURL(/\/drafts\/[0-9a-f-]{36}$/);
  const contentId = page.url().split("/").pop()!;
  await page.getByLabel("Goal").fill("webinar sign-ups");
  await page.getByLabel("Audience").fill("first-time investors");
  await page.getByLabel("Call to action").fill("Register now");
  await page.getByLabel(/Or upload a file/).setInputFiles(DECK);
  await page.getByRole("button", { name: "Submit for check" }).click();

  // Four rendered pages; the clean cover is selected first.
  await expect(pages(page).getByRole("button")).toHaveCount(4, { timeout: 150_000 });
  await expect(page.getByRole("heading", { name: /PDF · version 1/ })).toBeVisible();
  await expect(pages(page).getByRole("button", { name: "Page 1: no findings" })).toBeVisible();
  await expect(page.getByText("No findings on page 1.")).toBeVisible();

  // Page 3: the white-on-white injection is a hidden-text claims blocker with its own box.
  await pages(page)
    .getByRole("button", { name: /^Page 3:/ })
    .click();
  await expect(page.getByText(/^Page 3 of 4/)).toBeVisible();
  const hidden = card(page, "CL-03");
  await expect(hidden).toContainText("Hidden text on page 3");
  await expect(hidden).toContainText("prompt-injection");
  await expect(page.getByRole("button", { name: /^Finding \d+, blocker, CL-03/ })).toBeVisible();
  await expect(card(page, "WCAG 1.4.3")).toBeVisible(); // the faint disclaimer
  await expect(card(page, "E-19")).toHaveCount(0); // page 2's finding is filtered out

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);

  // All pages: the E-19 date/venue blocker is on page 2; "Show on page 2" turns to it.
  await page.getByRole("button", { name: "Show all pages" }).click();
  const e19 = card(page, "E-19");
  await expect(e19).toContainText("Oct 18");
  await e19.getByRole("button", { name: "Show on page 2" }).click();
  await expect(page.getByText(/^Page 2 of 4/)).toBeVisible();
  await expect(page.getByRole("button", { name: /^Finding \d+, blocker, E-19/ })).toBeVisible();
  await expect(e19).toHaveClass(/border-focus/);

  // Page 4: the picture's claim (read by OCR), its off-palette fill and the too-small logo.
  await pages(page)
    .getByRole("button", { name: /^Page 4:/ })
    .click();
  await expect(page.getByRole("button", { name: /^Finding \d+, blocker, CL-03/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Finding \d+, warning, VS-01/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Finding \d+, warning, VS-03/ })).toBeVisible();

  // Blockers send it back to the creator; the review page shows the same pages read-only.
  await expect(page.getByText("Needs revision", { exact: true }).first()).toBeVisible();
  await page.goto(`/review/${contentId}`);
  await expect(pages(page).getByRole("button")).toHaveCount(4);
  await page.getByRole("link", { name: "Show on page 3" }).first().click();
  await expect(page.getByText(/^Page 3 of 4/)).toBeVisible();
});
