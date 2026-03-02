import { applyTheme, type ThemeName } from "$lib/design/themes";
import type { LlmProfile } from "$lib/types";
import {
  getActiveLlmProfile,
  normalizeLlmProfiles,
  toLegacyLocalModelSettings
} from "$lib/llm/providers";

class UiSettingsStore {
  theme = $state<ThemeName>("Parchment");
  dyslexiaMode = $state(false);
  highFidelityEnabled = $state(false);
  startOnLogin = $state(false);
  autoUpdatesEnabled = $state(true);
  skippedUpdateVersion = $state<string | null>(null);
  localModelEndpoint = $state("");
  localModelName = $state("");
  llmProfiles = $state<LlmProfile[]>([]);
  activeLlmProfileId = $state<string | null>(null);
  sidebarCollapsed = $state(false);
  showingWelcome = $state(false);

  getActiveLlmProfile(): LlmProfile | null {
    return getActiveLlmProfile(this.llmProfiles, this.activeLlmProfileId);
  }

  setLlmProfiles(profiles: LlmProfile[], activeLlmProfileId: string | null): void {
    this.llmProfiles = profiles;
    this.activeLlmProfileId = activeLlmProfileId;
    const legacy = toLegacyLocalModelSettings(profiles, activeLlmProfileId);
    this.localModelEndpoint = legacy.localModelEndpoint;
    this.localModelName = legacy.localModelName;
  }

  applyTheme(): void {
    applyTheme(this.theme);
  }

  applyBodyMode(): void {
    document.body.dataset.dyslexia = this.dyslexiaMode ? "true" : "false";
  }

  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  async hydrateFromDesktop(): Promise<void> {
    const desktopSettings = await window.dossier?.settings.get();
    if (!desktopSettings) {
      this.applyTheme();
      this.applyBodyMode();
      return;
    }

    this.theme = (desktopSettings.theme as ThemeName) ?? this.theme;
    this.dyslexiaMode = Boolean(desktopSettings.dyslexiaMode);
    this.highFidelityEnabled = Boolean(desktopSettings.highFidelityEnabled);
    this.startOnLogin = Boolean(desktopSettings.startOnLogin);
    this.autoUpdatesEnabled =
      desktopSettings.autoUpdatesEnabled === undefined
        ? true
        : Boolean(desktopSettings.autoUpdatesEnabled);
    this.skippedUpdateVersion =
      desktopSettings.skippedUpdateVersion === undefined
        ? null
        : (desktopSettings.skippedUpdateVersion as string | null);
    const normalizedLlmSettings = normalizeLlmProfiles({
      llmProfiles: desktopSettings.llmProfiles,
      activeLlmProfileId: desktopSettings.activeLlmProfileId,
      localModelEndpoint: desktopSettings.localModelEndpoint,
      localModelName: desktopSettings.localModelName
    });
    this.setLlmProfiles(
      normalizedLlmSettings.profiles,
      normalizedLlmSettings.activeLlmProfileId
    );

    const osStartOnLogin = await window.dossier?.settings.getStartOnLogin();
    if (typeof osStartOnLogin === "boolean") {
      this.startOnLogin = osStartOnLogin;
    }

    this.applyTheme();
    this.applyBodyMode();
  }

  async persist(): Promise<void> {
    const legacy = toLegacyLocalModelSettings(this.llmProfiles, this.activeLlmProfileId);
    await window.dossier?.settings.set({
      theme: this.theme,
      dyslexiaMode: this.dyslexiaMode,
      highFidelityEnabled: this.highFidelityEnabled,
      startOnLogin: this.startOnLogin,
      autoUpdatesEnabled: this.autoUpdatesEnabled,
      skippedUpdateVersion: this.skippedUpdateVersion,
      localModelEndpoint: legacy.localModelEndpoint,
      localModelName: legacy.localModelName,
      llmProfiles: this.llmProfiles,
      activeLlmProfileId: this.activeLlmProfileId
    });
  }
}

export const uiSettings = new UiSettingsStore();
