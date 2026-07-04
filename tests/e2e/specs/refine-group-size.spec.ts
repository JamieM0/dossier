import { expect, test } from "@playwright/test";
import { dismissEnrichmentModal, installMockDossier } from "./mock-dossier";

test.describe("Refine screen — configurable group size", () => {
  // Ratings are seeded directly via installMockDossier's init-script
  // argument (applied before the app's first hydrate()) rather than by
  // driving the Rate screen's "I liked it" button in a loop: that button
  // triggers a 320ms card-exit animation per click, and under load
  // Playwright's actionability "stable" check can flap against the
  // transform mid-transition, making a multi-click seeding loop slow and
  // flaky. Seeding directly is faster and keeps these tests focused on
  // the Refine screen rather than the Rate screen's animation timing.

  async function setGroupSize(page: import("@playwright/test").Page, value: number): Promise<void> {
    await page.getByRole("link", { name: "Settings" }).click();
    await expect(page.getByText("Refine group size")).toBeVisible();
    const current = Number(await page.locator(".stepper-value").innerText());
    const delta = value - current;
    const btn = page.getByRole("button", {
      name: delta > 0 ? "Increase refine group size" : "Decrease refine group size"
    });
    for (let i = 0; i < Math.abs(delta); i++) {
      await btn.click();
    }
    await expect(page.locator(".stepper-value")).toHaveText(String(value));
  }

  test("default group size 2 keeps the original pairwise duel", async ({ page }) => {
    await page.addInitScript(installMockDossier, { likedMovies: 5 });
    await page.goto("/refine");
    await dismissEnrichmentModal(page);

    await expect(page.getByRole("heading", { name: "Which do you prefer?" })).toBeVisible();
    await expect(page.locator(".duel")).toBeVisible();
    await expect(page.locator(".pick")).toHaveCount(2);
    await expect(page.locator(".ranking")).toHaveCount(0);

    await page.screenshot({ path: "test-results/refine-duel-full.png", fullPage: true });
    await page.locator(".duel").screenshot({ path: "test-results/refine-duel-focused.png" });

    // Original interaction still works: clicking a card records a choice
    // and advances the answered counter. The counter's pre-existing "+1"
    // wording counts the pair currently on screen as in-progress, so
    // starting from 0 pairwise choices it reads "1 answered" before any
    // click and "2 answered" once the first choice is recorded.
    await expect(page.getByText("1 answered")).toBeVisible();
    await page.locator(".pick").first().click();
    await expect(page.getByText("2 answered")).toBeVisible();
  });

  test("group size > 2 shows a drag-to-reorder ranking list with poster, title, year, genre and match badge", async ({ page }) => {
    await page.addInitScript(installMockDossier, { likedMovies: 6 });
    await page.goto("/settings");
    await dismissEnrichmentModal(page);
    await setGroupSize(page, 5);

    await page.getByRole("link", { name: "Refine" }).click();
    await expect(page.getByRole("heading", { name: "Rank your favorites" })).toBeVisible();
    await expect(page.locator(".rank-row")).toHaveCount(5);
    await expect(page.locator(".duel")).toHaveCount(0);

    const firstRow = page.locator(".rank-row").first();
    await expect(firstRow.locator(".rank-poster, .rank-poster-empty")).toBeVisible();
    await expect(firstRow.locator(".rank-caption h3")).not.toBeEmpty();
    await expect(firstRow.locator(".match-badge.small")).toContainText("match");

    await page.screenshot({ path: "test-results/refine-ranking-full.png", fullPage: true });
    await page.locator(".ranking").screenshot({ path: "test-results/refine-ranking-focused.png" });
  });

  test("dragging a row is strictly vertical: horizontal drag never reorders or shifts the card sideways", async ({ page }) => {
    await page.addInitScript(installMockDossier, { likedMovies: 6 });
    await page.goto("/settings");
    await dismissEnrichmentModal(page);
    await setGroupSize(page, 5);
    await page.getByRole("link", { name: "Refine" }).click();
    await expect(page.locator(".rank-row")).toHaveCount(5);

    const titlesBefore = await page.locator(".rank-caption h3").allInnerTexts();
    const row = page.locator(".rank-row").first();
    const box = await row.boundingBox();
    if (!box) throw new Error("row not found");
    const gripBox = await row.locator(".grip").boundingBox();
    if (!gripBox) throw new Error("grip not found");

    const startX = gripBox.x + gripBox.width / 2;
    const startY = gripBox.y + gripBox.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    // Large horizontal-only movement — must not move the card sideways
    // or trigger any reorder.
    await page.mouse.move(startX + 250, startY, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(150);

    const boxAfterHorizontal = await row.boundingBox();
    if (!boxAfterHorizontal) throw new Error("row not found after drag");
    expect(Math.abs(boxAfterHorizontal.x - box.x)).toBeLessThan(2);

    const titlesAfterHorizontal = await page.locator(".rank-caption h3").allInnerTexts();
    expect(titlesAfterHorizontal).toEqual(titlesBefore);
  });

  test("dragging a row down past a neighbor's midpoint swaps their order", async ({ page }) => {
    await page.addInitScript(installMockDossier, { likedMovies: 6 });
    await page.goto("/settings");
    await dismissEnrichmentModal(page);
    await setGroupSize(page, 5);
    await page.getByRole("link", { name: "Refine" }).click();
    await expect(page.locator(".rank-row")).toHaveCount(5);

    const titlesBefore = await page.locator(".rank-caption h3").allInnerTexts();
    const firstRow = page.locator(".rank-row").nth(0);
    const rowBox = await firstRow.boundingBox();
    if (!rowBox) throw new Error("row not found");
    const gripBox = await firstRow.locator(".grip").boundingBox();
    if (!gripBox) throw new Error("grip not found");

    const startX = gripBox.x + gripBox.width / 2;
    const startY = gripBox.y + gripBox.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    // Drag straight down past the next row's midpoint (more than one row
    // height) to force a swap with the second row.
    await page.mouse.move(startX, startY + rowBox.height + 6, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(150);

    const titlesAfter = await page.locator(".rank-caption h3").allInnerTexts();
    expect(titlesAfter[0]).toBe(titlesBefore[1]);
    expect(titlesAfter[1]).toBe(titlesBefore[0]);
  });

  test("move-up/move-down buttons reorder rows without dragging, and Save order commits pairwise choices", async ({ page }) => {
    await page.addInitScript(installMockDossier, { likedMovies: 6 });
    await page.goto("/settings");
    await dismissEnrichmentModal(page);
    await setGroupSize(page, 4);
    await page.getByRole("link", { name: "Refine" }).click();
    await expect(page.locator(".rank-row")).toHaveCount(4);

    const titlesBefore = await page.locator(".rank-caption h3").allInnerTexts();
    // Move the second row up one slot.
    await page.locator(".rank-row").nth(1).getByLabel(/Move .* up/).click();
    const titlesAfterMove = await page.locator(".rank-caption h3").allInnerTexts();
    expect(titlesAfterMove[0]).toBe(titlesBefore[1]);
    expect(titlesAfterMove[1]).toBe(titlesBefore[0]);

    await expect(page.getByText("0 answered so far")).toBeVisible();
    await page.getByRole("button", { name: "Save order" }).click();
    await expect(page.getByText("Saving…")).toHaveCount(0, { timeout: 5000 });
    // C(4,2) = 6 pairs get recorded from a fresh group.
    await expect(page.getByText("6 answered so far")).toBeVisible({ timeout: 5000 });
  });
});
