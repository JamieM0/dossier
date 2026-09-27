import { expect,test } from "@playwright/test";
import { dismissEnrichmentModal,installMockDossier } from "./mock-dossier";

test("Library carousel re-rates each title through the detail modal queue",async({page})=>{
  await page.addInitScript(installMockDossier,{likedMovies:5,preferenceDelayMs:700});
  await page.goto("/library"); await dismissEnrichmentModal(page);

  await page.getByRole("button",{name:/Starfall Saga/}).click();
  await expect(page.getByRole("dialog").getByRole("button",{name:"Haven't seen"})).toBeVisible();
  await page.getByRole("dialog").getByRole("button",{name:"Close"}).click();

  await page.getByRole("button",{name:"Re-rate Liked in queue"}).click();

  const dialog=page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button",{name:"Like",exact:true})).toHaveCount(0);
  await expect(dialog.getByRole("button",{name:"Haven't seen"})).toBeVisible();
  await expect(dialog.getByRole("button",{name:"Leave as is"})).toBeVisible();
  const firstTitle=await dialog.getByRole("heading").innerText();

  await page.keyboard.press("Enter");
  await expect(dialog.getByRole("heading")).not.toHaveText(firstTitle);
  const secondTitle=await dialog.getByRole("heading").innerText();

  await page.keyboard.press("Space");
  await expect(dialog.getByRole("heading")).not.toHaveText(secondTitle);
  await expect(page.getByRole("status",{name:"Processing changes"})).toBeVisible();
  await expect(page.getByRole("status",{name:"Processing changes"})).toBeHidden();

  await dialog.getByRole("button",{name:"Close"}).click();
  await page.getByRole("button",{name:"Re-rate Liked in queue"}).click();
  const choice=page.getByRole("dialog",{name:"Pick up Liked?"});
  await expect(choice).toBeVisible();
  await choice.getByRole("button",{name:/Continue where you left off/}).click();
  await expect(dialog.getByRole("heading")).not.toHaveText(firstTitle);

  await dialog.getByRole("button",{name:"Close"}).click();
  await page.getByRole("button",{name:"Re-rate Liked in queue"}).click();
  await page.getByRole("dialog",{name:"Pick up Liked?"}).getByRole("button",{name:/Start over/}).click();
  await expect(dialog.getByRole("heading")).toHaveText(firstTitle);
});
