import { expect, test } from "@playwright/test";
import { dismissEnrichmentModal, installMockDossier } from "./mock-dossier";

test.describe("Mobile access", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    if (!testInfo.title.includes("unreachable saved endpoint")) await page.addInitScript(installMockDossier);
  });

  test("LAN setup starts an endpoint and renders its real pairing QR", async ({ page }) => {
    await page.goto("/settings");
    await page.getByRole("button", { name: "Set up" }).click();
    const dialog = page.getByRole("dialog", { name: "How should your phone reach this PC?" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: /Local Network \(LAN\)/ })).toBeVisible();
    await expect(dialog.getByRole("button", { name: /Tailscale Funnel/ })).toBeVisible();
    await expect(dialog.getByRole("button", { name: /Direct HTTPS/ })).toBeHidden();
    await page.screenshot({ path: "test-results/mobile-access-options.png", fullPage: true });
    await dialog.getByRole("button", { name: "Advanced" }).click();
    await expect(dialog.getByRole("button", { name: /Direct HTTPS/ })).toBeVisible();
    await dialog.getByRole("button", { name: /Local Network \(LAN\)/ }).click();
    const setup = page.getByRole("dialog", { name: "Local Network (LAN)" });
    await expect(setup).toBeVisible();
    await setup.getByRole("button", { name: "Start local access" }).click();
    await expect(setup.getByText("Endpoint ready")).toBeVisible();
    await expect(setup.getByLabel("Phone pairing QR code")).toBeVisible();
    await expect(setup.getByText("https://192.168.1.20:48731")).toBeVisible();
    await page.waitForTimeout(350);
    await page.screenshot({ path: "test-results/mobile-access-routes.png", fullPage: true });
  });

  test("Tailscale opens every browser page only after an explicit click", async ({ page }) => {
    await page.goto("/settings");
    await page.getByRole("button", { name: "Set up" }).click();
    await page.getByRole("button", { name: /Tailscale Funnel/ }).click();
    const setup = page.getByRole("dialog", { name: "Tailscale Funnel" });
    await expect(setup.getByText(/enable both MagicDNS and HTTPS Certificates/i)).toBeVisible();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __openedRemoteAccessUrl?: string }).__openedRemoteAccessUrl)).toBeUndefined();
    await setup.getByRole("button", { name: "Open DNS settings again" }).click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __openedRemoteAccessUrl?: string }).__openedRemoteAccessUrl)).toBe("https://console.tailscale.com/admin/dns");
    await setup.getByRole("button", { name: "I’ve enabled both — continue" }).click();
    await expect(setup.getByText(/add a node attribute targeting All users and devices/i)).toBeVisible();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __openedRemoteAccessUrl?: string }).__openedRemoteAccessUrl)).toBe("https://console.tailscale.com/admin/dns");
    await setup.getByRole("button", { name: "Open Node attributes" }).click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __openedRemoteAccessUrl?: string }).__openedRemoteAccessUrl)).toBe("https://console.tailscale.com/admin/acls/visual/node-attributes");
    await setup.getByRole("button", { name: "I’ve added Funnel — authorize Dossier" }).click();
    await expect(setup.getByText("Setting up the route")).toBeVisible();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __openedRemoteAccessUrl?: string }).__openedRemoteAccessUrl)).toBe("https://console.tailscale.com/admin/acls/visual/node-attributes");
    await setup.getByRole("button", { name: "Open Tailscale again" }).click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __openedRemoteAccessUrl?: string }).__openedRemoteAccessUrl)).toBe("https://login.tailscale.com/a/mock-dossier");
  });

  test("an unreachable saved endpoint shows automatic recovery and local QR scanning", async ({ page }) => {
    await page.addInitScript(() => { (window as unknown as { __DOSSIER_REMOTE__: boolean }).__DOSSIER_REMOTE__ = true; });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Reconnect to Dossier" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Scan a new pairing code" })).toBeVisible();
    await expect(page.getByText(/decoded only on this device/i)).toBeVisible();
    await page.screenshot({ path: "test-results/mobile-reconnect.png", fullPage: true });
  });

  test("current iPhone Safari install steps use More, Share, and Open as Web App", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __DOSSIER_REMOTE__: boolean }).__DOSSIER_REMOTE__ = true;
      Object.defineProperty(navigator, "userAgent", { value: "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 Version/26.0 Mobile/15E148 Safari/604.1" });
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/?install-pwa=1");
    const prompt = page.getByRole("dialog", { name: "Install Dossier" });
    await expect(prompt.getByText(/Tap More/i)).toBeVisible();
    await expect(prompt.getByText(/Open as Web App/i)).toBeVisible();
    await page.screenshot({ path: "test-results/mobile-ios-install.png", fullPage: true });
  });

  for (const route of ["/", "/rate", "/refine", "/library", "/settings"]) {
    test(`${route} never scrolls the whole screen horizontally at 320px`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 740 });
      await page.goto(route);
      await dismissEnrichmentModal(page);
      await expect.poll(() => page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }))).toEqual({ width: 320, scroll: 320 });
      await page.screenshot({ path: `test-results/mobile-overflow-${route === "/" ? "home" : route.slice(1)}.png`, fullPage: true });
    });
  }

  test("phone layout uses a bottom icon dock and three explicit rate actions", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/rate");
    await dismissEnrichmentModal(page);
    await expect(page.locator(".info .title")).toBeVisible({ timeout: 15_000 });

    const nav = page.locator(".sidebar-nav");
    await expect(nav).toBeVisible();
    await expect(nav.locator(".nav-item")).toHaveCount(5);
    await expect(page.locator(".rank-scale")).toBeHidden();
    await expect(page.locator(".actions > .action-btn:visible")).toHaveCount(3);
    await expect(page.locator(".not-interested-action")).toBeVisible();
    await expect(page.locator(".watchlist-action")).toBeVisible();
    await expect(page.locator(".skip-action")).toBeVisible();
    await page.screenshot({ path: "test-results/mobile-rate.png", fullPage: true });
  });

  test("swiping up records haven't seen", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/rate");
    await dismissEnrichmentModal(page);
    const poster = page.locator(".poster-wrap");
    await expect(poster).toBeVisible({ timeout: 15_000 });
    const box = await poster.boundingBox();
    if (!box) throw new Error("poster not found");
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y - 120, { steps: 8 });
    await page.mouse.up();
    await expect(page.getByText("0 rated")).toBeVisible();
    await expect(page.locator(".info .title")).not.toHaveText("Neon Vector", { timeout: 2_000 });
  });
});
