import { expect, test } from "@playwright/test";

test("loads the placeholder landing page", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Dossier" })).toBeVisible();
});

test("settings page renders Appearance and System sections", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Appearance" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "System" })).toBeVisible();
});
