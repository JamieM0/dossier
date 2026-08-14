import { expect, test } from "@playwright/test";
import { dismissEnrichmentModal, installMockDossier } from "./mock-dossier";

test.describe("Recommendations card hover overlay", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(installMockDossier);
  });

  test("overlay buttons appear in Like, Dislike, Watchlist, Not interested order", async ({ page }) => {
    // Recommendations only render once at least 5 titles are rated;
    // rate 5 titles via the Rate page first (client-side nav keeps the
    // in-memory mock backend state intact — a full reload would reset it).
    await page.goto("/rate");
    await dismissEnrichmentModal(page);
    const likeButton = page.getByRole("button", { name: "Slightly positive" });
    for (let i = 0; i < 5; i++) {
      await likeButton.click();
      await page.waitForTimeout(400); // exit animation
    }

    await page.getByRole("link", { name: "Discover" }).click();
    await expect(page.getByRole("heading", { name: "Discover" })).toBeVisible();

    const card = page.locator(".card").first();
    await card.hover();

    const overlay = card.locator(".overlay-actions");
    await expect(overlay).toBeVisible();

    const labels = await overlay.locator(".overlay-btn").evaluateAll((els) =>
      els.map((el) => el.getAttribute("aria-label"))
    );
    expect(labels).toEqual(["Like", "Dislike", "Add to watchlist", "Not interested"]);

    await page.screenshot({ path: "test-results/recommendations-overlay.png" });
    await card.screenshot({ path: "test-results/recommendations-overlay-card.png" });
  });

  test("card stays minimal while the modal shows rating detail", async ({ page }) => {
    await page.goto("/rate");
    await dismissEnrichmentModal(page);
    const likeButton = page.getByRole("button", { name: "Slightly positive" });
    for (let i = 0; i < 5; i++) {
      await likeButton.click();
      await page.waitForTimeout(400);
    }
    await page.getByRole("link", { name: "Discover" }).click();
    await expect(page.getByRole("heading", { name: "Discover" })).toBeVisible();

    const card = page.locator(".card").first();
    await expect(card).not.toContainText("★");
    await expect(card).not.toContainText(/Film|Series/);

    await page.locator(".poster-btn").first().click();
    const modalMeta = page.locator(".layout .meta");
    await expect(modalMeta).toBeVisible();
    await expect(modalMeta).toContainText("★");
    await expect(modalMeta).not.toContainText("0s");
    await page.waitForTimeout(500);
    await page.screenshot({ path: "test-results/movie-detail-modal.png" });
  });

  test("card keeps the title visible and info panel opens the modal", async ({ page }) => {
    await page.goto("/rate");
    await dismissEnrichmentModal(page);
    const likeButton = page.getByRole("button", { name: "Slightly positive" });
    for (let i = 0; i < 5; i++) {
      await likeButton.click();
      await page.waitForTimeout(400);
    }
    await page.getByRole("link", { name: "Discover" }).click();
    await expect(page.getByRole("heading", { name: "Discover" })).toBeVisible();

    const card = page.locator(".card").first();
    await expect(card.locator(".identity strong")).toBeVisible();

    await card.locator(".poster-btn").click();
    await expect(page.locator(".layout .meta")).toBeVisible();
  });

  test("Library carousel tiles keep the film title and provenance visible", async ({ page }) => {
    await page.goto("/rate");
    await dismissEnrichmentModal(page);
    const likeButton = page.getByRole("button", { name: "Slightly positive" });
    await likeButton.click();
    await page.waitForTimeout(400);

    await page.getByRole("link", { name: "Library" }).click();
    await expect(page.getByRole("heading", { name: "Your Library" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Liked", exact: true })).toBeVisible();

    const tile = page.locator(".tile").first();
    await expect(tile.locator("strong")).toBeVisible();
    await expect(tile.locator(".year")).toContainText(/\d{4}/);
    await expect(tile).not.toContainText(/Film|Series/);
  });
});
