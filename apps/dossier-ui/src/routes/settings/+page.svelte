<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { THEMES } from "$lib/design/themes";
  import type { ThemeName } from "$lib/design/themes";
  import type { LlmProfile, LocalBackupSummary, TopicRule } from "$lib/types";
  import {
    createLlmProfile,
    normalizeLlmProfiles,
    toLegacyLocalModelSettings
  } from "$lib/llm/providers";
  import { uiSettings } from "$lib/state/ui-settings.svelte";
  import ConfirmDialog from "$lib/components/ConfirmDialog.svelte";
  import LlmIntegrationPanel from "$lib/components/LlmIntegrationPanel.svelte";
  import PromptDialog from "$lib/components/PromptDialog.svelte";

  let lifecycleStatus = $state("");
  let lifecycleStatusTimer = $state<ReturnType<typeof setTimeout> | null>(null);
  let topicRules = $state<TopicRule[]>([]);
  let topicPattern = $state("");
  let backups = $state<LocalBackupSummary[]>([]);
  let backupRestorePassphrases = $state<Record<string, string>>({});

  let showExport = $state(false);
  let exportPassphrase = $state("");
  let exportArtifactJson = $state("");
  let exportAcknowledged = $state(false);

  let showImport = $state(false);
  let importPassphrase = $state("");
  let importArtifactJson = $state("");
  let importAcknowledged = $state(false);

  let showBackups = $state(false);
  let backupPassphrase = $state("");
  let backupAcknowledged = $state(false);

  let showDelete = $state(false);
  let deleteConfirmation = $state("");
  let deleteAcknowledged = $state(false);

  let restoreConfirmTarget = $state<string | null>(null);

  let isBusy = $state(false);
  let llmProfiles = $state<LlmProfile[]>([]);
  let primaryLlmProfileId = $state<string | null>(null);
  let llmIsSaving = $state(false);
  let showNewProfilePrompt = $state(false);
  let showCreateProfileModal = $state(false);
  let newProfileDraft = $state<LlmProfile | null>(null);

  function setLifecycleStatus(msg: string): void {
    lifecycleStatus = msg;
    if (lifecycleStatusTimer) clearTimeout(lifecycleStatusTimer);
    lifecycleStatusTimer = setTimeout(() => { lifecycleStatus = ""; }, 5000);
  }

  async function setTheme(name: ThemeName): Promise<void> {
    uiSettings.theme = name;
    uiSettings.applyTheme();
    await uiSettings.persist();
  }

  async function toggleDyslexia(): Promise<void> {
    uiSettings.dyslexiaMode = !uiSettings.dyslexiaMode;
    uiSettings.applyBodyMode();
    await uiSettings.persist();
  }

  async function toggleHighFidelity(): Promise<void> {
    uiSettings.highFidelityEnabled = !uiSettings.highFidelityEnabled;
    await uiSettings.persist();
    setLifecycleStatus(uiSettings.highFidelityEnabled
      ? "High-fidelity mode enabled. Raw artifacts can now be retained."
      : "High-fidelity mode disabled. Existing raw artifacts were erased.");
  }

  async function toggleStartup(): Promise<void> {
    const target = !uiSettings.startOnLogin;
    try {
      const enabled = await window.dossier?.settings.setStartOnLogin(target);
      uiSettings.startOnLogin = Boolean(enabled);
      await uiSettings.persist();
      setLifecycleStatus(enabled
        ? "Start on login is enabled at the OS level."
        : "Start on login is disabled at the OS level.");
    } catch (error) {
      setLifecycleStatus(errorToMessage(error));
    }
  }

  function maybeDefaultLabel(profile: LlmProfile, index: number): string {
    if (index === 0 && profile.name.trim().toLowerCase() === "ollama") {
      return "default";
    }
    return profile.name.trim() || `Profile ${index + 1}`;
  }

  async function saveLlmProfiles(
    profiles: LlmProfile[],
    activeLlmProfileId: string
  ): Promise<void> {
    llmIsSaving = true;
    try {
      const legacy = toLegacyLocalModelSettings(profiles, activeLlmProfileId);
      await window.dossier?.settings.set({
        llmProfiles: profiles,
        activeLlmProfileId,
        localModelEndpoint: legacy.localModelEndpoint,
        localModelName: legacy.localModelName,
        llmSetupComplete: true
      });
      llmProfiles = profiles;
      primaryLlmProfileId = activeLlmProfileId;
      uiSettings.setLlmProfiles(profiles, activeLlmProfileId);
      setLifecycleStatus("AI profile settings updated.");
    } catch (error) {
      setLifecycleStatus(errorToMessage(error));
    } finally {
      llmIsSaving = false;
    }
  }

  async function refreshLlmProfiles(): Promise<void> {
    try {
      const settings = ((await window.dossier?.settings.get()) ?? {}) as Record<string, unknown>;
      const normalized = normalizeLlmProfiles({
        llmProfiles: settings["llmProfiles"],
        activeLlmProfileId: settings["activeLlmProfileId"],
        localModelEndpoint: settings["localModelEndpoint"],
        localModelName: settings["localModelName"]
      });

      let profiles = normalized.profiles;
      let activeId = normalized.activeLlmProfileId;

      if (profiles.length === 0) {
        const fallback = createLlmProfile("ollama", "default");
        profiles = [fallback];
        activeId = fallback.id;
        await saveLlmProfiles(profiles, fallback.id);
        return;
      }

      if (profiles[0] && profiles[0].name.trim().toLowerCase() === "ollama") {
        profiles = profiles.map((profile, index) =>
          index === 0
            ? {
                ...profile,
                name: "default"
              }
            : profile
        );
        if (activeId) {
          await saveLlmProfiles(profiles, activeId);
          return;
        }
      }

      llmProfiles = profiles;
      primaryLlmProfileId = activeId;
    } catch (error) {
      setLifecycleStatus(errorToMessage(error));
      llmProfiles = [];
      primaryLlmProfileId = null;
    }
  }

  function startCreateProfile(): void {
    showNewProfilePrompt = true;
  }

  function openCreateModal(name: string): void {
    const created = createLlmProfile("ollama", name.trim());
    newProfileDraft = created;
    showCreateProfileModal = true;
  }

  function cancelCreateProfile(): void {
    showCreateProfileModal = false;
    newProfileDraft = null;
  }

  async function handleCreateProfileContinue(result?: {
    profiles: LlmProfile[];
    activeLlmProfileId: string;
  }): Promise<void> {
    const created = result?.profiles[0];
    if (!created) {
      setLifecycleStatus("Could not create profile. Try again.");
      return;
    }
    const nextProfiles = [...llmProfiles, created];
    const active = primaryLlmProfileId ?? nextProfiles[0]?.id;
    if (!active) {
      setLifecycleStatus("Could not set a primary profile.");
      return;
    }
    await saveLlmProfiles(nextProfiles, active);
    cancelCreateProfile();
  }

  async function makePrimary(profileId: string): Promise<void> {
    if (profileId === primaryLlmProfileId) {
      return;
    }
    await saveLlmProfiles(llmProfiles, profileId);
  }

  async function exportEncrypted(): Promise<void> {
    if (!exportAcknowledged || !exportPassphrase.trim()) {
      setLifecycleStatus("Acknowledge the warning and provide a passphrase to export.");
      return;
    }

    isBusy = true;
    try {
      const artifact = await window.dossier?.data.exportEncrypted(exportPassphrase);
      exportArtifactJson = artifact ? JSON.stringify(artifact, null, 2) : "";
      exportPassphrase = "";
      setLifecycleStatus("Encrypted export generated. Store it securely offline.");
    } catch (error) {
      setLifecycleStatus(errorToMessage(error));
    } finally {
      isBusy = false;
    }
  }

  async function importEncrypted(): Promise<void> {
    if (!importAcknowledged || !importPassphrase.trim() || !importArtifactJson.trim()) {
      setLifecycleStatus("Acknowledge the warning, provide a passphrase, and paste an artifact.");
      return;
    }

    isBusy = true;
    try {
      const artifact = JSON.parse(importArtifactJson) as unknown;
      await window.dossier?.data.importEncrypted(artifact, importPassphrase);
      importPassphrase = "";
      setLifecycleStatus("Encrypted import restored.");
      await refreshBackups();
    } catch (error) {
      setLifecycleStatus(errorToMessage(error));
    } finally {
      isBusy = false;
    }
  }

  async function refreshBackups(): Promise<void> {
    try {
      const response = await window.dossier?.data.listBackups();
      backups = response?.backups ?? [];
    } catch {
      backups = [];
    }
  }

  async function createBackup(): Promise<void> {
    if (!backupAcknowledged || !backupPassphrase.trim()) {
      setLifecycleStatus("Acknowledge the backup warning and provide a passphrase.");
      return;
    }

    isBusy = true;
    try {
      await window.dossier?.data.createBackup(backupPassphrase);
      backupPassphrase = "";
      setLifecycleStatus("Local encrypted backup created.");
      await refreshBackups();
    } catch (error) {
      setLifecycleStatus(errorToMessage(error));
    } finally {
      isBusy = false;
    }
  }

  async function verifyBackup(backupId: string): Promise<void> {
    isBusy = true;
    try {
      await window.dossier?.data.verifyBackup(backupId);
      setLifecycleStatus("Backup checksum verified.");
      await refreshBackups();
    } catch (error) {
      setLifecycleStatus(errorToMessage(error));
    } finally {
      isBusy = false;
    }
  }

  async function restoreBackup(backupId: string): Promise<void> {
    const passphrase = backupRestorePassphrases[backupId]?.trim();
    if (!passphrase) {
      setLifecycleStatus("Enter the backup passphrase before restoring.");
      return;
    }

    isBusy = true;
    try {
      await window.dossier?.data.restoreBackup(backupId, passphrase);
      backupRestorePassphrases[backupId] = "";
      restoreConfirmTarget = null;
      setLifecycleStatus("Backup restored. Erasure ledger protections were re-applied.");
    } catch (error) {
      setLifecycleStatus(errorToMessage(error));
    } finally {
      isBusy = false;
    }
  }

  async function deleteProfileIrreversible(): Promise<void> {
    if (!deleteAcknowledged || deleteConfirmation !== "DELETE MY PROFILE") {
      setLifecycleStatus("Type DELETE MY PROFILE and acknowledge the warning to continue.");
      return;
    }

    isBusy = true;
    try {
      await window.dossier?.data.deleteProfileIrreversible(deleteConfirmation);
      deleteConfirmation = "";
      deleteAcknowledged = false;
      exportArtifactJson = "";
      importArtifactJson = "";
      showDelete = false;
      await uiSettings.hydrateFromDesktop();
      await refreshTopicRules();
      await refreshBackups();
      await goto("/profile");
    } catch (error) {
      setLifecycleStatus(errorToMessage(error));
    } finally {
      isBusy = false;
    }
  }

  async function refreshTopicRules(): Promise<void> {
    topicRules = (await window.dossier?.topicRules.list()) ?? [];
  }

  async function addTopicRule(): Promise<void> {
    if (!topicPattern.trim()) return;
    await window.dossier?.topicRules.create({
      pattern: topicPattern.trim(),
      matchMode: "KEYWORD",
      scope: "STORAGE_AND_SHARING",
      isEnabled: true
    });
    topicPattern = "";
    await refreshTopicRules();
  }

  async function toggleTopicRule(rule: TopicRule): Promise<void> {
    await window.dossier?.topicRules.update(rule.rule_id, {
      isEnabled: !rule.is_enabled
    });
    await refreshTopicRules();
  }

  async function deleteTopicRule(ruleId: string): Promise<void> {
    await window.dossier?.topicRules.delete(ruleId);
    await refreshTopicRules();
  }

  function formatBytes(value: number): string {
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }

  function errorToMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
  }

  onMount(() => {
    void refreshTopicRules();
    void refreshBackups();
    void refreshLlmProfiles();
  });
</script>

<section class="settings-view">
  <div class="settings-content">
    <h1 class="page-heading">Settings</h1>

    {#if lifecycleStatus}
      <p class="lifecycle-status" aria-live="polite">{lifecycleStatus}</p>
    {/if}

    <div class="settings-sections">
      <section class="settings-section">
        <h2 class="section-heading">Appearance</h2>

        <div class="setting-group">
          <span class="setting-label">Theme</span>
          <div class="theme-grid">
            {#each THEMES as theme}
              <button
                class="theme-swatch"
                class:active={uiSettings.theme === theme.name}
                onclick={() => void setTheme(theme.name)}
                aria-label="Use {theme.name} theme"
                title={theme.name}
                style="
                  --sw-base: {theme.base};
                  --sw-base2: {theme['base-secondary']};
                  --sw-primary: {theme['primary-accent']};
                  --sw-secondary: {theme['secondary-accent']};
                  --sw-border-color: {theme.border};
                "
              >
                <div class="sw-bar">
                  <span class="sw-dots"><i></i><i></i><i></i></span>
                </div>
                <div class="sw-content">
                  <span class="sw-line l1"></span>
                  <span class="sw-line l2"></span>
                </div>
                <div class="sw-footer"></div>
                {#if uiSettings.theme === theme.name}
                  <div class="sw-check-badge"></div>
                {/if}
              </button>
            {/each}
          </div>
        </div>

        <div class="setting-group">
          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label" id="dyslexia-label">Dyslexia-friendly font</span>
              <span class="setting-desc">Replace default fonts with OpenDyslexic</span>
            </div>
            <button
              class="toggle"
              class:active={uiSettings.dyslexiaMode}
              onclick={() => void toggleDyslexia()}
              role="switch"
              aria-checked={uiSettings.dyslexiaMode}
              aria-labelledby="dyslexia-label"
            >
              <span class="toggle-thumb"></span>
            </button>
          </div>
        </div>
      </section>

      <section class="settings-section">
        <h2 class="section-heading">Privacy & Security</h2>

        <div class="setting-group">
          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label" id="hifi-label">High-fidelity mode</span>
              <span class="setting-desc">
                When OFF, raw artifacts are erased and cannot be recovered from live data.
              </span>
            </div>
            <button
              class="toggle"
              class:active={uiSettings.highFidelityEnabled}
              onclick={() => void toggleHighFidelity()}
              role="switch"
              aria-checked={uiSettings.highFidelityEnabled}
              aria-labelledby="hifi-label"
            >
              <span class="toggle-thumb"></span>
            </button>
          </div>
        </div>

        <div class="setting-group">
          <span class="setting-label">Blocked topics</span>
          <div class="topic-rule-row">
            <input
              class="text-input"
              type="text"
              bind:value={topicPattern}
              placeholder="Add blocked topic"
              onkeydown={(event) => {
                if (event.key === "Enter") void addTopicRule();
              }}
            />
            <button class="btn-secondary" onclick={() => void addTopicRule()}>Add</button>
          </div>

          <div class="topic-rule-list">
            {#if topicRules.length === 0}
              <p class="setting-desc">No blocked topics configured.</p>
            {/if}
            {#each topicRules as rule (rule.rule_id)}
              <div class="topic-rule-item">
                <span>{rule.pattern}</span>
                <div class="topic-rule-actions">
                  <button class="btn-secondary-sm" onclick={() => void toggleTopicRule(rule)}>
                    {rule.is_enabled ? "Disable" : "Enable"}
                  </button>
                  <button class="btn-danger-sm" onclick={() => void deleteTopicRule(rule.rule_id)}>
                    Remove
                  </button>
                </div>
              </div>
            {/each}
          </div>
        </div>

        <!-- Data Lifecycle — Progressive Disclosure -->
        <div class="setting-group">
          <span class="setting-label">Data lifecycle</span>
          <p class="setting-desc lifecycle-warning">
            Exports and backups can reveal your profile if passphrases are weak or shared.
            Use unique passphrases and store artifacts offline.
          </p>

          <div class="lifecycle-actions">
            <button class="lifecycle-toggle" class:open={showExport} onclick={() => { showExport = !showExport; }}>
              Encrypted export
              <span class="chevron" class:open={showExport}></span>
            </button>

            {#if showExport}
              <div class="lifecycle-block">
                <input class="text-input" type="password" bind:value={exportPassphrase} placeholder="Export passphrase" />
                <label class="check-row">
                  <input type="checkbox" bind:checked={exportAcknowledged} />
                  <span>I understand this export can reveal profile data if mishandled.</span>
                </label>
                <button class="btn-secondary" onclick={() => void exportEncrypted()} disabled={isBusy}>
                  Generate export
                </button>
                {#if exportArtifactJson}
                  <textarea class="text-area" readonly value={exportArtifactJson}></textarea>
                {/if}
              </div>
            {/if}

            <button class="lifecycle-toggle" class:open={showImport} onclick={() => { showImport = !showImport; }}>
              Encrypted import
              <span class="chevron" class:open={showImport}></span>
            </button>

            {#if showImport}
              <div class="lifecycle-block">
                <input class="text-input" type="password" bind:value={importPassphrase} placeholder="Import passphrase" />
                <textarea class="text-area" bind:value={importArtifactJson} placeholder="Paste encrypted artifact JSON"></textarea>
                <label class="check-row">
                  <input type="checkbox" bind:checked={importAcknowledged} />
                  <span>I understand import replaces current profile state with artifact contents.</span>
                </label>
                <button class="btn-secondary" onclick={() => void importEncrypted()} disabled={isBusy}>
                  Restore from export
                </button>
              </div>
            {/if}

            <button class="lifecycle-toggle" class:open={showBackups} onclick={() => { showBackups = !showBackups; }}>
              Local backups
              <span class="chevron" class:open={showBackups}></span>
            </button>

            {#if showBackups}
              <div class="lifecycle-block">
                <input class="text-input" type="password" bind:value={backupPassphrase} placeholder="Backup passphrase" />
                <label class="check-row">
                  <input type="checkbox" bind:checked={backupAcknowledged} />
                  <span>I understand this creates a local encrypted backup artifact.</span>
                </label>
                <button class="btn-secondary" onclick={() => void createBackup()} disabled={isBusy}>
                  Create backup
                </button>

                <div class="backup-list">
                  {#if backups.length === 0}
                    <p class="setting-desc">No local backups found.</p>
                  {:else}
                    {#each backups as backup (backup.backupId)}
                      <div class="backup-item">
                        <p>
                          <strong>{new Date(backup.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}</strong>
                          <span>{formatBytes(backup.sizeBytes)}</span>
                          <span>Verified: {backup.lastVerifiedAt ? new Date(backup.lastVerifiedAt).toLocaleDateString() : "Never"}</span>
                        </p>
                        <div class="backup-actions">
                          <button class="btn-secondary-sm" onclick={() => void verifyBackup(backup.backupId)} disabled={isBusy}>
                            Verify
                          </button>
                          <input
                            class="text-input backup-passphrase"
                            type="password"
                            value={backupRestorePassphrases[backup.backupId] ?? ""}
                            placeholder="Restore passphrase"
                            oninput={(event) => {
                              const value = (event.currentTarget as HTMLInputElement).value;
                              backupRestorePassphrases = { ...backupRestorePassphrases, [backup.backupId]: value };
                            }}
                          />
                          <button class="btn-secondary-sm" onclick={() => { restoreConfirmTarget = backup.backupId; }} disabled={isBusy}>
                            Restore
                          </button>
                        </div>
                      </div>
                    {/each}
                  {/if}
                </div>
              </div>
            {/if}
          </div>
        </div>

        <!-- Isolated Delete Section -->
        <div class="setting-group danger-zone">
          <button class="lifecycle-toggle danger" class:open={showDelete} onclick={() => { showDelete = !showDelete; }}>
            Irreversible profile deletion
            <span class="chevron" class:open={showDelete}></span>
          </button>

          {#if showDelete}
            <div class="delete-content">
              <p class="setting-desc">This permanently erases profile state and local backups from this device. This action cannot be undone.</p>
              <input class="text-input" bind:value={deleteConfirmation} placeholder="Type DELETE MY PROFILE" />
              <label class="check-row">
                <input type="checkbox" bind:checked={deleteAcknowledged} />
                <span>I understand this cannot be undone.</span>
              </label>
              <button class="btn-danger" onclick={() => void deleteProfileIrreversible()} disabled={isBusy}>
                Delete profile data
              </button>
            </div>
          {/if}
        </div>
      </section>

      <section class="settings-section">
        <h2 class="section-heading">System</h2>

        <div class="setting-group">
          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label" id="startup-label">Start on login</span>
              <span class="setting-desc">Launch Dossier automatically after OS sign-in</span>
            </div>
            <button
              class="toggle"
              class:active={uiSettings.startOnLogin}
              onclick={() => void toggleStartup()}
              role="switch"
              aria-checked={uiSettings.startOnLogin}
              aria-labelledby="startup-label"
            >
              <span class="toggle-thumb"></span>
            </button>
          </div>
        </div>

        <div class="setting-group">
          <span class="setting-label">LLM configuration</span>
          <div class="ai-profiles-shell">
            <div class="ai-profiles-list">
              {#if llmProfiles.length === 0}
                <p class="setting-desc">No AI profiles yet.</p>
              {:else}
                {#each llmProfiles as profile, index (profile.id)}
                  <div class="ai-profile-item">
                    <div class="ai-profile-meta">
                      <span class="ai-profile-name">{maybeDefaultLabel(profile, index)}</span>
                      {#if primaryLlmProfileId === profile.id}
                        <span class="primary-pill">Primary</span>
                      {/if}
                    </div>
                    {#if primaryLlmProfileId !== profile.id}
                      <button class="btn-secondary-sm" onclick={() => void makePrimary(profile.id)} disabled={llmIsSaving}>
                        Make Primary
                      </button>
                    {/if}
                  </div>
                {/each}
              {/if}
            </div>
            <button class="btn-secondary create-profile-btn" onclick={startCreateProfile} disabled={llmIsSaving}>
              Create new profile
            </button>
          </div>
        </div>
      </section>
    </div>
  </div>
</section>

<!-- Restore Confirmation Dialog -->
{#if restoreConfirmTarget}
  <ConfirmDialog
    title="Restore backup"
    message="This will replace your current profile with the backup contents. Your current profile data will be overwritten. Are you sure?"
    confirmLabel="Restore"
    danger={true}
    onConfirm={() => {
      if (restoreConfirmTarget) void restoreBackup(restoreConfirmTarget);
    }}
    onCancel={() => { restoreConfirmTarget = null; }}
  />
{/if}

{#if showNewProfilePrompt}
  <PromptDialog
    title="Create new profile"
    message="Enter a profile name."
    placeholder="Profile name"
    onConfirm={(value) => {
      showNewProfilePrompt = false;
      openCreateModal(value);
    }}
    onCancel={() => {
      showNewProfilePrompt = false;
    }}
  />
{/if}

{#if showCreateProfileModal && newProfileDraft}
  <div
    class="profile-modal-backdrop"
    onclick={(event) => {
      if (event.target === event.currentTarget) cancelCreateProfile();
    }}
    role="presentation"
  >
    <div class="profile-modal" role="dialog" aria-modal="true" aria-label="Create AI profile">
      <LlmIntegrationPanel
        mode="onboarding"
        initialProfiles={[newProfileDraft]}
        initialActiveLlmProfileId={newProfileDraft.id}
        showSkipAction={false}
        showTestAction={false}
        requireSuccessfulTest={false}
        persistOnSave={false}
        primaryActionLabel="Continue"
        onCancel={cancelCreateProfile}
        onComplete={handleCreateProfileContinue}
      />
    </div>
  </div>
{/if}

<style>
  .settings-view {
    min-height: 100vh;
    background: var(--base);
  }

  .settings-content {
    max-width: var(--content-max-width);
    margin: 0 auto;
    padding: var(--space-10) var(--space-8) var(--space-16);
  }

  .page-heading {
    font-family: var(--font-display);
    font-size: 1.5rem;
    font-weight: 600;
    line-height: 1.3;
    letter-spacing: -0.01em;
    color: var(--text-primary);
    margin-bottom: var(--space-8);
  }

  .lifecycle-status {
    font-family: var(--font-body);
    font-size: 0.9rem;
    line-height: 1.5;
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-sm);
    background: var(--info-subtle);
    color: var(--info);
    margin-bottom: var(--space-6);
    animation: entrance-fade-up var(--duration-moderate) var(--ease-out);
  }

  .settings-sections {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .settings-section {
    padding: var(--space-8) 0;
    border-bottom: 1px solid var(--border-subtle);
  }

  .settings-section:last-child {
    border-bottom: none;
  }

  .section-heading {
    font-family: var(--font-display);
    font-size: 1.25rem;
    font-weight: 600;
    line-height: 1.3;
    color: var(--text-primary);
    margin-bottom: var(--space-6);
  }

  .setting-group {
    margin-bottom: var(--space-5);
  }

  .setting-label {
    display: block;
    font-family: var(--font-body);
    font-size: 0.9375rem;
    font-weight: 500;
    line-height: 1.5;
    color: var(--text-primary);
    margin-bottom: var(--space-3);
  }

  .setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
  }

  .setting-row .setting-label {
    margin-bottom: 0;
  }

  .setting-info {
    display: flex;
    flex-direction: column;
  }

  .setting-desc {
    font-family: var(--font-body);
    font-size: 0.8125rem;
    line-height: 1.4;
    color: var(--text-tertiary);
    margin-top: var(--space-1);
  }

  .lifecycle-warning {
    margin-bottom: var(--space-4);
  }

  .theme-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(56px, 1fr));
    gap: var(--space-2);
  }

  .theme-swatch {
    aspect-ratio: 6 / 5;
    border-radius: 8px;
    background: var(--sw-base);
    border: 1px solid var(--sw-border-color);
    position: relative;
    display: flex;
    flex-direction: column;
    padding: 0;
    cursor: pointer;
  }

  .theme-swatch.active {
    outline: 2px solid var(--sw-primary);
    outline-offset: 3px;
  }

  .sw-bar {
    background: var(--sw-base2);
    height: 28%;
    border-bottom: 1px solid color-mix(in srgb, var(--sw-border-color) 70%, transparent);
    border-radius: 7px 7px 0 0;
    padding: 0 5px;
    display: flex;
    align-items: center;
  }

  .sw-dots {
    display: flex;
    gap: 2px;
  }

  .sw-dots i {
    display: block;
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: var(--sw-primary);
    opacity: 0.45;
  }

  .sw-content {
    flex: 1;
    padding: 0 6px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 3px;
  }

  .sw-line {
    display: block;
    height: 2px;
    border-radius: 2px;
    background: var(--sw-primary);
  }

  .sw-line.l1 {
    width: 72%;
    opacity: 0.3;
  }

  .sw-line.l2 {
    width: 50%;
    opacity: 0.2;
  }

  .sw-footer {
    height: 22%;
    background: var(--sw-secondary);
    border-radius: 0 0 7px 7px;
  }

  .sw-check-badge {
    position: absolute;
    top: -6px;
    right: -6px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--sw-primary);
  }

  .toggle {
    width: 44px;
    height: 24px;
    border-radius: var(--radius-full);
    background: var(--border);
    position: relative;
    padding: 2px;
    flex-shrink: 0;
  }

  .toggle.active {
    background: var(--primary-accent);
  }

  .toggle-thumb {
    display: block;
    width: 20px;
    height: 20px;
    border-radius: var(--radius-full);
    background: #fff;
    box-shadow: var(--shadow-sm);
    transition: transform var(--duration-standard) var(--ease-out);
  }

  .toggle.active .toggle-thumb {
    transform: translateX(20px);
  }

  .topic-rule-row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: var(--space-2);
  }

  .topic-rule-list {
    margin-top: var(--space-3);
    display: grid;
    gap: var(--space-2);
  }

  .topic-rule-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-3);
    background: var(--base-secondary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    padding: var(--space-2) var(--space-3);
  }

  .topic-rule-actions {
    display: flex;
    gap: var(--space-2);
  }

  /* Progressive Disclosure Lifecycle Sections */
  .lifecycle-actions {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .lifecycle-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    min-height: 44px;
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-subtle);
    background: var(--base-secondary);
    color: var(--text-primary);
    font-family: var(--font-body);
    font-size: 0.9375rem;
    font-weight: 500;
    text-align: left;
    transition: background-color var(--duration-standard) var(--ease-out);
  }

  .lifecycle-toggle:hover {
    background: var(--base-tertiary);
  }

  .lifecycle-toggle.open {
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
    border-bottom-color: transparent;
  }

  .chevron {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-right: 2px solid var(--text-tertiary);
    border-bottom: 2px solid var(--text-tertiary);
    transform: rotate(-45deg);
    transition: transform var(--duration-standard) var(--ease-out);
  }

  .chevron.open {
    transform: rotate(45deg);
  }

  .lifecycle-block {
    border: 1px solid var(--border-subtle);
    border-top: none;
    border-radius: 0 0 var(--radius-sm) var(--radius-sm);
    background: var(--base);
    padding: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    margin-bottom: var(--space-2);
    animation: entrance-fade-up var(--duration-standard) var(--ease-out);
  }

  .check-row {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
    font-family: var(--font-body);
    font-size: 0.8125rem;
    color: var(--text-secondary);
  }

  .text-input {
    min-height: 44px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-subtle);
    background: var(--base-tertiary);
    color: var(--text-primary);
    font-family: var(--font-body);
    font-size: 0.9375rem;
    padding: var(--space-3) var(--space-4);
    transition: border-color var(--duration-standard) var(--ease-out),
                background-color var(--duration-standard) var(--ease-out);
  }

  .text-input::placeholder {
    color: var(--text-tertiary);
  }

  .text-input:focus {
    outline: none;
    border-color: var(--primary-accent);
    background: var(--base);
  }

  .text-area {
    min-height: 120px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-subtle);
    background: var(--base-tertiary);
    color: var(--text-primary);
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    padding: var(--space-3) var(--space-4);
    resize: vertical;
    transition: border-color var(--duration-standard) var(--ease-out),
                background-color var(--duration-standard) var(--ease-out);
  }

  .text-area:focus {
    outline: none;
    border-color: var(--primary-accent);
    background: var(--base);
  }

  .backup-list {
    display: grid;
    gap: var(--space-2);
  }

  .backup-item {
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    padding: var(--space-3);
  }

  .backup-item p {
    display: grid;
    gap: 2px;
    margin-bottom: var(--space-2);
    font-family: var(--font-body);
    font-size: 0.8125rem;
    color: var(--text-secondary);
  }

  .backup-actions {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: var(--space-2);
    align-items: center;
  }

  .backup-passphrase {
    min-height: 36px;
    padding: var(--space-1) var(--space-3);
    font-size: 0.8125rem;
  }

  .ai-profiles-shell {
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    background: var(--base-secondary);
    padding: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .ai-profiles-list {
    display: grid;
    gap: var(--space-2);
  }

  .ai-profile-item {
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    background: var(--base);
    min-height: 52px;
    padding: var(--space-3);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .ai-profile-meta {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .ai-profile-name {
    font-family: var(--font-body);
    font-size: 0.9375rem;
    color: var(--text-primary);
    font-weight: 500;
  }

  .primary-pill {
    border-radius: var(--radius-full);
    border: 1px solid var(--success);
    color: var(--success);
    font-family: var(--font-body);
    font-size: 0.75rem;
    padding: 2px 8px;
  }

  .create-profile-btn {
    align-self: flex-start;
  }

  .profile-modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 110;
    background: color-mix(in srgb, var(--text-primary) 30%, transparent);
    backdrop-filter: var(--blur-backdrop);
    -webkit-backdrop-filter: var(--blur-backdrop);
    display: grid;
    place-items: center;
    padding: var(--space-6);
  }

  .profile-modal {
    width: min(860px, 100%);
    max-height: calc(100vh - var(--space-12));
    overflow: auto;
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--base);
    box-shadow: var(--shadow-xl);
    padding: var(--space-4);
  }

  /* Danger Zone */
  .danger-zone {
    margin-top: var(--space-8);
    border: 1px solid color-mix(in srgb, var(--error) 30%, var(--border-subtle));
    border-radius: var(--radius-md);
    padding: var(--space-4);
    background: color-mix(in srgb, var(--error) 4%, var(--base));
  }

  .lifecycle-toggle.danger {
    border-color: color-mix(in srgb, var(--error) 25%, var(--border-subtle));
    color: var(--error);
  }

  .delete-content {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding-top: var(--space-3);
    animation: entrance-fade-up var(--duration-standard) var(--ease-out);
  }

  .btn-secondary {
    min-height: 44px;
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-primary);
    font-family: var(--font-body);
    font-size: 0.9375rem;
    font-weight: 500;
    border: 1px solid var(--border);
    transition: background-color var(--duration-standard) var(--ease-out);
  }

  .btn-secondary:hover {
    background: var(--base-tertiary);
  }

  .btn-secondary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-secondary-sm {
    min-height: 36px;
    padding: var(--space-1) var(--space-3);
    border-radius: var(--radius-sm);
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text-primary);
    font-size: 0.8125rem;
    font-family: var(--font-body);
    transition: background-color var(--duration-standard) var(--ease-out);
  }

  .btn-secondary-sm:hover {
    background: var(--base-tertiary);
  }

  .btn-danger-sm {
    min-height: 36px;
    padding: var(--space-1) var(--space-3);
    border-radius: var(--radius-sm);
    background: var(--error);
    color: #ffffff;
    font-size: 0.8125rem;
    font-family: var(--font-body);
    transition: background-color var(--duration-standard) var(--ease-out);
  }

  .btn-danger-sm:hover {
    background: color-mix(in srgb, var(--error) 85%, #000);
  }

  .btn-danger {
    min-height: 44px;
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-sm);
    background: var(--error);
    color: #ffffff;
    font-family: var(--font-body);
    font-size: 0.9375rem;
    font-weight: 600;
    box-shadow: var(--shadow-sm);
    transition: background-color var(--duration-standard) var(--ease-out);
  }

  .btn-danger:hover {
    background: color-mix(in srgb, var(--error) 85%, #000);
  }

  .btn-danger:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @media (max-width: 768px) {
    .settings-content {
      padding: var(--space-8) var(--space-4) var(--space-12);
    }

    .backup-actions {
      grid-template-columns: 1fr;
    }
  }
</style>
