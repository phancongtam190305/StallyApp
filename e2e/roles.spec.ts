import { test, expect } from "@playwright/test";

test.describe("Stally B2B 4-Role Dashboard User Journeys", () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate to the live Vercel app root
    await page.goto("/");
  });

  test("should successfully load login screen and render title", async ({ page }) => {
    // Verify main page title is present
    await expect(page.locator("h2")).toContainText("Hệ Thống Điều Phối Mua Sắm & Cung Ứng STALLY");
  });

  test("should successfully login as Kitchen Chef (Requester) and view Requester workspace", async ({ page }) => {
    // 1. Select Kitchen Chef role
    await page.click("text=Bếp Trưởng");
    
    // 2. Click Sourcing login button
    await page.click("#btn-login");

    // 3. Bypass onboarding tutorial by selecting "TÔI ĐÃ BIẾT SỬ DỤNG RỒI"
    await page.click("text=TÔI ĐÃ BIẾT SỬ DỤNG RỒI", { force: true });

    // 4. Validate that the Requester dashboard has loaded and displays header name
    await expect(page.locator("header")).toContainText("Bếp Trưởng Bình");

    // 5. Verify the Requester workspace title is present
    await expect(page.locator("text=Không Gian Bếp Trưởng")).toBeVisible();
  });

  test("should successfully login as Procurement Officer and display the cases Kanban pipeline", async ({ page }) => {
    // 1. Select Procurement role
    await page.click("text=Trưởng Phòng Thu Mua");
    await page.click("#btn-login");
    await page.click("text=TÔI ĐÃ BIẾT SỬ DỤNG RỒI", { force: true });

    // 2. Validate Procurement dashboard has loaded
    await expect(page.locator("header")).toContainText("Thu Mua Tâm");

    // 3. Navigate to Cases tab in Sidebar using ID-based selector
    await page.click("#btn-tab-cases");

    // 4. Verify the Kanban active cases control is present
    await expect(page.locator("text=Hồ sơ mua sắm")).toBeVisible();
  });

  test("should successfully login as CEO (Manager) and display CEO workspace", async ({ page }) => {
    // 1. Select CEO Manager role
    await page.click("text=Giám Đốc Phê Duyệt");
    await page.click("#btn-login");
    await page.click("text=TÔI ĐÃ BIẾT SỬ DỤNG RỒI", { force: true });

    // 2. Validate Manager dashboard has loaded
    await expect(page.locator("header")).toContainText("Giám Đốc Mai");

    // 3. Verify CEO welcome header is present
    await expect(page.locator("text=Chào mừng trở lại, Nguyễn Thị Mai")).toBeVisible();
  });

  test("should successfully login as Warehouse Staff and verify Warehouse receipt tools", async ({ page }) => {
    // 1. Select Warehouse Staff role
    await page.click("text=Thủ Kho Trưởng");
    await page.click("#btn-login");
    await page.click("text=TÔI ĐÃ BIẾT SỬ DỤNG RỒI", { force: true });

    // 2. Validate Warehouse dashboard has loaded
    await expect(page.locator("header")).toContainText("Thủ Kho Khoa");

    // 3. Navigate to Overview tab (Warehouse Dashboard)
    await page.click("#btn-tab-overview");

    // 4. Verify perfect receipt area title is present
    await expect(page.locator("text=Khu Vực Tiếp Nhận Hàng")).toBeVisible();
  });
});
