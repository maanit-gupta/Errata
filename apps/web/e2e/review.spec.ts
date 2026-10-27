import { execSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";

// Local-only review checks (uses docker exec against the local DB): E2E_WORKER=1.

async function signInAs(page: Page, label: string) {
  await page.goto("/login");
  await page
    .getByRole("region", { name: "Try a demo role" })
    .getByRole("button", { name: label, exact: true })
    .click();
  await page.waitForURL(/\/(drafts|review)$/);
}
async function newDraft(page: Page, title: string, body: string) {
  await page.getByLabel("Title").fill(title);
  await page.getByRole("button", { name: "New draft" }).click();
  await page.waitForURL(/\/drafts\/[0-9a-f-]{36}$/);
  await page.getByRole("textbox", { name: "Draft text" }).click();
  await page.keyboard.insertText(body);
  await page.getByLabel("Goal").fill("webinar sign-ups");
  await page.getByLabel("Audience").fill("first-time investors");
  await page.getByLabel("Call to action").fill("Register now");
  await page.getByRole("button", { name: "Submit for check" }).click();
  return page.url().split("/").pop()!;
}

test("stale or wrong-role decisions are rejected server-side with a friendly error", async ({
  page,
}) => {
  test.skip(process.env.E2E_WORKER !== "1", "needs the worker (E2E_WORKER=1)");
  test.setTimeout(120_000);
  await signInAs(page, "Creator");
  const id = await newDraft(
    page,
    `Clean ${Date.now()}`,
    "Start a small monthly SIP on PayWise this Diwali. Register now.",
  );
  await expect(page.getByText("In review", { exact: true })).toBeVisible({ timeout: 60_000 });

  await page.getByLabel("Switch demo role").selectOption({ label: "Manager" });
  await page.getByRole("button", { name: "Switch" }).click();
  await expect(page.getByTestId("role-pill")).toHaveText("Manager");
  await page.goto(`/review/${id}`);
  await expect(page.getByRole("button", { name: "Approve" })).toBeVisible();

  // Meanwhile an admin archives it; the manager's page is now stale.
  execSync(
    `docker exec supabase_db_brandlens psql -U postgres -c "begin; set local role authenticated; set local request.jwt.claims to '{\\"sub\\":\\"10000000-0000-4000-8000-000000000001\\",\\"role\\":\\"authenticated\\"}'; select public.transition_content('${id}', 'archived', 'e2e'); commit;"`,
  );
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: /valid next step|can't do that/ }),
  ).toBeVisible();
});
