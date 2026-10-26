import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Needs `make dev-web-local` + the worker running against the seeded local DB: E2E_WORKER=1.
const HERO =
  "This Diwali, start a festive SIP on Paywise app with 0% exit load and lock in 14.2% assured annual returns — webinar registration closes Oct 18 at Hall B, Chandigarh!";

async function signInAs(page: Page, label: string) {
  await page.goto("/login");
  await page
    .getByRole("region", { name: "Try a demo role" })
    .getByRole("button", { name: label, exact: true })
    .click();
  await page.waitForURL(/\/(drafts|review)$/);
}

const card = (page: Page, code: string) =>
  page
    .getByRole("listitem")
    .filter({ has: page.getByRole("button", { name: new RegExp(`\\b${code}\\b`) }) })
    .first();

test.describe.configure({ mode: "serial" });

test("creator: hero draft → live findings → accept fixes → route CL-03 → resubmit enabled", async ({
  page,
}) => {
  test.skip(process.env.E2E_WORKER !== "1", "needs the worker running (E2E_WORKER=1)");
  test.setTimeout(120_000);
  await signInAs(page, "Creator");

  await page.goto("/drafts/new");
  await page.waitForLoadState("networkidle");

  await page.getByLabel("Title").fill("Hero caption (e2e)");

  await page.getByRole("button", { name: "Create draft" }).click();
  await page.waitForURL(/\/drafts\/[0-9a-f-]{36}$/);

  await page.getByRole("textbox", { name: "Draft text" }).click();
  await page.keyboard.insertText(HERO);
  await page.getByLabel("Goal").fill("webinar sign-ups");
  await page.getByLabel("Audience").fill("first-time investors");
  await page.getByLabel("Call to action").fill("Register now");
  await page.getByRole("button", { name: "Submit for check" }).click();

  // Live via Realtime: no reload.
  for (const code of ["G-07", "F-048", "CL-03", "E-19"]) {
    await expect(card(page, code)).toBeVisible({ timeout: 60_000 });
  }

  // Highlights land on the exact characters.
  // (≥4: the LLM pass may add judgement findings on top of the deterministic four.)
  await expect
    .poll(() => page.locator(".finding-hl").count(), { timeout: 10_000 })
    .toBeGreaterThanOrEqual(4);
  const highlights = await page.locator(".finding-hl").allInnerTexts();
  for (const quote of [
    "Paywise app",
    "0% exit load",
    "lock in 14.2% assured annual returns",
    "Oct 18 at Hall B, Chandigarh",
  ]) {
    expect(highlights).toContain(quote);
  }

  const accept = async (code: string) =>
    test.step(`accept ${code}`, async () => {
      const c = card(page, code);
      const header = c.locator('h3 button[aria-expanded="false"]');
      if ((await header.count()) > 0) await header.click();
      await c.getByRole("button", { name: "Accept fix" }).click();
      await expect(c).toContainText("Fix accepted");
    });
  await accept("G-07");
  await accept("E-19");
  await accept("F-048");
  await expect(page.getByRole("textbox", { name: "Draft text" })).toContainText("PayWise");
  await expect(page.getByRole("textbox", { name: "Draft text" })).toContainText(
    "Oct 28, 7:00 PM IST (online)",
  );

  const cl = card(page, "CL-03");
  await cl.getByRole("button", { name: "Route to Legal" }).click();
  await expect(cl).toContainText("Routed to legal");

  await expect(page.getByRole("button", { name: "Resubmit for check" })).toBeEnabled();
});

test("agency sees rule summaries, not bodies", async ({ page }) => {
  test.skip(process.env.E2E_WORKER !== "1", "needs the worker running (E2E_WORKER=1)");
  test.setTimeout(120_000);
  await signInAs(page, "Agency");
  await page.goto("/drafts/new");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Title").fill("Agency caption (e2e)");
  await page.getByRole("button", { name: "Create draft" }).click();
  await page.waitForURL(/\/drafts\/[0-9a-f-]{36}$/);
  await page.getByRole("textbox", { name: "Draft text" }).click();
  await page.keyboard.insertText("Invest on PayWise and lock in 14.2% assured annual returns.");
  await page.getByLabel("Goal").fill("sign-ups");
  await page.getByLabel("Audience").fill("first-time investors");
  await page.getByLabel("Call to action").fill("Register now");
  await page.getByRole("button", { name: "Submit for check" }).click();
  const cl = card(page, "CL-03");
  await expect(cl).toBeVisible({ timeout: 60_000 });
  // Summary (agency-safe) is shown; the body sentence never is.
  await expect(cl).toContainText("Never promise, guarantee or");
  await expect(page.getByText("Copy must never use")).toHaveCount(0);
});

test("keyboard: tab to a finding, Enter expands it, actions are reachable", async ({ page }) => {
  test.skip(process.env.E2E_WORKER !== "1", "needs the worker running (E2E_WORKER=1)");
  await signInAs(page, "Agency");
  await page.getByRole("link", { name: "Agency caption (e2e)" }).first().click();
  const header = page.locator("li[data-finding] h3 button").filter({ hasText: "CL-03" }).first();
  await header.focus();
  const before = await header.getAttribute("aria-expanded");
  await page.keyboard.press("Enter");
  await expect(header).toHaveAttribute("aria-expanded", before === "true" ? "false" : "true");
  if (before === "true") await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  // Next focusable after the header is inside the expanded card (citation link or an action).
  const focusedInCard = await page.evaluate(() => !!document.activeElement?.closest("li"));
  expect(focusedInCard).toBe(true);
});

test("draft page with findings has no axe violations (WCAG 2.2 AA)", async ({ page }) => {
  test.skip(process.env.E2E_WORKER !== "1", "needs the worker running (E2E_WORKER=1)");
  // Findings fade in (DESIGN §4); audit the settled page, not a mid-animation frame.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signInAs(page, "Creator");
  await page.getByRole("link", { name: "Hero caption (e2e)" }).first().click();
  await expect(page.getByRole("heading", { name: /Findings/ })).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
});
