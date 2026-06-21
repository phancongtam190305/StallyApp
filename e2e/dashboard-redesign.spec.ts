import { expect, test } from "@playwright/test";

async function enterWorkspace(page: import("@playwright/test").Page) {
  await page.goto("http://localhost:3000");
  await page.click("#btn-login");
  await expect(page.locator("header")).toBeVisible();
}

test.describe("Stally dashboard redesign", () => {
  test("enters a shared procurement workspace without role picker or tutorial", async ({ page }) => {
    await page.goto("http://localhost:3000");

    await expect(page.getByText(/Bếp Trưởng|Thủ Kho|Giám Đốc Phê Duyệt/i)).toHaveCount(0);
    await page.click("#btn-login");

    await expect(page.locator("#onboarding-modal")).toHaveCount(0);
    await expect(page.locator("body")).toContainText(/Stally|Dashboard/i);
  });

  test("renders the new workbar, five-module navigation, and dashboard views", async ({ page }) => {
    await enterWorkspace(page);

    await expect(page.locator("#global-search")).toBeVisible();
    await expect(page.locator("#content-btn-create-case")).toBeVisible();
    await expect(page.locator("#content-btn-add-supplier")).toBeVisible();
    await expect(page.locator("#btn-lang-vi")).toBeVisible();
    await expect(page.locator("#btn-lang-en")).toBeVisible();

    await expect(page.locator("#btn-tab-overview")).toBeVisible();
    await expect(page.locator("#btn-tab-cases")).toBeVisible();
    await expect(page.locator("#btn-tab-suppliers")).toBeVisible();
    await expect(page.locator("#btn-tab-inventory")).toBeVisible();

    await expect(page.getByTestId("operator-dashboard")).toBeVisible();
    await page.click("#btn-settings");
    await page.click("#popover-btn-view-executive");
    await expect(page.getByTestId("executive-dashboard")).toBeVisible();
  });
});
