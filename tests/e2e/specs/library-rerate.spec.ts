import { expect,test } from "@playwright/test";
import { dismissEnrichmentModal,installMockDossier } from "./mock-dossier";

test("Library carousel fullscreen opens the poster-led re-rate flow",async({page})=>{
  await page.addInitScript(installMockDossier,{likedMovies:5});
  await page.goto("/library"); await dismissEnrichmentModal(page);
  await page.getByRole("button",{name:"Re-rate Liked in fullscreen"}).click();
  await expect(page.getByRole("dialog",{name:"Liked"})).toBeVisible();
  await expect(page.getByText("Library · Re-rate")).toBeVisible();
  await expect(page.getByRole("button",{name:/Keep as is/}).first()).toBeVisible();
  await page.screenshot({path:"test-results/library-rerate-full.png",fullPage:true});
  const firstTitle=await page.locator(".info h2").innerText();
  await page.getByRole("button",{name:/Keep as is/}).first().click();
  await expect(page.locator(".info h2")).not.toHaveText(firstTitle);
});
