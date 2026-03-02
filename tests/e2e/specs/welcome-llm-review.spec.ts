import { expect, test } from "@playwright/test";
import { writeFile } from "node:fs/promises";

test.describe("Welcome flow LLM integration review", () => {
  test("capture onboarding UI artifacts and interaction signals", async ({ page }, testInfo) => {
    await page.goto("/profile");
    await expect(page.getByRole("heading", { name: "Welcome to Dossier" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Connect AI model" })).toBeVisible();

    const llmPanel = page.locator(".welcome-card .llm-panel").first();
    await expect(llmPanel).toBeVisible();

    await page.screenshot({
      path: testInfo.outputPath("welcome-flow-full.png"),
      fullPage: true
    });

    await llmPanel.screenshot({
      path: testInfo.outputPath("welcome-llm-panel.png")
    });

    const topicSetupCard = page
      .locator(".welcome-card")
      .filter({ has: page.getByRole("heading", { name: "Block sensitive topics" }) })
      .first();
    await expect(topicSetupCard).toBeVisible();
    const customTopicInput = topicSetupCard.getByPlaceholder("Add a custom blocked topic");
    await expect(customTopicInput).toBeVisible();

    await customTopicInput.fill("family planning");
    const pendingTopicPill = topicSetupCard.locator(".chip-pending-custom");
    await expect(pendingTopicPill).toHaveText("family planning");

    await topicSetupCard.screenshot({
      path: testInfo.outputPath("welcome-topics-pending-pill.png")
    });

    await pendingTopicPill.click();
    await expect(customTopicInput).toHaveValue("");
    const clickedPromotedPill = topicSetupCard.locator(".chip-custom-selected").filter({ hasText: "family planning" });
    await expect(clickedPromotedPill).toBeVisible();

    await clickedPromotedPill.click();
    await expect(clickedPromotedPill).toHaveCount(0);

    await customTopicInput.fill("medical history");
    await customTopicInput.press("Enter");
    await expect(customTopicInput).toHaveValue("");
    const enterPromotedPill = topicSetupCard.locator(".chip-custom-selected").filter({ hasText: "medical history" });
    await expect(enterPromotedPill).toBeVisible();

    await topicSetupCard.screenshot({
      path: testInfo.outputPath("welcome-topics-selected-pill.png")
    });

    const importCard = page
      .locator(".welcome-card")
      .filter({ has: page.getByRole("heading", { name: "Import your data" }) })
      .first();
    await expect(importCard).toBeVisible();

    const selectSourceButton = importCard.getByRole("button", { name: "Select folder or zip" }).first();
    const planButton = importCard.getByRole("button", { name: "Create ingestion plan" }).first();
    const runImportButton = importCard.getByRole("button", { name: "Run import" });
    const addSourceButton = importCard.getByRole("button", { name: "+ Add another account source" });
    const importPathInputs = importCard.locator('input[placeholder="Paste a folder or .zip path"]');

    await expect(selectSourceButton).toBeVisible();
    await expect(planButton).toBeVisible();
    await expect(runImportButton).toBeVisible();
    await expect(addSourceButton).toBeVisible();
    await expect(importPathInputs).toHaveCount(1);

    await importPathInputs.first().fill("/tmp/example@gmail.com/Takeout.zip");
    await expect(importCard.locator(".takeout-account-title").first()).toContainText("example@gmail.com");

    await addSourceButton.click();
    await expect(importPathInputs).toHaveCount(2);
    await importPathInputs.nth(1).fill("/tmp/takeout-example2@domain.com.zip");
    await expect(importCard.locator(".takeout-account-title").nth(1)).toContainText("example2@domain.com");

    await importCard.screenshot({
      path: testInfo.outputPath("welcome-takeout-card.png")
    });

    const localModelInput = page.locator("#llm-model");
    const endpointInput = page.locator("#llm-endpoint");
    const authPanel = page.locator(".welcome-card .llm-panel .auth-panel");
    const openAiChoice = page.locator(".provider-choice").filter({ hasText: /^OpenAI/ });
    const customChoice = page.locator(".provider-choice").filter({ hasText: /^Custom/ });

    await page.getByRole("button", { name: /Remote/ }).click();
    await expect(openAiChoice).toBeVisible();
    await openAiChoice.click();
    const openAiEndpointVisible = await endpointInput.isVisible().catch(() => false);
    const openAiAuthVisible = await authPanel.isVisible().catch(() => false);

    await llmPanel.screenshot({
      path: testInfo.outputPath("welcome-llm-panel-remote-openai.png")
    });

    await customChoice.click();
    await expect(endpointInput).toBeVisible();
    const customEndpointVisible = await endpointInput.isVisible().catch(() => false);
    const customAuthVisible = await authPanel.isVisible().catch(() => false);

    await llmPanel.screenshot({
      path: testInfo.outputPath("welcome-llm-panel-remote-custom.png")
    });

    await page.getByRole("button", { name: /Local/ }).click();
    const localAuthVisible = await authPanel.isVisible().catch(() => false);
    const localEndpointVisible = await endpointInput.isVisible().catch(() => false);
    const localModelVisible = await localModelInput.isVisible().catch(() => false);

    const saveButton = page.getByRole("button", { name: "Save & continue" });
    const testConnectionButton = page.getByRole("button", { name: "Test connection" });
    const detectButton = page.getByRole("button", { name: "Detect local models" });
    const skipButton = page.getByRole("button", { name: "Skip model setup" });

    const audit = await page.evaluate(() => {
      const panel = document.querySelector(".welcome-card .llm-panel") as HTMLElement | null;
      const panelRect = panel?.getBoundingClientRect();
      const topicCard = Array.from(document.querySelectorAll(".welcome-card")).find((card) =>
        card.querySelector(".section-heading")?.textContent?.includes("Block sensitive topics")
      ) as HTMLElement | undefined;
      const topicCardRect = topicCard?.getBoundingClientRect();
      const topicInput = topicCard?.querySelector('input[placeholder="Add a custom blocked topic"]');
      const pendingTopic = topicCard?.querySelector(".chip-pending-custom");
      const customSelectedTopics = Array.from(topicCard?.querySelectorAll(".chip-custom-selected") ?? []).map(
        (pill) => (pill.textContent ?? "").trim()
      );
      const topicChips = Array.from(topicCard?.querySelectorAll(".chips .chip") ?? []).map((chip) =>
        (chip.textContent ?? "").trim()
      );
      const importCard = Array.from(document.querySelectorAll(".welcome-card")).find((card) =>
        card.querySelector(".section-heading")?.textContent?.includes("Import your data")
      ) as HTMLElement | undefined;
      const importButtons = Array.from(importCard?.querySelectorAll("button") ?? []).map((btn) =>
        (btn.textContent ?? "").trim()
      );
      const importInputs = Array.from(
        importCard?.querySelectorAll('input[placeholder="Paste a folder or .zip path"]') ?? []
      ) as HTMLInputElement[];
      const accountCards = Array.from(importCard?.querySelectorAll(".takeout-account-card") ?? []);
      const accountTitles = accountCards.map((card) =>
        (card.querySelector(".takeout-account-title")?.textContent ?? "").trim()
      );
      const importLog = importCard?.querySelector(".takeout-log");

      return {
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        },
        bodyOverflowX: document.body.scrollWidth > document.body.clientWidth,
        panelOverflowX: panel ? panel.scrollWidth > panel.clientWidth : null,
        panelWidthPx: panelRect ? Math.round(panelRect.width) : null,
        inputCount: panel?.querySelectorAll("input").length ?? 0,
        selectCount: panel?.querySelectorAll("select").length ?? 0,
        buttonLabels: Array.from(panel?.querySelectorAll("button") ?? []).map((btn) =>
          (btn.textContent ?? "").trim()
        ),
        topicsCardPresent: Boolean(topicCard),
        topicsCardOverflowX: topicCard ? topicCard.scrollWidth > topicCard.clientWidth : null,
        topicsCardWidthPx: topicCardRect ? Math.round(topicCardRect.width) : null,
        topicsInputClearedAfterEnter: topicInput ? (topicInput as HTMLInputElement).value.length === 0 : null,
        pendingTopicVisibleAfterPromote: Boolean(pendingTopic),
        customSelectedTopics,
        topicChips,
        takeoutCardPresent: Boolean(importCard),
        takeoutButtons: importButtons,
        takeoutInputPresent: importInputs.length > 0,
        takeoutInputCount: importInputs.length,
        takeoutInputValueLengths: importInputs.map((input) => input.value.length),
        takeoutAccountCount: accountCards.length,
        takeoutAccountTitles: accountTitles,
        takeoutLogPresent: Boolean(importLog)
      };
    });

    const saveDisabled = await saveButton.isDisabled();
    const testDisabled = await testConnectionButton.isDisabled();
    const detectDisabled = await detectButton.isDisabled();
    const skipDisabled = await skipButton.isDisabled();
    const statusTextVisible = await page
      .locator(".welcome-card .llm-panel .status-text")
      .first()
      .isVisible()
      .catch(() => false);

    await skipButton.click();
    await expect(
      page.locator(".welcome-card.welcome-card-done .section-heading").filter({ hasText: "Connect AI model" })
    ).toBeVisible();

    const report = {
      saveDisabled,
      testDisabled,
      detectDisabled,
      skipDisabled,
      statusTextVisible,
      progressiveDisclosure: {
        openAiEndpointVisible,
        openAiAuthVisible,
        customEndpointVisible,
        customAuthVisible,
        localAuthVisible,
        localEndpointVisible,
        localModelVisible
      },
      ...audit
    };

    await writeFile(testInfo.outputPath("welcome-llm-audit.json"), JSON.stringify(report, null, 2), "utf8");

    await testInfo.attach("welcome-llm-audit.json", {
      contentType: "application/json",
      body: Buffer.from(JSON.stringify(report, null, 2), "utf8")
    });
  });

  test("capture settings AI profile manager artifacts and interaction signals", async ({ page }, testInfo) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();

    const llmSetting = page
      .locator(".setting-group")
      .filter({ has: page.getByText("LLM configuration", { exact: true }) })
      .first();
    await expect(llmSetting).toBeVisible();

    await page.screenshot({
      path: testInfo.outputPath("settings-ai-profiles-full.png"),
      fullPage: true
    });

    await llmSetting.screenshot({
      path: testInfo.outputPath("settings-ai-profiles-list.png")
    });

    const systemSection = page
      .locator(".settings-section")
      .filter({ has: page.getByRole("heading", { name: "System" }) })
      .first();
    await expect(systemSection).toBeVisible();
    await systemSection.scrollIntoViewIfNeeded();

    const autoUpdatesSetting = systemSection
      .locator(".setting-row")
      .filter({ has: page.getByText("Automatic updates", { exact: true }) })
      .first();
    await expect(autoUpdatesSetting).toBeVisible();
    await autoUpdatesSetting.screenshot({
      path: testInfo.outputPath("settings-auto-updates.png")
    });


    const createButton = llmSetting.getByRole("button", { name: "Create new profile" });
    await createButton.click();

    const nameDialog = page.locator(".dialog-modal");
    await expect(nameDialog).toBeVisible();
    const nameInput = nameDialog.getByPlaceholder("Profile name");
    await nameInput.fill("Research");
    await nameDialog.getByRole("button", { name: "Save" }).click();

    const profileModal = page.locator(".profile-modal");
    await expect(profileModal).toBeVisible();

    const cancelButton = profileModal.getByRole("button", { name: "Cancel" });
    const continueButton = profileModal.getByRole("button", { name: "Continue" });
    await expect(cancelButton).toBeVisible();
    await expect(continueButton).toBeVisible();
    await expect(profileModal.getByRole("button", { name: "Skip model setup" })).toHaveCount(0);
    await expect(profileModal.getByRole("button", { name: "Test connection" })).toHaveCount(0);

    await profileModal.screenshot({
      path: testInfo.outputPath("settings-ai-profiles-create-modal.png")
    });

    await profileModal.locator("#llm-model").fill("llama3.1");
    await continueButton.click();
    await expect(profileModal).toHaveCount(0);

    const createdProfileItem = llmSetting.locator(".ai-profile-item").filter({ hasText: "Research" }).first();
    await expect(createdProfileItem).toBeVisible();

    const makePrimaryButton = createdProfileItem.getByRole("button", { name: "Make Primary" });
    await expect(makePrimaryButton).toBeVisible();
    await makePrimaryButton.click();
    await expect(createdProfileItem.getByText("Primary")).toBeVisible();

    await llmSetting.screenshot({
      path: testInfo.outputPath("settings-ai-profiles-updated.png")
    });

    const audit = await page.evaluate(() => {
      const shell = document.querySelector(".ai-profiles-shell") as HTMLElement | null;
      const items = Array.from(document.querySelectorAll(".ai-profile-item")) as HTMLElement[];
      const createBtn = Array.from(document.querySelectorAll("button")).find((btn) =>
        btn.textContent?.trim() === "Create new profile"
      );

      const updatesRow = Array.from(document.querySelectorAll(".setting-row")).find((row) =>
        (row.querySelector(".setting-label")?.textContent ?? "").trim() === "Automatic updates"
      ) as HTMLElement | undefined;
      const updatesSwitch = updatesRow?.querySelector('button[role="switch"]') as HTMLButtonElement | null;
      const updatesChecked = updatesSwitch?.getAttribute("aria-checked");

      const updateDialogVisible = Boolean(document.querySelector("#update-dialog-title"));

      return {
        profileCount: items.length,
        profileNames: items.map((item) =>
          (item.querySelector(".ai-profile-name")?.textContent ?? "").trim()
        ),
        primaryLabels: items.map((item) => Boolean(item.querySelector(".primary-pill"))),
        makePrimaryButtons: items.map((item) =>
          Boolean(Array.from(item.querySelectorAll("button")).find((btn) =>
            btn.textContent?.trim() === "Make Primary"
          ))
        ),
        shellOverflowX: shell ? shell.scrollWidth > shell.clientWidth : null,
        shellWidthPx: shell ? Math.round(shell.getBoundingClientRect().width) : null,
        createButtonVisible: Boolean(createBtn),
        autoUpdatesTogglePresent: Boolean(updatesSwitch),
        autoUpdatesToggleChecked: updatesChecked,
        updateDialogVisible
      };
    });

    await writeFile(testInfo.outputPath("settings-ai-profiles-audit.json"), JSON.stringify(audit, null, 2), "utf8");
    await testInfo.attach("settings-ai-profiles-audit.json", {
      contentType: "application/json",
      body: Buffer.from(JSON.stringify(audit, null, 2), "utf8")
    });
  });
});
