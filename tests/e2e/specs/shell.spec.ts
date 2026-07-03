import { expect, test } from "@playwright/test";
import { installMockDossier } from "./mock-dossier";

test.describe("Web build gate (no Tauri runtime)", () => {
  test("a plain browser gets the web unlock/setup gate", async ({ page }) => {
    // With no Tauri runtime and no mock, installBridge() installs the web
    // bridge → the passphrase setup gate, not the TMDB gate.
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Set up your library" })
    ).toBeVisible();
    await page.screenshot({ path: "test-results/web-gate.png", fullPage: true });
  });
});

test.describe("App screens (mocked TMDB bridge)", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(installMockDossier);
  });

  test("recommendations onboarding shows for a fresh profile", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Recommendations" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Tell Dossier what you like." })).toBeVisible();
    await page.screenshot({ path: "test-results/recommendations.png", fullPage: true });
  });

  test("rate screen presents a title card", async ({ page }) => {
    await page.goto("/rate");
    await expect(page.getByRole("heading", { name: "Rate films" })).toBeVisible();
    // A card title from the mock pool should appear once the queue loads.
    await expect(page.getByRole("heading", { name: "Neon Vector" })).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: "test-results/rate.png", fullPage: true });
  });

  test("settings renders Appearance, System, and TMDB sections", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Appearance" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "System" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "TMDB" })).toBeVisible();
    await page.screenshot({ path: "test-results/settings.png", fullPage: true });
  });

  test("library renders its sections", async ({ page }) => {
    await page.goto("/library");
    await expect(page.getByRole("heading", { name: "Library" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Watchlist" })).toBeVisible();
    await page.screenshot({ path: "test-results/library.png", fullPage: true });
  });
});
