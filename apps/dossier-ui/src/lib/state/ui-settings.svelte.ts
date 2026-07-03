import { applyTheme, type ThemeName } from "$lib/design/themes";

class UiSettingsStore {
  theme = $state<ThemeName>("Parchment");
  dyslexiaMode = $state(false);
  startOnLogin = $state(false);
  autoUpdatesEnabled = $state(true);
  skippedUpdateVersion = $state<string | null>(null);
  sidebarCollapsed = $state(false);
  showingWelcome = $state(false);
  groupedRecommendations = $state(false);

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
    this.startOnLogin = Boolean(desktopSettings.startOnLogin);
    this.autoUpdatesEnabled =
      desktopSettings.autoUpdatesEnabled === undefined
        ? true
        : Boolean(desktopSettings.autoUpdatesEnabled);
    this.skippedUpdateVersion =
      desktopSettings.skippedUpdateVersion === undefined
        ? null
        : (desktopSettings.skippedUpdateVersion as string | null);
    this.sidebarCollapsed = Boolean(desktopSettings.sidebarCollapsed);
    this.showingWelcome =
      desktopSettings.showingWelcome === undefined
        ? false
        : Boolean(desktopSettings.showingWelcome);
    this.groupedRecommendations = Boolean(desktopSettings.groupedRecommendations);

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
      startOnLogin: this.startOnLogin,
      autoUpdatesEnabled: this.autoUpdatesEnabled,
      skippedUpdateVersion: this.skippedUpdateVersion,
      sidebarCollapsed: this.sidebarCollapsed,
      showingWelcome: this.showingWelcome,
      groupedRecommendations: this.groupedRecommendations
    });
  }
}

export const uiSettings = new UiSettingsStore();
