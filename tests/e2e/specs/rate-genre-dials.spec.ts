import { expect, test } from "@playwright/test";
import { dismissEnrichmentModal, installMockDossier } from "./mock-dossier";

test.describe("Rate screen genre dials", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(installMockDossier);
    await page.goto("/rate");
    await dismissEnrichmentModal(page);
  });

  test("Genre dials button opens the panel with a dial per known genre", async ({ page }) => {
    const dialsButton = page.getByRole("button", { name: "Tune genre dials" });
    await expect(dialsButton).toBeVisible();
    await dialsButton.click();

    const panel = page.getByRole("dialog", { name: "Genre Dials" });
    await expect(panel).toBeVisible();
    // Mock's genre map: Action, Drama, Comedy, Science Fiction, Horror, Romance, Crime.
    await expect(panel.locator("input[type=range]")).toHaveCount(7);
    await expect(panel.getByText("Horror")).toBeVisible();
    await expect(panel.getByText("Science Fiction")).toBeVisible();

    // locator.screenshot() below auto-waits for the panel's slide-in
    // animation to settle; page.screenshot() doesn't, so without this wait
    // it captures mid-fade and ghosts the page behind the panel.
    await page.waitForTimeout(300);
    await page.screenshot({ path: "test-results/rate-genre-dials-panel.png" });
    await panel.screenshot({ path: "test-results/rate-genre-dials-panel-focused.png" });
  });

  test("moving a dial updates its value, marks the button active, and persists across a reload", async ({ page }) => {
    await page.getByRole("button", { name: "Tune genre dials" }).click();
    const panel = page.getByRole("dialog", { name: "Genre Dials" });

    const horrorRow = panel.locator(".row", { hasText: "Horror" });
    const slider = horrorRow.locator("input[type=range]");
    await slider.fill("15");
    await expect(horrorRow.locator(".value")).toHaveText("15");

    await panel.getByRole("button", { name: "Done" }).click();
    await expect(panel).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Tune genre dials" })).toHaveClass(/active/);

    await page.reload();
    await dismissEnrichmentModal(page);
    await page.getByRole("button", { name: "Tune genre dials" }).click();
    await expect(page.locator(".row", { hasText: "Horror" }).locator(".value")).toHaveText("15");
  });

  test("Reset all restores every genre to neutral and disables itself", async ({ page }) => {
    await page.getByRole("button", { name: "Tune genre dials" }).click();
    const panel = page.getByRole("dialog", { name: "Genre Dials" });

    const resetButton = panel.getByRole("button", { name: "Reset all" });
    await expect(resetButton).toBeDisabled();

    const slider = panel.locator(".row", { hasText: "Horror" }).locator("input[type=range]");
    await slider.fill("10");
    await expect(resetButton).toBeEnabled();

    await resetButton.click();
    await expect(resetButton).toBeDisabled();
    await expect(panel.locator(".row", { hasText: "Horror" }).locator(".value")).toHaveText("50");
  });
});

// 9 not-interested Horror ratings are pre-seeded (see mock-dossier.ts), and
// the queue starts right at "Crimson Hour" (the pool's one Horror title) —
// so a single live click supplies the 10th and should trigger the popup,
// without needing to walk the whole queue by hand.
test.describe("Rate screen genre-pattern popup, with 9 not-interested Horror ratings already seeded", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(installMockDossier, { notInterestedHorrorSeed: 9 });
    await page.goto("/rate");
    await dismissEnrichmentModal(page);
  });

  test("the 10th same-genre rating triggers the pattern popup, and accepting turns the dial down", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Crimson Hour" })).toBeVisible();

    const popup = page.getByRole("alertdialog", { name: "Adjust your dials?" });
    await page.getByRole("button", { name: "I don't care about it" }).click();

    await expect(popup).toBeVisible();
    await expect(popup).toContainText("Horror");
    await page.waitForTimeout(300);
    await popup.screenshot({ path: "test-results/rate-genre-dials-pattern-popup.png" });

    await popup.getByRole("button", { name: "Yes" }).click();
    await expect(popup).toHaveCount(0);

    // Horror started neutral (50); accepting cuts it by a quarter:
    // 50 - 50/4 = 37.5, rounded to 38.
    await page.getByRole("button", { name: "Tune genre dials" }).click();
    await expect(page.locator(".row", { hasText: "Horror" }).locator(".value")).toHaveText("38");
  });

  test("declining the pattern popup leaves the dial untouched", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Crimson Hour" })).toBeVisible();

    const popup = page.getByRole("alertdialog", { name: "Adjust your dials?" });
    await page.getByRole("button", { name: "I don't care about it" }).click();
    await expect(popup).toBeVisible();

    await popup.getByRole("button", { name: "No" }).click();
    await expect(popup).toHaveCount(0);

    await page.getByRole("button", { name: "Tune genre dials" }).click();
    await expect(page.locator(".row", { hasText: "Horror" }).locator(".value")).toHaveText("50");
  });
});
