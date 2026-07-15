import { expect, test } from "@playwright/test";
import { dismissEnrichmentModal, installMockDossier } from "./mock-dossier";

test.describe("Rate screen rate dials", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(installMockDossier);
    await page.goto("/rate");
    await dismissEnrichmentModal(page);
  });

  test("Rate dials button opens the panel with a dial per known genre", async ({ page }) => {
    const dialsButton = page.getByRole("button", { name: "Tune rate dials" });
    await expect(dialsButton).toBeVisible();
    await dialsButton.click();

    const panel = page.getByRole("dialog", { name: "Rate Dials" });
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
    await page.getByRole("button", { name: "Tune rate dials" }).click();
    const panel = page.getByRole("dialog", { name: "Rate Dials" });

    const horrorRow = panel.locator(".row", { hasText: "Horror" });
    const slider = horrorRow.locator("input[type=range]");
    await slider.fill("15");
    await expect(horrorRow.locator(".value")).toHaveText("15");

    await panel.getByRole("button", { name: "Done" }).click();
    await expect(panel).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Tune rate dials" })).toHaveClass(/active/);

    await page.reload();
    await dismissEnrichmentModal(page);
    await page.getByRole("button", { name: "Tune rate dials" }).click();
    await expect(page.locator(".row", { hasText: "Horror" }).locator(".value")).toHaveText("15");
  });

  test("Reset all restores every genre to neutral and disables itself", async ({ page }) => {
    await page.getByRole("button", { name: "Tune rate dials" }).click();
    const panel = page.getByRole("dialog", { name: "Rate Dials" });

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

// Visual coverage of the panel WITH tags visible. The default mock seeds
// no keyword tags for liked items in the panel-open test above (its
// `likedMovies` is unset), so the {#if rateDials.tags.length > 0} block
// hides the entire Tags section. This test seeds liked items whose pool
// entries carry realistic keyword tags so the search bar, the tag count,
// and the alphabetical tag list are all rendered and captured.
test.describe("Rate screen rate dials panel, with keyword tags seeded", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(installMockDossier, { likedMovies: 4 });
    await page.goto("/rate");
    await dismissEnrichmentModal(page);
  });

  test("the Tags section appears with a search bar and a dial per known tag", async ({ page }) => {
    await page.getByRole("button", { name: "Tune rate dials" }).click();
    const panel = page.getByRole("dialog", { name: "Rate Dials" });
    await expect(panel).toBeVisible();

    // Tags section + search bar both render once tags are known.
    await expect(panel.getByText("Tags")).toBeVisible();
    await expect(panel.getByPlaceholder("Search tags")).toBeVisible();

    // The first four pool items carry: cyberpunk, heist, small town,
    // grief, slapstick, ensemble, non-linear (heist appears on two
    // items, so the deduped tag set is 7).
    await expect(panel.locator(".group:last-child .row")).toHaveCount(7);
    await expect(panel.locator(".row", { hasText: "cyberpunk" })).toBeVisible();
    await expect(panel.locator(".row", { hasText: "heist" })).toBeVisible();

    // Search filters the list live (substring, case-insensitive).
    await panel.getByPlaceholder("Search tags").fill("HEI");
    await expect(panel.locator(".group:last-child .row")).toHaveCount(1);
    await expect(panel.locator(".row", { hasText: "heist" })).toBeVisible();

    // Reset search shows the full list again.
    await panel.getByPlaceholder("Search tags").fill("");
    await expect(panel.locator(".group:last-child .row")).toHaveCount(7);

    // A query with no matches shows the empty state.
    await panel.getByPlaceholder("Search tags").fill("zzz-no-match");
    await expect(panel.getByText(/No tags match/)).toBeVisible();

    await panel.getByPlaceholder("Search tags").fill("");
    await page.waitForTimeout(300);
    await page.screenshot({ path: "test-results/rate-dials-panel-with-tags.png", fullPage: true });
    await panel.screenshot({ path: "test-results/rate-dials-panel-with-tags-focused.png" });
  });
});

// 9 not-interested swordplay-tagged ratings are pre-seeded (see
// mock-dossier.ts), and the queue starts right at "Crimson Hour" (the
// pool's one swordplay-tagged title) — so a single live click supplies
// the 10th and should trigger the popup, without needing to walk the
// whole queue by hand.
test.describe("Rate screen tag-pattern popup, with 9 not-interested swordplay ratings already seeded", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(installMockDossier, { notInterestedHorrorSeed: 9 });
    await page.goto("/rate");
    await dismissEnrichmentModal(page);
  });

  test("the 10th same-tag rating triggers the pattern popup, and accepting turns the tag dial down", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Crimson Hour" })).toBeVisible();

    const popup = page.getByRole("alertdialog", { name: "Adjust your dials?" });
    await page.getByRole("button", { name: "I don't care about it" }).click();

    await expect(popup).toBeVisible();
    await expect(popup).toContainText("swordplay");
    await page.waitForTimeout(300);
    await popup.screenshot({ path: "test-results/rate-genre-dials-pattern-popup.png" });

    await popup.getByRole("button", { name: "Yes" }).click();
    await expect(popup).toHaveCount(0);

    // swordplay started neutral (50); accepting cuts it by a quarter:
    // 50 - 50/4 = 37.5, rounded to 38.
    await page.getByRole("button", { name: "Tune rate dials" }).click();
    const swordplayRow = page.getByRole("dialog", { name: "Rate Dials" }).locator(".row", { hasText: "swordplay" });
    await expect(swordplayRow.locator(".value")).toHaveText("38");
  });

  test("declining the pattern popup leaves the dial untouched", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Crimson Hour" })).toBeVisible();

    const popup = page.getByRole("alertdialog", { name: "Adjust your dials?" });
    await page.getByRole("button", { name: "I don't care about it" }).click();
    await expect(popup).toBeVisible();

    await popup.getByRole("button", { name: "No" }).click();
    await expect(popup).toHaveCount(0);

    await page.getByRole("button", { name: "Tune rate dials" }).click();
    const swordplayRow = page.getByRole("dialog", { name: "Rate Dials" }).locator(".row", { hasText: "swordplay" });
    await expect(swordplayRow.locator(".value")).toHaveText("50");
  });
});
