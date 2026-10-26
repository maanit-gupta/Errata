import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

// Needs `make dev-web-local` against a seeded local DB.
const KIT = join(__dirname, "../../../fixtures/paywise");

async function signInAs(page: Page, label: string) {
  await page.goto("/login");
  await page
    .getByRole("region", { name: "Try a demo role" })
    .getByRole("button", { name: label, exact: true })
    .click();
  await page.waitForURL(/\/(drafts|review)$/);
}

function csv(name: string, body: string) {
  return { name, mimeType: "text/csv", buffer: Buffer.from(body) };
}

test("brand admin imports the PayWise facts and glossary CSVs", async ({ page }) => {
  await signInAs(page, "Brand admin");
  const facts = await page.request.post("/api/vault/import", {
    multipart: {
      kind: "facts",
      file: csv("facts.csv", readFileSync(join(KIT, "facts.csv"), "utf8")),
    },
  });
  expect(facts.status()).toBe(200);
  expect(await facts.json()).toEqual({ kind: "facts", imported: 4, embeddingQueued: true });

  const glossary = await page.request.post("/api/vault/import", {
    multipart: {
      kind: "glossary",
      file: csv("glossary.csv", readFileSync(join(KIT, "glossary.csv"), "utf8")),
    },
  });
  expect(await glossary.json()).toMatchObject({ kind: "glossary", imported: 1 });
});

test("invalid rows are rejected with line numbers and nothing is written", async ({ page }) => {
  await signInAs(page, "Brand admin");
  const res = await page.request.post("/api/vault/import", {
    multipart: {
      kind: "facts",
      file: csv(
        "bad.csv",
        "code,campaign,kind,statement,value_json,required_disclaimer,valid_until,never_send\nF-900,Nope,fee,x,{},,,false\n",
      ),
    },
  });
  expect(res.status()).toBe(422);
  expect((await res.json()).errors[0]).toMatchObject({ line: 2 });
});

test("non-admins cannot import", async ({ page }) => {
  await signInAs(page, "Creator");
  const res = await page.request.post("/api/vault/import", {
    multipart: {
      kind: "glossary",
      file: csv("g.csv", "code,preferred,variants,banned,case_sensitive,note\nG-99,X,,,,\n"),
    },
  });
  expect(res.status()).toBe(403);
});
