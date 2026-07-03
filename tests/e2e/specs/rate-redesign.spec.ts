import { expect, test } from "@playwright/test";
import { dismissEnrichmentModal, installMockDossier } from "./mock-dossier";

test.describe("Rate screen redesign", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(installMockDossier);
    await page.goto("/rate");
    await dismissEnrichmentModal(page);
  });

  test("full details are on the main screen, with full-label action buttons", async ({ page }) => {
    await expect(page.locator(".info .title")).toBeVisible();
    await expect(page.locator(".info .overview")).toBeVisible();

    const labels = await page
      .locator(".action-btn")
      .evaluateAll((els) => els.map((el) => el.getAttribute("aria-label")));
    expect(labels).toEqual([
      "I liked it",
      "I didn't like it",
      "Add to my Watchlist",
      "I haven't seen it",
      "I don't care about it"
    ]);

    // No mode toggle, no separate detail modal.
    await expect(page.locator(".mode-toggle")).toHaveCount(0);
    await page.locator(".poster-wrap").click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("keyboard hint is collapsed behind a popover, not always visible", async ({ page }) => {
    const popover = page.locator(".hint-popover");
    await expect(popover).toHaveCount(1);
    await expect(popover).toHaveCSS("opacity", "0");
    await page.getByRole("button", { name: "Keyboard shortcuts" }).hover();
    await expect(popover).toHaveCSS("opacity", "1");
    await expect(popover).toContainText("dislike");
  });

  test("full-label buttons rate the title", async ({ page }) => {
    await expect(page.getByText("0 rated")).toBeVisible();
    await page.getByRole("button", { name: "I liked it" }).click();
    await expect(page.getByText("1 rated")).toBeVisible();
  });

  test("dragging the poster past threshold commits a rating", async ({ page }) => {
    await expect(page.getByText("0 rated")).toBeVisible();
    const box = await page.locator(".poster-wrap").boundingBox();
    if (!box) throw new Error("poster not found");
    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 60, startY, { steps: 5 });
    await page.mouse.move(startX + 200, startY, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(700);
    await expect(page.getByText("1 rated")).toBeVisible();
  });

  test("dragging below threshold snaps back without rating", async ({ page }) => {
    const box = await page.locator(".poster-wrap").boundingBox();
    if (!box) throw new Error("poster not found");
    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 30, startY, { steps: 3 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    await expect(page.getByText("0 rated")).toBeVisible();
  });
});
