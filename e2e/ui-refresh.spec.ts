import { expect, test } from "@playwright/test";

async function loginAsProcurement(page: import("@playwright/test").Page) {
  await page.goto("http://localhost:3000");
  await page.click("#btn-login");
  await expect(page.locator("header")).toBeVisible();
}

test.describe("Stally procurement UI refresh", () => {
  test("uses Vietnamese-safe enterprise typography on the demo path", async ({ page }) => {
    await loginAsProcurement(page);

    const demoFamilies = await page.locator("h1, h2, h3, .font-display").evaluateAll((nodes) =>
      Array.from(new Set(nodes.map((node) => window.getComputedStyle(node).fontFamily))).join(" | ")
    );

    expect(demoFamilies).toContain("Be Vietnam Pro");
    expect(demoFamilies).not.toContain("DM Serif Display");
  });

  test("guides the procurement demo path with audit-focused CTAs", async ({ page }) => {
    await loginAsProcurement(page);

    await page.click("#btn-tab-rfq");
    await expect(page.getByRole("button", { name: /Mở danh sách PR/i })).toBeVisible();
    await expect(page.getByText(/Độ tin cậy AI dưới ngưỡng, yêu cầu con người kiểm duyệt/i)).toBeVisible();

    await page.click("#btn-tab-suppliers");
    await expect(page.getByText(/Catalog Horeca/i)).toBeVisible();
    await expect(page.getByText(/Lợi thế cạnh tranh/i)).toBeVisible();
  });

  test("keeps the cases control room fully visible on desktop", async ({ page }) => {
    await loginAsProcurement(page);
    await page.click("#btn-tab-cases");

    const board = page.getByTestId("procurement-kanban-board");
    await expect(board).toBeVisible();

    const dimensions = await board.evaluate((node) => ({
      clientWidth: node.clientWidth,
      scrollWidth: node.scrollWidth,
    }));

    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 4);
  });
});
