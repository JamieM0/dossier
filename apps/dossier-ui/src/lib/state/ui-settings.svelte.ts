import { applyTheme, type ThemeName } from "$lib/design/themes";

class UiSettingsStore {
  theme = $state<ThemeName>("Parchment");
  dyslexiaMode = $state(false);
  highFidelityEnabled = $state(false);
  startOnLogin = $state(false);
  localModelEndpoint = $state("");
  localModelName = $state("");
  sidebarCollapsed = $state(false);
  showingWelcome = $state(false);

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
    this.localModelEndpoint =
      typeof desktopSettings.localModelEndpoint === "string" ? desktopSettings.localModelEndpoint : "";
    this.localModelName =
      typeof desktopSettings.localModelName === "string" ? desktopSettings.localModelName : "";

    const osStartOnLogin = await window.dossier?.settings.getStartOnLogin();
    if (typeof osStartOnLogin === "boolean") {
      this.startOnLogin = osStartOnLogin;
    }

    this.applyTheme();
    this.applyBodyMode();
  }

  async persist(): Promise<void> {
    await window.dossier?.settings.set({
      theme: this.theme,
      dyslexiaMode: this.dyslexiaMode,
      highFidelityEnabled: this.highFidelityEnabled,
      startOnLogin: this.startOnLogin,
      localModelEndpoint: this.localModelEndpoint,
      localModelName: this.localModelName
    });
  }
}

export const uiSettings = new UiSettingsStore();
