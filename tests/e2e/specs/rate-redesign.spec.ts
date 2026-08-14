import { expect, test } from "@playwright/test";
import { dismissEnrichmentModal, installMockDossier } from "./mock-dossier";

test.describe("Rate screen redesign", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(installMockDossier);
    await page.goto("/rate");
    await dismissEnrichmentModal(page);
    await expect(page.locator(".info .title")).toBeVisible({ timeout: 15_000 });
  });

  test("full details are on the main screen, with the 7-point rank scale plus watchlist/skip/not-interested", async ({ page }) => {
    await expect(page.locator(".info .title")).toBeVisible();
    await expect(page.locator(".info .overview")).toBeVisible();

    const labels = await page
      .locator(".action-btn")
      .evaluateAll((els) => els.map((el) => el.getAttribute("aria-label")));
    expect(labels).toEqual([
      "Extremely negative",
      "Fairly negative",
      "Slightly negative",
      "Neutral",
      "Slightly positive",
      "Fairly positive",
      "Extremely positive",
      "Add to my Watchlist",
      "I haven't seen it",
      "I don't care about it"
    ]);

    // The 7 rank buttons form their own group, distinct from the three
    // legacy action buttons below.
    await expect(page.locator(".rank-scale .rank-btn")).toHaveCount(7);

    // No mode toggle, no separate detail modal.
    await expect(page.locator(".mode-toggle")).toHaveCount(0);
    await page.locator(".poster-wrap").click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("keyboard hint documents the 1-7 rank shortcuts plus arrows/space/backspace", async ({ page }) => {
    const popover = page.locator(".hint-popover");
    await expect(popover).toHaveCount(1);
    await expect(popover).toHaveCSS("opacity", "0");
    await page.getByRole("button", { name: "Keyboard shortcuts" }).hover();
    await expect(popover).toHaveCSS("opacity", "1");
    await expect(popover).toContainText("rate");
    await expect(popover).toContainText("slightly negative");
    await expect(popover).toContainText("slightly positive");
    await expect(popover).toContainText("watchlist");
    await expect(popover).toContainText("undo");
  });

  test("clicking a rank button rates the title", async ({ page }) => {
    await expect(page.getByText("0 rated")).toBeVisible();
    await page.getByRole("button", { name: "Extremely positive" }).click();
    await expect(page.getByText("1 rated")).toBeVisible();
  });

  test("clicking the neutral (0) rank commits without error", async ({ page }) => {
    await expect(page.getByText("0 rated")).toBeVisible();
    await page.getByRole("button", { name: "Neutral", exact: true }).click();
    await expect(page.getByText("1 rated")).toBeVisible();
    await expect(page.locator(".error")).toHaveCount(0);
  });

  test("each of the 7 rank buttons is independently clickable and advances the queue", async ({ page }) => {
    test.slow(); // animation-heavy: several exit/entrance cycles back to back
    for (let i = 0; i < 7; i++) {
      await expect(page.getByText(`${i} rated`)).toBeVisible();
      const btn = page.locator(".rank-scale .rank-btn").first();
      // decide() holds the card on screen for a ~320ms exit animation and
      // keeps buttons disabled (`busy`) for that whole window; wait for
      // enabled explicitly rather than relying on click()'s own
      // actionability retry. Move the mouse off the button first and use
      // force:true — the previous click leaves the cursor resting on this
      // screen position, and the next remounted button's hover/entrance
      // transitions there can make Playwright's stability check spin
      // indefinitely even though the element is perfectly clickable.
      await expect(btn).toBeEnabled();
      await page.mouse.move(0, 0);
      await btn.click({ force: true });
      await expect(page.getByText(`${i + 1} rated`)).toBeVisible();
      await page.waitForTimeout(400); // let the exit/entrance animation settle
    }
    await expect(page.getByText("7 rated")).toBeVisible();
  });

  test("number keys 1-7 rate via keyboard shortcut", async ({ page }) => {
    await expect(page.getByText("0 rated")).toBeVisible();
    await page.keyboard.press("7");
    await expect(page.getByText("1 rated")).toBeVisible();
  });

  test("arrow keys still map to slightly negative / slightly positive (legacy like/dislike sentinels)", async ({ page }) => {
    await expect(page.getByText("0 rated")).toBeVisible();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByText("1 rated")).toBeVisible();
  });

  test("dragging the poster past the first threshold commits a rating", async ({ page }) => {
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

  test("dragging below the first threshold snaps back without rating", async ({ page }) => {
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

  test("dragging shows a live intensity stamp that escalates with distance", async ({ page }) => {
    const box = await page.locator(".poster-wrap").boundingBox();
    if (!box) throw new Error("poster not found");
    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();

    // Under the first threshold: no stamp yet.
    await page.mouse.move(startX + 40, startY, { steps: 3 });
    await expect(page.locator(".drag-stamp")).toHaveCount(0);

    // Past the first threshold: "slightly positive" stamp appears.
    await page.mouse.move(startX + 100, startY, { steps: 3 });
    await expect(page.locator(".drag-stamp")).toHaveCount(1);
    await expect(page.locator(".drag-stamp .stamp-label")).toHaveText("Slightly positive");

    // Past the third threshold: escalates to "extremely positive".
    await page.mouse.move(startX + 260, startY, { steps: 5 });
    await expect(page.locator(".drag-stamp .stamp-label")).toHaveText("Extremely positive");

    await page.mouse.up();
    await page.waitForTimeout(700);
  });

  test("mobile swipe velocity conservatively promotes a nearby stage", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const poster = page.locator(".poster-wrap");
    let box = await poster.boundingBox();
    if (!box) throw new Error("poster not found");
    let startX = box.x + box.width / 2;
    let startY = box.y + box.height / 2;

    // 78px is below the 88px "fairly" threshold. A deliberate drag
    // therefore remains slight.
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    for (const offset of [20, 40, 60, 78]) {
      await page.mouse.move(startX + offset, startY);
      await page.waitForTimeout(120);
    }
    await expect(page.locator(".swipe-feedback .feedback-copy strong")).toHaveText("Slightly");
    await page.mouse.up();
    await page.waitForTimeout(700);

    // The same distance reached as a flick gets a modest one-stage lift.
    box = await poster.boundingBox();
    if (!box) throw new Error("next poster not found");
    startX = box.x + box.width / 2;
    startY = box.y + box.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 1, startY);
    await page.waitForTimeout(12);
    await page.mouse.move(startX + 78, startY);
    expect(await page.locator(".swipe-feedback .feedback-copy strong").textContent()).toBe("Fairly");
    await page.mouse.up();
    await page.waitForTimeout(700);
    await expect(page.getByText("2 rated")).toBeVisible();
  });

  test("mobile gesture stages stay on-screen while the poster travels freely and iOS haptics fire on release", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.evaluate(() => {
      Object.defineProperty(navigator, "userAgent", {
        configurable: true,
        value: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1"
      });
      (window as unknown as { __ratingHapticChanges: number }).__ratingHapticChanges = 0;
      document.addEventListener("change", (event) => {
        const target = event.target;
        if (target instanceof HTMLInputElement && target.matches('input[switch]')) {
          (window as unknown as { __ratingHapticChanges: number }).__ratingHapticChanges += 1;
        }
      }, true);
    });

    const poster = page.locator(".poster-wrap");
    const box = await poster.boundingBox();
    if (!box) throw new Error("poster not found");
    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 58, startY, { steps: 4 });
    await expect(page.locator(".swipe-feedback .feedback-copy strong")).toHaveText("Slightly");
    await expect(page.locator(".feedback-depth i.active")).toHaveCount(1);

    await page.mouse.move(startX + 102, startY, { steps: 4 });
    await expect(page.locator(".swipe-feedback .feedback-copy strong")).toHaveText("Fairly");
    await expect(page.locator(".feedback-depth i.active")).toHaveCount(2);

    await page.mouse.move(startX + 146, startY, { steps: 4 });
    await expect(page.locator(".swipe-feedback .feedback-copy strong")).toHaveText("Extremely");
    await expect(page.locator(".feedback-depth i.active")).toHaveCount(3);
    await expect(page.locator(".swipe-atmosphere")).toHaveCSS("position", "fixed");

    const hapticsDuringMove = await page.evaluate(() => (window as unknown as { __ratingHapticChanges: number }).__ratingHapticChanges);
    expect(hapticsDuringMove).toBe(0);

    const audit = await page.evaluate(() => {
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      const feedback = document.querySelector(".swipe-feedback")?.getBoundingClientRect();
      const posterRect = document.querySelector(".poster-wrap")?.getBoundingClientRect();
      const visiblePosterWidth = posterRect
        ? Math.max(0, Math.min(viewport.width, posterRect.right) - Math.max(0, posterRect.left))
        : 0;
      return {
        viewport,
        scrollY: window.scrollY,
        feedbackFullyVisible: Boolean(feedback && feedback.left >= 0 && feedback.right <= viewport.width && feedback.top >= 0 && feedback.bottom <= viewport.height),
        posterVisibleWidthRatio: posterRect ? Number((visiblePosterWidth / posterRect.width).toFixed(3)) : 0,
        activeDepths: document.querySelectorAll(".feedback-depth i.active").length,
        stage: document.querySelector(".feedback-copy strong")?.textContent
      };
    });
    expect(audit.feedbackFullyVisible).toBe(true);
    expect(audit.posterVisibleWidthRatio).toBeGreaterThan(0.5);
    expect(audit.posterVisibleWidthRatio).toBeLessThan(0.82);
    expect(audit.scrollY).toBe(0);
    await testInfo.attach("mobile-swipe-audit", {
      body: JSON.stringify(audit, null, 2),
      contentType: "application/json"
    });
    await page.screenshot({ path: "test-results/rate-mobile-extreme-swipe.png" });

    await page.mouse.up();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __ratingHapticChanges: number }).__ratingHapticChanges)).toBe(3);
    await page.waitForTimeout(700);
    await expect(page.getByText("1 rated")).toBeVisible();
  });

  test("visual review: full screen and focused rank-scale screenshots", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Rate what you know" })).toBeVisible();
    await expect(page.locator(".rank-scale")).toBeVisible();
    await page.screenshot({ path: "test-results/rate-redesign-full.png", fullPage: true });
    await page.locator(".actions").screenshot({ path: "test-results/rate-redesign-actions.png" });
    await page.locator(".rank-scale").screenshot({ path: "test-results/rate-redesign-rank-scale.png" });

    // Hover state on a rank button (frosted poster-crop reveal).
    await page.locator(".rank-scale .rank-btn").nth(6).hover();
    await page.waitForTimeout(300);
    await page.locator(".actions").screenshot({ path: "test-results/rate-redesign-rank-hover.png" });

    // Mid-drag stamp screenshot.
    const box = await page.locator(".poster-wrap").boundingBox();
    if (!box) throw new Error("poster not found");
    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 230, startY, { steps: 6 });
    await page.waitForTimeout(100);
    await page.locator(".poster-wrap").screenshot({ path: "test-results/rate-redesign-drag-stamp.png" });
    await page.mouse.up();
    await page.waitForTimeout(700);
  });
});
