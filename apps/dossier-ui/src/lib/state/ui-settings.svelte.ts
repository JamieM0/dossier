import { applyTheme, type ThemeName } from "$lib/design/themes";

class UiSettingsStore {
  theme = $state<ThemeName>("Parchment");
  dyslexiaMode = $state(false);
  highFidelityEnabled = $state(false);
  startOnLogin = $state(false);
  sidebarCollapsed = $state(false);

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

    this.applyTheme();
    this.applyBodyMode();
  }

  async persist(): Promise<void> {
    await window.dossier?.settings.set({
      theme: this.theme,
      dyslexiaMode: this.dyslexiaMode,
      highFidelityEnabled: this.highFidelityEnabled,
      startOnLogin: this.startOnLogin
    });
  }
}

export const uiSettings = new UiSettingsStore();
