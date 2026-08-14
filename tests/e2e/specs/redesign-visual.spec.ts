import { expect, test, type Page } from "@playwright/test";
import { dismissEnrichmentModal, installMockDossier } from "./mock-dossier";

async function assertViewportFit(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "page should not overflow the viewport horizontally").toBeLessThanOrEqual(1);
}

test.describe("redesigned information architecture", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(installMockDossier, { likedMovies: 8, refineGroupSize: 5 });
  });

  test("desktop surfaces remain coherent and inspectable", async ({ page }) => {
    await page.goto("/teach");
    await dismissEnrichmentModal(page);
    await expect(page.getByRole("heading", { name: "Teach Dossier" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Challenge its assumptions/ })).toBeVisible();
    await assertViewportFit(page);
    await page.screenshot({ path: "test-results/redesign-teach-desktop.png", fullPage: true });

    await page.keyboard.press("Meta+K");
    const command = page.getByRole("dialog", { name: "Search Dossier" });
    await expect(command).toBeVisible();
    await command.getByRole("option", { name: /Your Dossier/ }).click();
    await expect(page).toHaveURL(/\/dossier$/);

    await expect(page.getByRole("heading", { name: /What Dossier currently believes/ })).toBeVisible();
    await expect(page.getByText("Evidence inspector")).toHaveCount(0);
    await page.getByRole("button", { name: /drawn to|usually avoids|responds selectively/ }).first().click();
    await expect(page.getByRole("dialog", { name: /Evidence for/ })).toBeVisible();
    await page.waitForTimeout(500);
    await page.screenshot({ path: "test-results/redesign-dossier-inspector-desktop.png", fullPage: true });

    await page.keyboard.press("Escape");
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Discover" })).toBeVisible();
    await expect(page.getByText("From your dossier")).toHaveCount(0);
    await page.waitForTimeout(500);
    await assertViewportFit(page);
    await page.screenshot({ path: "test-results/redesign-discover-desktop.png", fullPage: true });
  });

  test("mobile supports the primary loop without horizontal overflow", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 390, height: 844 });
    for (const [route, heading, name] of [
      ["/", "Discover", "discover"],
      ["/teach", "Teach Dossier", "teach"],
      ["/dossier", /What Dossier currently believes/, "dossier"],
      ["/library", "Your Library", "library"],
      ["/refine", "Put close feelings in order", "refine"],
      ["/rate", "Rate what you know", "rate"]
    ] as const) {
      await page.goto(route);
      await dismissEnrichmentModal(page);
      await expect(page.getByRole("heading", { name: heading })).toBeVisible({ timeout: 15_000 });
      await assertViewportFit(page);
      await page.screenshot({ path: `test-results/redesign-${name}-mobile.png`, fullPage: true });
    }

    await page.goto("/");
    await expect(page.getByRole("button", { name: /See details for/ }).first()).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: /See details for/ }).first().click();
    const detail = page.getByRole("dialog");
    await expect(detail).toBeVisible();
    const like = detail.getByRole("button", { name: "Like", exact: true });
    await expect(like).toBeVisible();
    const actionBounds = await like.boundingBox();
    expect(actionBounds && actionBounds.y + actionBounds.height).toBeLessThanOrEqual(844);
    await like.click({ trial: true });
    await page.waitForTimeout(350);
    await page.screenshot({ path: "test-results/redesign-detail-mobile.png", fullPage: true });
  });

  test("mobile can opt into the complete seven-point control", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/settings");
    await dismissEnrichmentModal(page);
    await page.getByRole("radio", { name: "7-point scale" }).click();
    await page.goto("/rate");
    await expect(page.locator(".rank-scale")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Extremely positive" })).toBeVisible();
  });
});
