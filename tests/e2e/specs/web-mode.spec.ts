import { expect, test } from "@playwright/test";
import { installMockDossier } from "./mock-dossier";

/** A minimal app bridge with TMDB *unconfigured*, so the TMDB key gate (the
 * app's first-run setup screen) is shown — that's where "Migrate from web
 * app" lives. */
function installUnconfiguredAppBridge(): void {
  const empty = () => Promise.resolve({ page: 1, totalPages: 1, items: [] });
  (window as unknown as { dossier: unknown }).dossier = {
    platform: "app",
    app: { getVersion: () => Promise.resolve("test") },
    window: { show: () => Promise.resolve(), hide: () => Promise.resolve(), quit: () => Promise.resolve() },
    updater: { installAndRestart: () => Promise.resolve() },
    settings: {
      get: () => Promise.resolve({ theme: "system", dyslexiaMode: false, startOnLogin: false, autoUpdatesEnabled: true, skippedUpdateVersion: null, sidebarCollapsed: false, showingWelcome: false }),
      set: (n: Record<string, unknown>) => Promise.resolve(n),
      getStartOnLogin: () => Promise.resolve(false),
      setStartOnLogin: (e: boolean) => Promise.resolve(e)
    },
    preferences: {
      get: () => Promise.resolve({ ratings: {}, pairwise: [], skipped: [] }),
      setRating: () => Promise.resolve({ ratings: {} }),
      addPairwise: () => Promise.resolve({ pairwise: [] }),
      skip: () => Promise.resolve({ skipped: [] }),
      unskip: () => Promise.resolve({ skipped: [] }),
      reset: () => Promise.resolve({ ok: true })
    },
    tmdb: {
      status: () => Promise.resolve({ configured: false }),
      setToken: () => Promise.resolve({ configured: true }),
      clearToken: () => Promise.resolve({ configured: false }),
      genres: () => Promise.resolve({ genres: {} }),
      trending: empty,
      discover: empty,
      search: empty,
      detail: () => Promise.resolve({}),
      posterUrl: () => null
    },
    library: { export: () => Promise.resolve("{}"), import: () => Promise.resolve() }
  };
}

test.describe("Library export/import in Settings", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(installMockDossier);
  });

  test("settings shows the Library export/import section", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Library" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Export library" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Import library" })).toBeVisible();
    await page.screenshot({ path: "test-results/settings-library.png", fullPage: true });
  });

  test("Export library opens a passphrase prompt", async ({ page }) => {
    await page.goto("/settings");
    await page.getByRole("button", { name: "Export library" }).click();
    await expect(page.getByRole("heading", { name: "Set an export passphrase" })).toBeVisible();
    await page.waitForTimeout(450); // let the modal-enter animation settle
    await page.screenshot({ path: "test-results/export-passphrase.png", fullPage: true });
  });
});

test.describe("App setup → migrate from web", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(installUnconfiguredAppBridge);
  });

  test("the TMDB setup gate offers a migrate-from-web flow + steps modal", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Connect your TMDB account" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Migrate from web app" })).toBeVisible();

    await page.getByRole("button", { name: "How?" }).click();
    await expect(page.getByRole("heading", { name: "Bring in a web library" })).toBeVisible();
    await page.waitForTimeout(450); // let the modal-enter animation settle
    await page.screenshot({ path: "test-results/migrate-steps-modal.png", fullPage: true });
  });
});
