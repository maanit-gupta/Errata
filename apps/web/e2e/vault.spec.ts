import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

// Needs `make dev-web-local` against a freshly seeded local DB. The guide-upload test also needs
// the worker running with working LLM keys; it only runs when E2E_LLM=1.
const KIT = join(__dirname, "../../../fixtures/paywise");
test.describe.configure({ mode: "serial" });

async function signInAs(page: Page, label: string) {
  await page.goto("/login");
  await page
    .getByRole("region", { name: "Try a demo role" })
    .getByRole("button", { name: label, exact: true })
    .click();
  await page.waitForURL(/\/(drafts|review)$/);
}

const toast = (page: Page, text: string | RegExp) =>
  expect(page.locator("[data-sonner-toast]").filter({ hasText: text }).first()).toBeVisible({
    timeout: 15_000,
  });

test("facts CSV: bad rows show line errors; good file previews and imports", async ({ page }) => {
  await signInAs(page, "Brand admin");
  await page.goto("/vault?tab=facts");
  await page.getByRole("button", { name: "Import facts CSV" }).click();
  const fileInput = page.getByLabel("CSV file");

  await fileInput.setInputFiles({
    name: "bad.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "code,campaign,kind,statement,value_json,required_disclaimer,valid_until,never_send\nF-1,Nope,fee,x,{},,,false\nF-2,,fee,y,not json,,,false\n",
    ),
  });
  const alert = page.getByRole("alert").filter({ hasText: "can't be imported" });
  await expect(alert).toContainText("row 2");
  await expect(alert).toContainText("row 3");
  await expect(page.getByRole("button", { name: /^Import/ })).toBeDisabled();

  await fileInput.setInputFiles(join(KIT, "facts.csv"));
  await expect(page.getByText("Preview: 4 valid rows")).toBeVisible();
  await page.getByRole("button", { name: "Import 4 rows" }).click();
  await toast(page, "Imported 4 facts.");
  await expect(page.getByRole("rowheader", { name: "E-11" })).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "E-11" })).toContainText("Expired");
});

test("glossary CSV imports with a preview", async ({ page }) => {
  await signInAs(page, "Brand admin");
  await page.goto("/vault?tab=glossary");
  await page.getByRole("button", { name: "Import glossary CSV" }).click();
  await page.getByLabel("CSV file").setInputFiles(join(KIT, "glossary.csv"));
  await expect(page.getByText("Preview: 1 valid row")).toBeVisible();
  await page.getByRole("button", { name: "Import 1 row" }).click();
  await toast(page, "Imported 1 glossary terms.");
});

test("keyboard only: open, edit and save an approved rule (creates a new version)", async ({
  page,
}) => {
  await signInAs(page, "Brand admin");
  await page.goto("/vault?tab=rules");
  await page.getByRole("link", { name: "Edit TV-04" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Edit rule card" })).toBeVisible();

  const summary = page.getByLabel("Summary", { exact: true });
  await summary.focus();
  await page.keyboard.press("End");
  await page.keyboard.type(" Keep jokes away from money.");
  await page.getByRole("button", { name: "Save", exact: true }).focus();
  await page.keyboard.press("Enter");
  await toast(page, /Saved as version \d+/);
  await expect(page.getByRole("dialog").getByText(/^v\d+$/)).toBeVisible();
});

test("non-admins are denied the vault", async ({ page }) => {
  await signInAs(page, "Manager");
  await page.goto("/vault?tab=rules");
  await expect(page.getByRole("heading", { name: "You don't have access to this." })).toBeVisible();
});

test("upload guide.pdf → drafts appear live → approve by keyboard → approve all", async ({
  page,
}) => {
  test.skip(
    process.env.E2E_LLM !== "1",
    "set E2E_LLM=1 with the worker running and LLM keys configured",
  );
  test.setTimeout(240_000);
  await signInAs(page, "Brand admin");
  await page.goto("/vault?tab=guides");
  await page.getByLabel("Upload a PDF or DOCX").setInputFiles(join(KIT, "guide.pdf"));
  await page.getByRole("button", { name: "Add guide" }).focus();
  await page.keyboard.press("Enter");
  await toast(page, "Guide uploaded.");

  // Realtime refreshes the table; no reload.
  const row = page
    .getByRole("row")
    .filter({ has: page.getByRole("rowheader", { name: "guide", exact: true }) })
    .first();
  await expect(row).toContainText(/DRAFTED \d+ card/i, { timeout: 180_000 });
  await row.getByRole("link", { name: /\d+ drafts?/ }).click();
  await expect(page).toHaveURL(/status=draft/);

  const firstApprove = page.getByRole("button", { name: /^Approve [A-Z]+-\d+$/ }).first();
  await firstApprove.focus();
  await page.keyboard.press("Enter");
  await toast(page, "Rule approved.");

  await page.getByRole("button", { name: /^Approve \d+ rule cards?$/ }).click();
  await toast(page, /rules? approved/);
  await expect(page.getByText(/draft rules? need review/)).toHaveCount(0);
});
