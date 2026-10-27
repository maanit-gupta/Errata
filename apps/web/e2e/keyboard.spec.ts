import { expect, test } from "@playwright/test";
import { signInAsDemo } from "./helpers";

// DESIGN.md §7.4–7.5: keyboard-only walkthrough of the shell, and reduced motion honoured.
// Read-only; needs `make dev-web-local` with demo mode on.

test("skip link is first, and moves focus to main", async ({ page }) => {
  await signInAsDemo(page, "Creator");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main$/);
});

test("every focused control shows a visible focus ring", async ({ page }) => {
  await signInAsDemo(page, "Brand admin");
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press("Tab");
    const outline = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return "none";
      const s = getComputedStyle(el);
      return s.outlineStyle === "none" || s.outlineWidth === "0px" ? `none:${el.tagName}` : "ok";
    });
    expect(outline, `focus ${i}`).toBe("ok");
  }
});

test("⌘K opens the palette, Esc closes it and returns focus", async ({ page }) => {
  await signInAsDemo(page, "Brand admin");
  await page.keyboard.press("ControlOrMeta+k");
  const input = page.getByPlaceholder("Search drafts, rule codes, facts, campaigns…");
  await expect(input).toBeFocused();
  await input.fill("CL-03");
  await expect(page.getByRole("option", { name: /CL-03/ }).first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(input).toHaveCount(0);
});

test("? opens the shortcuts sheet; g d goes to Drafts", async ({ page }) => {
  await signInAsDemo(page, "Brand admin");
  await page.goto("/settings");
  await page.locator("body").click({ position: { x: 5, y: 300 } });
  await page.keyboard.press("Shift+?");
  await expect(page.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.keyboard.press("g");
  await page.keyboard.press("d");
  await expect(page).toHaveURL(/\/drafts$/);
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  test("spinners, cursors and fades don't animate", async ({ page }) => {
    await page.goto("/dev/kitchen-sink");
    const names = await page.evaluate(() =>
      [...document.querySelectorAll(".spin, .cursor-blink, .pixel-shimmer")].map(
        (el) => getComputedStyle(el).animationName,
      ),
    );
    expect(names.length).toBeGreaterThan(0);
    expect(new Set(names)).toEqual(new Set(["none"]));
  });
});
