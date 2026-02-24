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
    onComplete,
    onCancel,
    initialProfiles,
    initialActiveLlmProfileId = null,
    primaryActionLabel,
    showSkipAction = true,
    showTestAction = true,
    requireSuccessfulTest,
    persistOnSave = true
  } = $props<{
    mode?: LlmMode;
    onComplete?: (result?: { profiles: LlmProfile[]; activeLlmProfileId: string }) => void | Promise<void>;
    onCancel?: () => void;
    initialProfiles?: LlmProfile[];
    initialActiveLlmProfileId?: string | null;
    primaryActionLabel?: string;
    showSkipAction?: boolean;
    showTestAction?: boolean;
    requireSuccessfulTest?: boolean;
    persistOnSave?: boolean;
  }>();

  let isLoading = $state(true);
  let isSaving = $state(false);
  let isSkipping = $state(false);
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
  let showLocalAdvanced = $state(false);

  let testResult = $state<{ ok: boolean; model: string; error?: string } | null>(null);

  const selectedProfile = $derived(
    profiles.find((profile) => profile.id === selectedProfileId) ?? null
  );
  const activeProfile = $derived(getActiveLlmProfile(profiles, activeLlmProfileId));

  const orderedRemoteProviders = LLM_PROVIDER_DEFINITIONS.filter(
    (provider) => provider.id !== "ollama" && provider.id !== "custom"
  );
  const remoteProviderOptions = $derived([
    getProviderDefinition("custom"),
    ...orderedRemoteProviders
  ]);
  const isOnboarding = $derived(mode === "onboarding");
  const shouldRequireSuccessfulTest = $derived(
    requireSuccessfulTest ?? mode === "onboarding"
  );
  const needsSuccessfulTest = $derived(
    shouldRequireSuccessfulTest &&
      Boolean(activeProfile) &&
      lastSuccessfulTestProfileId !== activeProfile?.id
  );
  const saveDisabled = $derived(
    isSaving || !activeProfile || !profileReady(activeProfile) || needsSuccessfulTest
  );

  $effect(() => {
    selectedProfileId;
    testResult = null;
    detectedOllamaModels = [];
    lastSuccessfulTestProfileId = null;
    showLocalAdvanced = false;
  });

  $effect(() => {
    const profile = selectedProfile;
    if (!profile || profile.provider !== "ollama" || mode === "onboarding") {
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
    void detectOllamaModels(false);
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

  function modelPlaceholder(profile: LlmProfile): string {
    if (profile.provider === "ollama") {
      return "llama3.1";
    }
    const provider = getProviderDefinition(profile.provider);
    if (provider.defaultModel.trim()) {
      return provider.defaultModel;
    }
    return "Enter model name";
  }

  function endpointReady(profile: LlmProfile): boolean {
    return profile.endpoint.trim().length > 0;
  }

  function modelReady(profile: LlmProfile): boolean {
    return profile.model.trim().length > 0;
  }

  function authReady(profile: LlmProfile): boolean {
    if (!credentialRequired(profile)) {
      return true;
    }
    return profile.authMethod === "oauth"
      ? Boolean(profile.oauthToken?.trim())
      : Boolean(profile.apiKey?.trim());
  }

  function nextStepHint(profile: LlmProfile | null): string {
    if (!profile) {
      return "Select a profile to continue.";
    }
    if (!endpointReady(profile)) {
      return "Add the endpoint URL first.";
    }
    if (!modelReady(profile)) {
      return "Set a model name before testing.";
    }
    if (!authReady(profile)) {
      return "Add authentication credentials for this provider.";
    }
    if (shouldRequireSuccessfulTest && lastSuccessfulTestProfileId !== profile.id) {
      return "Run Test connection to unlock Save & continue.";
    }
    return "Ready to save.";
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

  function setOnboardingSource(source: "local" | "remote"): void {
    if (source === "local") {
      setProvider("ollama");
      return;
    }
    if (selectedProfile?.provider !== "ollama") {
      return;
    }
    setProvider("openai");
  }

  function setOnboardingRemoteProvider(providerId: LlmProviderId): void {
    if (providerId === "ollama") {
      return;
    }
    setProvider(providerId);
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

  async function detectOllamaModels(manual: boolean): Promise<void> {
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
        : manual
          ? "No Ollama models detected yet. Run `ollama pull <model>` first."
          : "";
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
    if (shouldRequireSuccessfulTest && lastSuccessfulTestProfileId !== active.id) {
      statusMessage = "Please run a successful connection test before continuing.";
      return;
    }

    const legacy = toLegacyLocalModelSettings(nextProfiles, active.id);

    isSaving = true;
    statusMessage = "";
    try {
      if (persistOnSave) {
        await window.dossier?.settings.set({
          llmProfiles: nextProfiles,
          activeLlmProfileId: active.id,
          localModelEndpoint: legacy.localModelEndpoint,
          localModelName: legacy.localModelName,
          llmSetupComplete: true
        });
      }

      profiles = nextProfiles;
      activeLlmProfileId = active.id;
      if (persistOnSave) {
        uiSettings.setLlmProfiles(nextProfiles, active.id);
      }

      statusMessage =
        mode === "onboarding"
          ? "LLM profile saved. Continuing setup..."
          : "LLM settings saved.";

      if (onComplete) {
        await onComplete({
          profiles: nextProfiles,
          activeLlmProfileId: active.id
        });
      }
    } catch (error) {
      statusMessage = error instanceof Error ? error.message : "Failed to save LLM settings.";
    } finally {
      isSaving = false;
    }
  }

  async function skipOnboardingSetup(): Promise<void> {
    if (!isOnboarding) {
      return;
    }
    isSkipping = true;
    statusMessage = "";
    try {
      await window.dossier?.settings.set({
        llmSetupComplete: true
      });
      statusMessage = "Skipped for now. You can connect a model anytime in Settings.";
      if (onComplete) {
        await onComplete();
      }
    } catch (error) {
      statusMessage = error instanceof Error ? error.message : "Failed to skip LLM setup.";
    } finally {
      isSkipping = false;
    }
  }

  onMount(() => {
    void (async () => {
      if (initialProfiles && initialProfiles.length > 0) {
        profiles = initialProfiles;
        activeLlmProfileId =
          initialProfiles.find((profile) => profile.id === initialActiveLlmProfileId)?.id ??
          initialProfiles[0]?.id ??
          null;
        selectedProfileId = activeLlmProfileId ?? initialProfiles[0]?.id ?? null;
        isLoading = false;
        return;
      }

      const settings = ((await window.dossier?.settings.get()) ?? {}) as Record<string, unknown>;
      const normalized = normalizeLlmProfiles({
        llmProfiles: settings["llmProfiles"],
        activeLlmProfileId: settings["activeLlmProfileId"],
        localModelEndpoint: settings["localModelEndpoint"],
        localModelName: settings["localModelName"]
      });

      if (normalized.profiles.length === 0) {
        const first = createLlmProfile("ollama", "default");
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
      {#if isOnboarding}
        {#if showSkipAction}
          Connect a model now or skip and finish setup. You can add profiles later in Settings.
        {:else}
          Configure this profile and continue.
        {/if}
      {:else}
        Set up multiple model profiles and choose one active profile for chat and inference.
      {/if}
    </p>
  </div>

  {#if isLoading}
    <p class="status-text">Loading LLM settings...</p>
  {:else}
    <div class="layout-grid" class:onboarding-layout={isOnboarding}>
      {#if !isOnboarding}
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
      {/if}

      {#if selectedProfile}
        <div class="editor-panel">
          {#if isOnboarding}
            <div class="source-path">
              <button
                class="path-option"
                class:active={selectedProfile.provider === "ollama"}
                onclick={() => setOnboardingSource("local")}
              >
                <span class="path-title">Local</span>
                <span class="path-copy">Ollama on this machine</span>
              </button>
              <button
                class="path-option"
                class:active={selectedProfile.provider !== "ollama"}
                onclick={() => setOnboardingSource("remote")}
              >
                <span class="path-title">Remote</span>
                <span class="path-copy">Hosted model provider</span>
              </button>
            </div>

            {#if selectedProfile.provider !== "ollama"}
              <div class="onboarding-block">
                <p class="field-label">Choose remote provider</p>
                <div class="provider-picker">
                  {#each remoteProviderOptions as provider}
                    <button
                      class="provider-choice"
                      class:active={selectedProfile.provider === provider.id}
                      onclick={() => setOnboardingRemoteProvider(provider.id)}
                    >
                      <span class="provider-title">{provider.label}</span>
                      <span class="provider-help">{provider.description}</span>
                    </button>
                  {/each}
                </div>
              </div>
            {/if}

            <div class="field-grid onboarding-fields">
              {#if selectedProfile.provider === "custom" || (selectedProfile.provider === "ollama" && showLocalAdvanced)}
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
                    placeholder={selectedProfile.provider === "custom" ? "https://my-gateway.example.com/v1" : "http://127.0.0.1:11434/v1"}
                  />
                </div>
              {/if}

              <div class="field-block">
                <label class="field-label" for="llm-model">
                  {selectedProfile.provider === "ollama" ? "Local model" : "Model"}
                </label>
                <input
                  id="llm-model"
                  class="text-input"
                  type="text"
                  value={selectedProfile.model}
                  oninput={(event) => {
                    updateSelectedProfile({ model: (event.currentTarget as HTMLInputElement).value });
                  }}
                  placeholder={modelPlaceholder(selectedProfile)}
                />
              </div>
            </div>

            {#if selectedProfile.provider === "ollama"}
              <div class="onboarding-inline-note">
                <span class="note-text">
                  {#if showLocalAdvanced}
                    Using custom local endpoint.
                  {:else}
                    Using default local endpoint: http://127.0.0.1:11434/v1
                  {/if}
                </span>
                <button
                  class="btn-secondary-sm"
                  onclick={() => {
                    if (showLocalAdvanced) {
                      updateSelectedProfile({ endpoint: getProviderDefinition("ollama").defaultEndpoint });
                      showLocalAdvanced = false;
                    } else {
                      showLocalAdvanced = true;
                    }
                  }}
                >
                  {showLocalAdvanced ? "Reset endpoint" : "Advanced endpoint"}
                </button>
              </div>
            {/if}

            {#if selectedProfile.provider === "ollama"}
              <div class="ollama-note">
                <p>Run Ollama locally before testing:</p>
                <pre><code>ollama serve</code></pre>
                <p>
                  Then pull a model (example): <code>ollama pull llama3.1</code>
                </p>

                {#if detectedOllamaModels.length > 0}
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

                <button class="btn-secondary-sm" onclick={() => void detectOllamaModels(true)} disabled={isDetecting}>
                  {isDetecting ? "Detecting models..." : "Detect local models"}
                </button>
              </div>
            {/if}

            {#if credentialRequired(selectedProfile)}
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
                    API key
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
            {/if}
          {:else}
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
                  placeholder={modelPlaceholder(selectedProfile)}
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
                <button class="btn-secondary-sm" onclick={() => void detectOllamaModels(true)} disabled={isDetecting}>
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
          {/if}

          {#if isOnboarding}
            <div class="setup-guide" aria-live="polite">
              <span class="guide-title">Setup checklist</span>
              <ul class="guide-list">
                <li class:done={endpointReady(selectedProfile)}>Endpoint added</li>
                <li class:done={modelReady(selectedProfile)}>Model selected</li>
                <li class:done={authReady(selectedProfile)}>Authentication complete</li>
                <li class:done={!needsSuccessfulTest}>Connection tested</li>
              </ul>
              <p class="guide-hint">{nextStepHint(selectedProfile)}</p>
            </div>
          {/if}

          <div class="actions-row" class:onboarding-actions={isOnboarding}>
            {#if onCancel}
              <button class="btn-secondary" onclick={onCancel}>
                Cancel
              </button>
            {/if}
            {#if activeLlmProfileId !== selectedProfile.id}
              <button class="btn-secondary" onclick={() => setActiveProfile(selectedProfile.id)}>
                Set active
              </button>
            {/if}
            {#if isOnboarding && showSkipAction}
              <button class="btn-secondary" onclick={() => void skipOnboardingSetup()} disabled={isSkipping || isSaving}>
                {isSkipping ? "Skipping..." : "Skip model setup"}
              </button>
            {/if}
            {#if showTestAction}
              <button class="btn-secondary" onclick={() => void testConnection()} disabled={isTesting}>
                {isTesting ? "Testing..." : "Test connection"}
              </button>
            {/if}
            <button
              class="btn-primary"
              onclick={() => void saveProfiles()}
              disabled={saveDisabled}
            >
              {isSaving
                ? "Saving..."
                : primaryActionLabel ?? (mode === "onboarding" ? "Save & continue" : "Save settings")}
            </button>
            {#if !isOnboarding}
              <button class="btn-danger-quiet" onclick={removeSelectedProfile} disabled={profiles.length <= 1}>
                Remove profile
              </button>
            {/if}
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
    grid-template-columns: minmax(220px, 240px) minmax(0, 1fr);
    gap: var(--space-4);
  }

  .layout-grid.onboarding-layout {
    grid-template-columns: minmax(0, 1fr);
    max-width: 940px;
    margin: 0 auto;
  }

  .layout-grid > * {
    min-width: 0;
  }

  .source-path {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
  }

  .path-option {
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--base);
    min-height: 84px;
    padding: var(--space-3) var(--space-4);
    display: grid;
    gap: 2px;
    text-align: left;
  }

  .path-option.active {
    border-color: var(--primary-accent);
    box-shadow: inset 0 0 0 1px var(--primary-accent);
    background: color-mix(in srgb, var(--primary-accent) 6%, var(--base));
  }

  .path-title {
    font-family: var(--font-display);
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .path-copy {
    font-family: var(--font-body);
    font-size: 0.84rem;
    color: var(--text-secondary);
  }

  .onboarding-block {
    display: grid;
    gap: var(--space-2);
  }

  .provider-picker {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-2);
  }

  .provider-choice {
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--base);
    min-height: 72px;
    padding: var(--space-2) var(--space-3);
    display: grid;
    gap: 2px;
    text-align: left;
  }

  .provider-choice.active {
    border-color: var(--primary-accent);
    box-shadow: inset 0 0 0 1px var(--primary-accent);
    background: color-mix(in srgb, var(--primary-accent) 6%, var(--base));
  }

  .provider-title {
    font-family: var(--font-body);
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .provider-help {
    font-family: var(--font-body);
    font-size: 0.75rem;
    color: var(--text-secondary);
    line-height: 1.3;
  }

  .onboarding-fields {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .onboarding-inline-note {
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    background: var(--base);
    padding: var(--space-2) var(--space-3);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    flex-wrap: wrap;
  }

  .note-text {
    font-family: var(--font-body);
    font-size: 0.8rem;
    color: var(--text-secondary);
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
    min-width: 0;
  }

  .field-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: var(--space-3);
  }

  .field-block {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-width: 0;
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
    width: 100%;
    min-width: 0;
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

  .setup-guide {
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    background: color-mix(in srgb, var(--success-subtle) 35%, var(--base));
    padding: var(--space-3);
    display: grid;
    gap: var(--space-2);
  }

  .guide-title {
    font-family: var(--font-body);
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .guide-list {
    margin: 0;
    padding-left: 1rem;
    display: grid;
    gap: 2px;
    font-family: var(--font-body);
    font-size: 0.8rem;
    color: var(--text-secondary);
  }

  .guide-list li.done {
    color: var(--success);
  }

  .guide-hint {
    font-family: var(--font-body);
    font-size: 0.8rem;
    color: var(--text-secondary);
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

  .actions-row.onboarding-actions .btn-secondary,
  .actions-row.onboarding-actions .btn-primary {
    min-width: 180px;
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

    .source-path {
      grid-template-columns: 1fr;
    }

    .provider-picker {
      grid-template-columns: 1fr;
    }

    .field-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
