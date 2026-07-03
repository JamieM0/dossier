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
    const likeButton = page.getByRole("button", { name: "I liked it" });
    for (let i = 0; i < 5; i++) {
      await likeButton.click();
      await page.waitForTimeout(400); // exit animation
    }

    await page.getByRole("link", { name: "Recommendations" }).click();
    await expect(page.getByRole("heading", { name: "Recommendations" })).toBeVisible();

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

  test("card hides decade/rating; modal shows them", async ({ page }) => {
    await page.goto("/rate");
    await dismissEnrichmentModal(page);
    const likeButton = page.getByRole("button", { name: "I liked it" });
    for (let i = 0; i < 5; i++) {
      await likeButton.click();
      await page.waitForTimeout(400);
    }
    await page.getByRole("link", { name: "Recommendations" }).click();
    await expect(page.getByRole("heading", { name: "Recommendations" })).toBeVisible();

    const cardMeta = page.locator(".card").first().locator(".meta");
    await expect(cardMeta).not.toContainText("★");
    await expect(cardMeta).not.toContainText("0s");

    await page.locator(".poster-btn").first().click();
    const modalMeta = page.locator(".layout .meta");
    await expect(modalMeta).toBeVisible();
    await expect(modalMeta).toContainText("★");
    await expect(modalMeta).toContainText("0s");
    await page.screenshot({ path: "test-results/movie-detail-modal.png" });
  });

  test("card hides the film title and info panel opens the modal", async ({ page }) => {
    await page.goto("/rate");
    await dismissEnrichmentModal(page);
    const likeButton = page.getByRole("button", { name: "I liked it" });
    for (let i = 0; i < 5; i++) {
      await likeButton.click();
      await page.waitForTimeout(400);
    }
    await page.getByRole("link", { name: "Recommendations" }).click();
    await expect(page.getByRole("heading", { name: "Recommendations" })).toBeVisible();

    const card = page.locator(".card").first();
    await expect(card.locator("h3")).toHaveCount(0);

    // Clicking the info panel (not just the poster) opens the detail modal.
    await card.locator(".body").click();
    await expect(page.locator(".layout .meta")).toBeVisible();
  });

  test("Library carousel tiles hide the film title", async ({ page }) => {
    await page.goto("/rate");
    await dismissEnrichmentModal(page);
    const likeButton = page.getByRole("button", { name: "I liked it" });
    await likeButton.click();
    await page.waitForTimeout(400);

    await page.getByRole("link", { name: "Library" }).click();
    await expect(page.getByRole("heading", { name: "Library" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Liked", exact: true })).toBeVisible();

    const tile = page.locator(".tile").first();
    await expect(tile.locator("p", { hasText: /^\d{4}$/ })).toBeVisible();
    // No separate title element — the poster + year are the only content.
    const paragraphCount = await tile.locator("p").count();
    expect(paragraphCount).toBe(1);
  });
});
