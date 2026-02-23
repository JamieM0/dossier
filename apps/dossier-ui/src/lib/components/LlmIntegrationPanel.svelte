<script lang="ts">
  import { onMount } from "svelte";
  import { uiSettings } from "$lib/state/ui-settings.svelte";
  import type { LlmProfile, LlmProviderId } from "$lib/types";
  import {
    LLM_PROVIDER_DEFINITIONS,
    createLlmProfile,
    getActiveLlmProfile,
    getProviderDefinition,
    isRemoteProvider,
    normalizeLlmProfiles,
    toLegacyLocalModelSettings
  } from "$lib/llm/providers";

  type LlmMode = "settings" | "onboarding";
  type LlmTestPayload = {
    provider: LlmProviderId;
    endpoint: string;
    model: string;
    authMethod: "apiKey" | "oauth";
    apiKey?: string;
    oauthToken?: string;
  };

  let {
    mode = "settings",
    onComplete
  } = $props<{
    mode?: LlmMode;
    onComplete?: () => void | Promise<void>;
  }>();

  let isLoading = $state(true);
  let isSaving = $state(false);
  let isTesting = $state(false);
  let isDetecting = $state(false);

  let profiles = $state<LlmProfile[]>([]);
  let activeLlmProfileId = $state<string | null>(null);
  let selectedProfileId = $state<string | null>(null);

  let statusMessage = $state("");
  let detectedOllamaModels = $state<string[]>([]);
  let lastAutoDetectionKey = $state("");
  let lastSuccessfulTestProfileId = $state<string | null>(null);
  let addProviderId = $state<LlmProviderId>("openai");

  let testResult = $state<{ ok: boolean; model: string; error?: string } | null>(null);

  const selectedProfile = $derived(
    profiles.find((profile) => profile.id === selectedProfileId) ?? null
  );
  const activeProfile = $derived(getActiveLlmProfile(profiles, activeLlmProfileId));

  const orderedRemoteProviders = LLM_PROVIDER_DEFINITIONS.filter(
    (provider) => provider.id !== "ollama" && provider.id !== "custom"
  );

  $effect(() => {
    selectedProfileId;
    testResult = null;
    detectedOllamaModels = [];
    lastSuccessfulTestProfileId = null;
  });

  $effect(() => {
    const profile = selectedProfile;
    if (!profile || profile.provider !== "ollama") {
      return;
    }
    const endpoint = profile.endpoint.trim();
    if (!endpoint) {
      return;
    }
    const nextKey = `${profile.id}:${endpoint}`;
    if (nextKey === lastAutoDetectionKey || isDetecting) {
      return;
    }
    lastAutoDetectionKey = nextKey;
    void detectOllamaModels();
  });

  function isLocalHostEndpoint(endpoint: string): boolean {
    try {
      const parsed = new URL(endpoint);
      const host = parsed.hostname.toLowerCase();
      return host === "127.0.0.1" || host === "localhost" || host === "::1";
    } catch {
      return false;
    }
  }

  function credentialRequired(profile: LlmProfile): boolean {
    if (profile.authMethod === "oauth") {
      return true;
    }
    if (isRemoteProvider(profile.provider)) {
      return true;
    }
    return !isLocalHostEndpoint(profile.endpoint);
  }

  function profileReady(profile: LlmProfile): boolean {
    const endpoint = profile.endpoint.trim();
    const model = profile.model.trim();
    if (!endpoint || !model) {
      return false;
    }

    if (!credentialRequired(profile)) {
      return true;
    }

    if (profile.authMethod === "oauth") {
      return Boolean(profile.oauthToken?.trim());
    }

    return Boolean(profile.apiKey?.trim());
  }

  function profileSummary(profile: LlmProfile): string {
    const provider = getProviderDefinition(profile.provider);
    const model = profile.model.trim() || "model not set";
    return `${provider.label} · ${model}`;
  }

  function updateSelectedProfile(patch: Partial<LlmProfile>): void {
    if (!selectedProfileId) {
      return;
    }
    profiles = profiles.map((profile) =>
      profile.id === selectedProfileId
        ? {
            ...profile,
            ...patch
          }
        : profile
    );
    if (selectedProfileId === activeLlmProfileId) {
      lastSuccessfulTestProfileId = null;
    }
  }

  function countProfiles(providerId: LlmProviderId): number {
    return profiles.filter((profile) => profile.provider === providerId).length;
  }

  function addProfile(providerId: LlmProviderId): void {
    const provider = getProviderDefinition(providerId);
    const sequence = countProfiles(providerId) + 1;
    const next = createLlmProfile(
      providerId,
      sequence > 1 ? `${provider.label} ${sequence}` : provider.label
    );
    profiles = [...profiles, next];
    selectedProfileId = next.id;
    if (!activeLlmProfileId) {
      activeLlmProfileId = next.id;
    }
    statusMessage = "";
  }

  function removeSelectedProfile(): void {
    if (!selectedProfile || profiles.length <= 1) {
      return;
    }

    const remaining = profiles.filter((profile) => profile.id !== selectedProfile.id);
    profiles = remaining;

    if (selectedProfile.id === activeLlmProfileId) {
      activeLlmProfileId = remaining[0]?.id ?? null;
    }

    selectedProfileId =
      remaining.find((profile) => profile.id === selectedProfileId)?.id ??
      remaining[0]?.id ??
      null;
    statusMessage = "Profile removed.";
  }

  function setActiveProfile(profileId: string): void {
    activeLlmProfileId = profileId;
    if (!selectedProfileId) {
      selectedProfileId = profileId;
    }
    statusMessage = "";
  }

  function setProvider(providerId: LlmProviderId): void {
    const provider = getProviderDefinition(providerId);
    updateSelectedProfile({
      provider: provider.id,
      endpoint: provider.defaultEndpoint,
      model: provider.defaultModel,
      authMethod: provider.defaultAuthMethod,
      apiKey: "",
      oauthToken: ""
    });
    detectedOllamaModels = [];
    lastAutoDetectionKey = "";
  }

  function toPayload(profile: LlmProfile): LlmTestPayload {
    return {
      provider: profile.provider,
      endpoint: profile.endpoint.trim(),
      model: profile.model.trim(),
      authMethod: profile.authMethod,
      ...(profile.apiKey?.trim() ? { apiKey: profile.apiKey.trim() } : {}),
      ...(profile.oauthToken?.trim() ? { oauthToken: profile.oauthToken.trim() } : {})
    };
  }

  function validateEndpoint(endpoint: string): boolean {
    try {
      const parsed = new URL(endpoint);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  }

  async function detectOllamaModels(): Promise<void> {
    if (!selectedProfile || selectedProfile.provider !== "ollama") {
      return;
    }

    const endpoint = selectedProfile.endpoint.trim();
    if (!endpoint || !validateEndpoint(endpoint)) {
      statusMessage = "Set a valid Ollama endpoint before detection.";
      return;
    }

    isDetecting = true;
    statusMessage = "";
    try {
      const result = await window.dossier?.llm.detectOllamaModels(endpoint);
      const models =
        result?.models
          ?.map((model) => model.trim())
          .filter((model) => model.length > 0) ?? [];
      detectedOllamaModels = Array.from(new Set(models));

      if (detectedOllamaModels.length > 0 && !selectedProfile.model.trim()) {
        updateSelectedProfile({ model: detectedOllamaModels[0] });
      }

      statusMessage = detectedOllamaModels.length
        ? `Detected ${detectedOllamaModels.length} local model${
            detectedOllamaModels.length === 1 ? "" : "s"
          }.`
        : "No Ollama models detected yet. Run `ollama pull <model>` first.";
    } catch (error) {
      statusMessage = error instanceof Error ? error.message : "Failed to detect Ollama models.";
      detectedOllamaModels = [];
    } finally {
      isDetecting = false;
    }
  }

  async function testConnection(): Promise<void> {
    if (!selectedProfile) {
      return;
    }

    if (!profileReady(selectedProfile)) {
      statusMessage = "Complete endpoint, model, and authentication fields before testing.";
      return;
    }

    isTesting = true;
    testResult = null;
    statusMessage = "";

    try {
      const result = await window.dossier?.llm.test(toPayload(selectedProfile));
      testResult = result ?? { ok: false, model: selectedProfile.model, error: "Connection unavailable" };
      if (testResult.ok) {
        lastSuccessfulTestProfileId = selectedProfile.id;
      }
    } catch (error) {
      testResult = {
        ok: false,
        model: selectedProfile.model,
        error: error instanceof Error ? error.message : "Connection failed"
      };
    } finally {
      isTesting = false;
    }
  }

  function sanitizedProfiles(): LlmProfile[] {
    return profiles.map((profile) => ({
      ...profile,
      name: profile.name.trim(),
      endpoint: profile.endpoint.trim(),
      model: profile.model.trim(),
      apiKey: profile.apiKey?.trim() ?? "",
      oauthToken: profile.oauthToken?.trim() ?? ""
    }));
  }

  async function saveProfiles(): Promise<void> {
    const nextProfiles = sanitizedProfiles();
    const active = getActiveLlmProfile(nextProfiles, activeLlmProfileId);
    if (!active) {
      statusMessage = "Add at least one LLM profile before saving.";
      return;
    }
    if (!profileReady(active)) {
      statusMessage = "Your active profile is incomplete. Finish it before saving.";
      return;
    }
    if (mode === "onboarding" && lastSuccessfulTestProfileId !== active.id) {
      statusMessage = "Please run a successful connection test before continuing.";
      return;
    }

    const legacy = toLegacyLocalModelSettings(nextProfiles, active.id);

    isSaving = true;
    statusMessage = "";
    try {
      await window.dossier?.settings.set({
        llmProfiles: nextProfiles,
        activeLlmProfileId: active.id,
        localModelEndpoint: legacy.localModelEndpoint,
        localModelName: legacy.localModelName,
        llmSetupComplete: true
      });

      profiles = nextProfiles;
      activeLlmProfileId = active.id;
      uiSettings.setLlmProfiles(nextProfiles, active.id);

      statusMessage =
        mode === "onboarding"
          ? "LLM profile saved. Continuing setup..."
          : "LLM settings saved.";

      if (mode === "onboarding" && onComplete) {
        await onComplete();
      }
    } catch (error) {
      statusMessage = error instanceof Error ? error.message : "Failed to save LLM settings.";
    } finally {
      isSaving = false;
    }
  }

  onMount(() => {
    void (async () => {
      const settings = ((await window.dossier?.settings.get()) ?? {}) as Record<string, unknown>;
      const normalized = normalizeLlmProfiles({
        llmProfiles: settings["llmProfiles"],
        activeLlmProfileId: settings["activeLlmProfileId"],
        localModelEndpoint: settings["localModelEndpoint"],
        localModelName: settings["localModelName"]
      });

      if (normalized.profiles.length === 0) {
        const first = createLlmProfile("ollama", "Ollama");
        profiles = [first];
        activeLlmProfileId = first.id;
        selectedProfileId = first.id;
      } else {
        profiles = normalized.profiles;
        activeLlmProfileId = normalized.activeLlmProfileId;
        selectedProfileId = normalized.activeLlmProfileId ?? normalized.profiles[0]?.id ?? null;
      }

      isLoading = false;
    })();
  });
</script>

<section class="llm-panel" aria-busy={isLoading}>
  <div class="llm-heading-row">
    <h3 class="llm-title">{mode === "onboarding" ? "Connect AI model" : "LLM Profiles"}</h3>
    <p class="llm-subtitle">
      Set up multiple model profiles and choose one active profile for chat and inference.
    </p>
  </div>

  {#if isLoading}
    <p class="status-text">Loading LLM settings...</p>
  {:else}
    <div class="layout-grid">
      <aside class="profiles-panel">
        <div class="profiles-list">
          {#each profiles as profile (profile.id)}
            <button
              class="profile-item"
              class:selected={selectedProfileId === profile.id}
              onclick={() => {
                selectedProfileId = profile.id;
              }}
            >
              <div class="profile-top-row">
                <span class="profile-name">{profile.name || "Untitled profile"}</span>
                {#if activeLlmProfileId === profile.id}
                  <span class="active-pill">Active</span>
                {/if}
              </div>
              <span class="profile-meta">{profileSummary(profile)}</span>
            </button>
          {/each}
        </div>

        <div class="quick-add">
          <button class="btn-secondary-sm" onclick={() => addProfile("ollama")}>+ Ollama</button>
          <button class="btn-secondary-sm" onclick={() => addProfile("custom")}>+ Custom</button>
        </div>

        <div class="add-remote-row">
          <select class="text-input" bind:value={addProviderId}>
            {#each orderedRemoteProviders as provider}
              <option value={provider.id}>{provider.label}</option>
            {/each}
          </select>
          <button class="btn-secondary-sm" onclick={() => addProfile(addProviderId)}>+ Provider</button>
        </div>
      </aside>

      {#if selectedProfile}
        <div class="editor-panel">
          <div class="field-grid">
            <div class="field-block">
              <label class="field-label" for="llm-profile-name">Profile name</label>
              <input
                id="llm-profile-name"
                class="text-input"
                type="text"
                value={selectedProfile.name}
                oninput={(event) => {
                  updateSelectedProfile({ name: (event.currentTarget as HTMLInputElement).value });
                }}
                placeholder="My preferred model"
              />
            </div>

            <div class="field-block">
              <label class="field-label" for="llm-provider">Provider</label>
              <select
                id="llm-provider"
                class="text-input"
                value={selectedProfile.provider}
                onchange={(event) => {
                  setProvider((event.currentTarget as HTMLSelectElement).value as LlmProviderId);
                }}
              >
                {#each LLM_PROVIDER_DEFINITIONS as provider}
                  <option value={provider.id}>{provider.label}</option>
                {/each}
              </select>
              <p class="field-help">{getProviderDefinition(selectedProfile.provider).description}</p>
            </div>

            <div class="field-block">
              <label class="field-label" for="llm-endpoint">Endpoint</label>
              <input
                id="llm-endpoint"
                class="text-input"
                type="text"
                value={selectedProfile.endpoint}
                oninput={(event) => {
                  updateSelectedProfile({ endpoint: (event.currentTarget as HTMLInputElement).value });
                }}
                placeholder="https://api.openai.com/v1"
              />
            </div>

            <div class="field-block">
              <label class="field-label" for="llm-model">Model</label>
              <input
                id="llm-model"
                class="text-input"
                type="text"
                value={selectedProfile.model}
                oninput={(event) => {
                  updateSelectedProfile({ model: (event.currentTarget as HTMLInputElement).value });
                }}
                placeholder="gpt-4o-mini"
              />

              {#if selectedProfile.provider === "ollama" && detectedOllamaModels.length > 0}
                <div class="detected-row">
                  <label class="field-label" for="llm-detected-model">Detected local models</label>
                  <select
                    id="llm-detected-model"
                    class="text-input"
                    onchange={(event) => {
                      updateSelectedProfile({ model: (event.currentTarget as HTMLSelectElement).value });
                    }}
                  >
                    {#each detectedOllamaModels as model}
                      <option value={model} selected={selectedProfile.model === model}>{model}</option>
                    {/each}
                  </select>
                </div>
              {/if}
            </div>
          </div>

          {#if selectedProfile.provider === "ollama"}
            <div class="ollama-note">
              <p>Run Ollama locally before testing:</p>
              <pre><code>ollama serve</code></pre>
              <p>
                Then pull a model (example): <code>ollama pull llama3.1</code>
              </p>
              <button class="btn-secondary-sm" onclick={() => void detectOllamaModels()} disabled={isDetecting}>
                {isDetecting ? "Detecting models..." : "Detect local models"}
              </button>
            </div>
          {/if}

          <div class="auth-panel">
            <p class="field-label">Authentication</p>
            <div class="auth-methods">
              <button
                class="method-pill"
                class:active={selectedProfile.authMethod === "apiKey"}
                onclick={() => {
                  updateSelectedProfile({ authMethod: "apiKey" });
                }}
              >
                API key (primary)
              </button>
              <button
                class="method-pill"
                class:active={selectedProfile.authMethod === "oauth"}
                onclick={() => {
                  updateSelectedProfile({ authMethod: "oauth" });
                }}
              >
                OAuth token
              </button>
            </div>

            <label class="field-label" for="llm-credential">
              {selectedProfile.authMethod === "oauth" ? "OAuth access token" : "API key"}
            </label>
            <input
              id="llm-credential"
              class="text-input"
              type="password"
              value={selectedProfile.authMethod === "oauth" ? selectedProfile.oauthToken ?? "" : selectedProfile.apiKey ?? ""}
              oninput={(event) => {
                const value = (event.currentTarget as HTMLInputElement).value;
                if (selectedProfile.authMethod === "oauth") {
                  updateSelectedProfile({ oauthToken: value });
                } else {
                  updateSelectedProfile({ apiKey: value });
                }
              }}
              placeholder={selectedProfile.authMethod === "oauth" ? "Paste OAuth access token" : "Paste provider API key"}
            />
          </div>

          <div class="actions-row">
            {#if activeLlmProfileId !== selectedProfile.id}
              <button class="btn-secondary" onclick={() => setActiveProfile(selectedProfile.id)}>
                Set active
              </button>
            {/if}
            <button class="btn-secondary" onclick={() => void testConnection()} disabled={isTesting || !profileReady(selectedProfile)}>
              {isTesting ? "Testing..." : "Test connection"}
            </button>
            <button
              class="btn-primary"
              onclick={() => void saveProfiles()}
              disabled={
                isSaving ||
                !activeProfile ||
                !profileReady(activeProfile) ||
                (mode === "onboarding" && lastSuccessfulTestProfileId !== activeProfile.id)
              }
            >
              {isSaving ? "Saving..." : mode === "onboarding" ? "Save & continue" : "Save settings"}
            </button>
            <button class="btn-danger-quiet" onclick={removeSelectedProfile} disabled={profiles.length <= 1}>
              Remove profile
            </button>
          </div>

          {#if testResult}
            <p class="test-status" class:ok={testResult.ok} class:err={!testResult.ok} aria-live="polite">
              {#if testResult.ok}
                Connected to {testResult.model}
              {:else}
                {testResult.error ?? "Connection failed"}
              {/if}
            </p>
          {/if}

          {#if statusMessage}
            <p class="status-text" aria-live="polite">{statusMessage}</p>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</section>

<style>
  .llm-panel {
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    background: var(--base-secondary);
    padding: var(--space-5);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .llm-heading-row {
    display: grid;
    gap: var(--space-1);
  }

  .llm-title {
    font-family: var(--font-display);
    font-size: 1.1rem;
    color: var(--text-primary);
  }

  .llm-subtitle {
    font-family: var(--font-body);
    font-size: 0.86rem;
    line-height: 1.45;
    color: var(--text-secondary);
  }

  .layout-grid {
    display: grid;
    grid-template-columns: 240px 1fr;
    gap: var(--space-4);
  }

  .profiles-panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .profiles-list {
    display: grid;
    gap: var(--space-2);
  }

  .profile-item {
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    background: var(--base);
    padding: var(--space-2) var(--space-3);
    text-align: left;
    display: grid;
    gap: 2px;
  }

  .profile-item.selected {
    border-color: var(--primary-accent);
    box-shadow: inset 0 0 0 1px var(--primary-accent);
  }

  .profile-top-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }

  .profile-name {
    font-family: var(--font-body);
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .profile-meta {
    font-family: var(--font-body);
    font-size: 0.75rem;
    color: var(--text-tertiary);
  }

  .active-pill {
    font-family: var(--font-body);
    font-size: 0.72rem;
    color: var(--success);
    background: var(--success-subtle);
    border-radius: var(--radius-full);
    padding: 2px var(--space-2);
  }

  .quick-add {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-2);
  }

  .add-remote-row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: var(--space-2);
  }

  .editor-panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .field-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
  }

  .field-block {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .field-label {
    font-family: var(--font-body);
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--text-secondary);
  }

  .field-help {
    font-family: var(--font-body);
    font-size: 0.74rem;
    color: var(--text-tertiary);
  }

  .text-input {
    min-height: 40px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-subtle);
    background: var(--base);
    color: var(--text-primary);
    font-family: var(--font-body);
    font-size: 0.9rem;
    padding: var(--space-2) var(--space-3);
  }

  .text-input:focus {
    outline: none;
    border-color: var(--primary-accent);
  }

  .detected-row {
    display: grid;
    gap: var(--space-1);
  }

  .ollama-note {
    border: 1px dashed var(--border);
    border-radius: var(--radius-sm);
    background: var(--base);
    padding: var(--space-3);
    display: grid;
    gap: var(--space-2);
    font-family: var(--font-body);
    font-size: 0.84rem;
    color: var(--text-secondary);
  }

  .ollama-note pre {
    font-family: var(--font-mono);
    font-size: 0.82rem;
    color: var(--text-primary);
    background: var(--base-tertiary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    padding: var(--space-2) var(--space-3);
    overflow-x: auto;
  }

  .auth-panel {
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    background: var(--base);
    padding: var(--space-3);
    display: grid;
    gap: var(--space-2);
  }

  .auth-methods {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .method-pill {
    min-height: 34px;
    padding: var(--space-1) var(--space-3);
    border-radius: var(--radius-full);
    border: 1px solid var(--border);
    font-family: var(--font-body);
    font-size: 0.8rem;
    color: var(--text-secondary);
    background: transparent;
  }

  .method-pill.active {
    border-color: var(--primary-accent);
    color: var(--text-primary);
    background: color-mix(in srgb, var(--primary-accent) 10%, transparent);
  }

  .actions-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .btn-primary,
  .btn-secondary,
  .btn-secondary-sm,
  .btn-danger-quiet {
    border-radius: var(--radius-sm);
    font-family: var(--font-body);
    transition: background-color var(--duration-standard) var(--ease-out);
  }

  .btn-primary {
    min-height: 40px;
    padding: var(--space-2) var(--space-3);
    background: var(--primary-accent);
    color: var(--primary-accent-text);
    font-size: 0.88rem;
    font-weight: 600;
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-secondary {
    min-height: 40px;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--border);
    background: transparent;
    color: var(--text-primary);
    font-size: 0.88rem;
  }

  .btn-secondary-sm {
    min-height: 34px;
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--border);
    background: transparent;
    color: var(--text-primary);
    font-size: 0.78rem;
  }

  .btn-secondary:hover,
  .btn-secondary-sm:hover {
    background: var(--base-tertiary);
  }

  .btn-secondary:disabled,
  .btn-secondary-sm:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-danger-quiet {
    min-height: 40px;
    padding: var(--space-2) var(--space-3);
    border: 1px solid color-mix(in srgb, var(--error) 35%, var(--border));
    color: var(--error);
    background: transparent;
    font-size: 0.84rem;
  }

  .btn-danger-quiet:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .test-status {
    font-family: var(--font-body);
    font-size: 0.84rem;
  }

  .test-status.ok {
    color: var(--success);
  }

  .test-status.err {
    color: var(--error);
  }

  .status-text {
    font-family: var(--font-body);
    font-size: 0.82rem;
    color: var(--text-secondary);
  }

  @media (max-width: 860px) {
    .layout-grid {
      grid-template-columns: 1fr;
    }

    .field-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
