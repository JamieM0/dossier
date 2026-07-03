import { expect, test } from "@playwright/test";
import { dismissEnrichmentModal, installMockDossier } from "./mock-dossier";

test.describe("Recommendations Dials panel", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(installMockDossier);
  });

  async function seedRatingsAndOpenRecommendations(page: import("@playwright/test").Page): Promise<void> {
    await page.goto("/rate");
    await dismissEnrichmentModal(page);
    const likeButton = page.getByRole("button", { name: "I liked it" });
    for (let i = 0; i < 5; i++) {
      await likeButton.click();
      await page.waitForTimeout(400);
    }
    await page.getByRole("link", { name: "Recommendations" }).click();
    await expect(page.getByRole("heading", { name: "Recommendations" })).toBeVisible();
    // Candidate pool fetch + scoring is async — wait for a real card
    // (not the "rate 5 titles" onboarding state) before interacting.
    await expect(page.locator(".card").first()).toBeVisible();
  }

  test("Dials button opens the panel with every dial group, and hides when grouped", async ({ page }) => {
    await seedRatingsAndOpenRecommendations(page);

    const dialsButton = page.getByRole("button", { name: "Tune recommendation dials" });
    await expect(dialsButton).toBeVisible();
    await dialsButton.click();

    const panel = page.getByRole("dialog", { name: "Recommendation Dials" });
    await expect(panel).toBeVisible();
    await expect(panel.getByText("Core Scoring")).toBeVisible();
    await expect(panel.getByText("Discovery")).toBeVisible();
    await expect(panel.getByText("Feature Axes")).toBeVisible();

    // All 17 dials present with a slider + description each.
    await expect(panel.locator("input[type=range]")).toHaveCount(17);
    await expect(panel.getByText("Quality Bias")).toBeVisible();
    await expect(panel.getByText("Experimental Structure")).toBeVisible();

    // locator.screenshot() below auto-waits for the panel's slide-in
    // animation to settle; page.screenshot() doesn't, so without this wait
    // it captures mid-fade and ghosts the page behind the panel.
    await page.waitForTimeout(300);
    await page.screenshot({ path: "test-results/recommendations-dials-panel.png" });
    await panel.screenshot({ path: "test-results/recommendations-dials-panel-focused.png" });
    await panel.getByText("Feature Axes").scrollIntoViewIfNeeded();
    await panel.screenshot({ path: "test-results/recommendations-dials-panel-axes.png" });

    await panel.getByRole("button", { name: "Close" }).click();
    await expect(panel).not.toBeVisible();
  });

  test("moving a dial updates its value badge and persists across reopen", async ({ page }) => {
    await seedRatingsAndOpenRecommendations(page);
    await page.getByRole("button", { name: "Tune recommendation dials" }).click();
    const panel = page.getByRole("dialog", { name: "Recommendation Dials" });

    const dislikeRow = panel.locator(".row", { hasText: "Dislike Aversion" });
    const slider = dislikeRow.locator("input[type=range]");
    await slider.fill("90");
    await expect(dislikeRow.locator(".value")).toHaveText("90");

    await panel.getByRole("button", { name: "Done" }).click();
    await expect(panel).not.toBeVisible();

    // Reopening keeps the moved value and shows the "on" indicator.
    const dialsButton = page.getByRole("button", { name: "Tune recommendation dials" });
    await expect(dialsButton).toContainText("Dials · on");
    await dialsButton.click();
    await expect(page.locator(".row", { hasText: "Dislike Aversion" }).locator(".value")).toHaveText("90");
  });

  test("Reset all restores default values and disables itself", async ({ page }) => {
    await seedRatingsAndOpenRecommendations(page);
    await page.getByRole("button", { name: "Tune recommendation dials" }).click();
    const panel = page.getByRole("dialog", { name: "Recommendation Dials" });

    const resetButton = panel.getByRole("button", { name: "Reset all" });
    await expect(resetButton).toBeDisabled();

    const slider = panel.locator(".row", { hasText: "Mainstream" }).locator("input[type=range]");
    await slider.fill("10");
    await expect(resetButton).toBeEnabled();

    await resetButton.click();
    await expect(resetButton).toBeDisabled();
    await expect(panel.locator(".row", { hasText: "Mainstream" }).locator(".value")).toHaveText("50");
  });

  test("Dials button is hidden when Group by taste is on", async ({ page }) => {
    await seedRatingsAndOpenRecommendations(page);
    await expect(page.getByRole("button", { name: "Tune recommendation dials" })).toBeVisible();

    // Client-side nav (not a reload) so the mock backend's in-memory
    // ratings survive — mirrors the pattern in recommendations-overlay.spec.ts.
    await page.getByRole("link", { name: "Settings" }).click();
    await page.getByRole("switch", { name: "Group by taste" }).click();

    await page.getByRole("link", { name: "Recommendations" }).click();
    await expect(page.getByRole("heading", { name: "Recommendations" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Tune recommendation dials" })).toHaveCount(0);
  });
});
