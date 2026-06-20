import { expect, test } from "@playwright/test";

test.describe("Stally shared procurement workspace", () => {
  test("loads login and enters the shared workspace", async ({ page }) => {
    await page.goto("http://localhost:3000");
    await expect(page.locator("#btn-login")).toBeVisible();
    await page.click("#btn-login");
    await expect(page.locator("header")).toBeVisible();
    await expect(page.locator("#btn-tab-overview")).toBeVisible();
    await expect(page.locator("#btn-tab-cases")).toBeVisible();
  });
});
