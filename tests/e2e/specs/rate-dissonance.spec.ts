import { expect, test } from "@playwright/test";
import { dismissEnrichmentModal, installMockDossier } from "./mock-dossier";

test.describe("Rate dissonance mode", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(installMockDossier, { dissonanceProfile: true });
    await page.goto("/rate");
    await dismissEnrichmentModal(page);
    await expect(page.locator(".info .title")).toBeVisible({ timeout: 15_000 });
  });

  test("shows low-match titles and turns a strong positive surprise into a correction popup", async ({ page }) => {
    const button = page.getByRole("button", { name: "Toggle dissonance mode" });
    await expect(button).toBeVisible();
    await button.click();

    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("heading", { name: "Challenge its assumptions" })).toBeVisible();
    const assumption = page.getByRole("complementary", { name: "What Dossier is assuming" });
    await expect(assumption).toBeVisible();
    await expect(assumption).toContainText("What Dossier is assuming");
    await expect(assumption).toContainText(/because/);
    await expect(assumption).toContainText(/positive ratings lean toward/);
    await expect(assumption).toContainText(/\d+% taste match/);

    await page.getByRole("button", { name: "Extremely positive" }).click();
    const followup = page.getByRole("dialog", { name: "Unexpected response follow-up" });
    await expect(followup).toBeVisible();
    await expect(followup).toContainText("outside the patterns");
  });
});
