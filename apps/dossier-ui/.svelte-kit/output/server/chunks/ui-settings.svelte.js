const THEMES = [
  {
    name: "Parchment",
    mode: "light",
    base: "#FAF7F2",
    "base-secondary": "#F3EDE4",
    "base-tertiary": "#EBE4D8",
    "primary-accent": "#4A5568",
    "primary-accent-hover": "#3D4756",
    "primary-accent-text": "#FFFFFF",
    "secondary-accent": "#C75C3A",
    "secondary-accent-hover": "#B34F30",
    "secondary-accent-text": "#FFFFFF",
    "text-primary": "#1C1917",
    "text-secondary": "#57534E",
    "text-tertiary": "#A8A29E",
    border: "#D6D0C4",
    "border-subtle": "#E8E2D6"
  },
  {
    name: "Overcast",
    mode: "light",
    base: "#ECEDEE",
    "base-secondary": "#E3E4E6",
    "base-tertiary": "#D9DBDD",
    "primary-accent": "#374151",
    "primary-accent-hover": "#2D3748",
    "primary-accent-text": "#FFFFFF",
    "secondary-accent": "#6B8E7B",
    "secondary-accent-hover": "#5A7D6A",
    "secondary-accent-text": "#FFFFFF",
    "text-primary": "#1A1D21",
    "text-secondary": "#4A5056",
    "text-tertiary": "#8B9198",
    border: "#C8CACD",
    "border-subtle": "#DCDEE0"
  },
  {
    name: "Flora",
    mode: "light",
    base: "#F0F4ED",
    "base-secondary": "#E6EBE2",
    "base-tertiary": "#DAE0D5",
    "primary-accent": "#3D5244",
    "primary-accent-hover": "#304336",
    "primary-accent-text": "#FFFFFF",
    "secondary-accent": "#A67B5B",
    "secondary-accent-hover": "#956A4A",
    "secondary-accent-text": "#FFFFFF",
    "text-primary": "#1A2118",
    "text-secondary": "#4E5A4A",
    "text-tertiary": "#8B9586",
    border: "#C5CCBF",
    "border-subtle": "#D8DED3"
  },
  {
    name: "High Contrast Light",
    mode: "light",
    base: "#FFFFFF",
    "base-secondary": "#F2F2F2",
    "base-tertiary": "#E5E5E5",
    "primary-accent": "#1A1A1A",
    "primary-accent-hover": "#000000",
    "primary-accent-text": "#FFFFFF",
    "secondary-accent": "#D94F2B",
    "secondary-accent-hover": "#C4411F",
    "secondary-accent-text": "#FFFFFF",
    "text-primary": "#000000",
    "text-secondary": "#333333",
    "text-tertiary": "#666666",
    border: "#999999",
    "border-subtle": "#CCCCCC"
  },
  {
    name: "Ink",
    mode: "dark",
    base: "#1C1A17",
    "base-secondary": "#252320",
    "base-tertiary": "#302D29",
    "primary-accent": "#B8AFA3",
    "primary-accent-hover": "#CCC4B8",
    "primary-accent-text": "#1C1A17",
    "secondary-accent": "#D4764E",
    "secondary-accent-hover": "#E08A64",
    "secondary-accent-text": "#1C1A17",
    "text-primary": "#E8E2D9",
    "text-secondary": "#A89F94",
    "text-tertiary": "#6E675E",
    border: "#3D3A35",
    "border-subtle": "#302D29"
  },
  {
    name: "Midnight",
    mode: "dark",
    base: "#0F1219",
    "base-secondary": "#181C24",
    "base-tertiary": "#222730",
    "primary-accent": "#7B9DB8",
    "primary-accent-hover": "#92B0C8",
    "primary-accent-text": "#0F1219",
    "secondary-accent": "#5B9BD5",
    "secondary-accent-hover": "#74ADE0",
    "secondary-accent-text": "#0F1219",
    "text-primary": "#D4DAE2",
    "text-secondary": "#8B95A3",
    "text-tertiary": "#515B6A",
    border: "#2E3440",
    "border-subtle": "#222730"
  },
  {
    name: "Moss",
    mode: "dark",
    base: "#141C14",
    "base-secondary": "#1D261D",
    "base-tertiary": "#273127",
    "primary-accent": "#9AAF8F",
    "primary-accent-hover": "#ADC0A3",
    "primary-accent-text": "#141C14",
    "secondary-accent": "#D4A84B",
    "secondary-accent-hover": "#E0B960",
    "secondary-accent-text": "#141C14",
    "text-primary": "#DAE2D6",
    "text-secondary": "#8F9E88",
    "text-tertiary": "#566151",
    border: "#2E3B2E",
    "border-subtle": "#273127"
  },
  {
    name: "Ember",
    mode: "dark",
    base: "#1A1410",
    "base-secondary": "#241D18",
    "base-tertiary": "#2F2720",
    "primary-accent": "#C49A6C",
    "primary-accent-hover": "#D4AD82",
    "primary-accent-text": "#1A1410",
    "secondary-accent": "#C06040",
    "secondary-accent-hover": "#D47358",
    "secondary-accent-text": "#1A1410",
    "text-primary": "#E4DAD0",
    "text-secondary": "#A89888",
    "text-tertiary": "#6E6050",
    border: "#3A3028",
    "border-subtle": "#2F2720"
  },
  {
    name: "High Contrast Dark",
    mode: "dark",
    base: "#000000",
    "base-secondary": "#111111",
    "base-tertiary": "#222222",
    "primary-accent": "#FFFFFF",
    "primary-accent-hover": "#E0E0E0",
    "primary-accent-text": "#000000",
    "secondary-accent": "#FF6B4A",
    "secondary-accent-hover": "#FF8266",
    "secondary-accent-text": "#000000",
    "text-primary": "#FFFFFF",
    "text-secondary": "#CCCCCC",
    "text-tertiary": "#888888",
    border: "#666666",
    "border-subtle": "#333333"
  }
];
const MODE_SEMANTICS = {
  light: {
    success: "#2D8659",
    "success-subtle": "#E8F5EE",
    error: "#C53030",
    "error-subtle": "#FDE8E8",
    warning: "#B7791F",
    "warning-subtle": "#FEF3CD",
    info: "#2B6CB0",
    "info-subtle": "#E2EDF8",
    "inference-opacity": "0.85",
    "confirmed-flash": "#E8F5EE"
  },
  dark: {
    success: "#48BB78",
    "success-subtle": "#1A2E22",
    error: "#FC8181",
    "error-subtle": "#2D1515",
    warning: "#ECC94B",
    "warning-subtle": "#2D2510",
    info: "#63B3ED",
    "info-subtle": "#0F1E2D",
    "inference-opacity": "0.80",
    "confirmed-flash": "#1A2E22"
  }
};
function getThemeByName(name) {
  return THEMES.find((theme) => theme.name === name) ?? THEMES[0];
}
function applyTheme(themeName) {
  const theme = getThemeByName(themeName);
  const semantics = MODE_SEMANTICS[theme.mode];
  const root = document.documentElement;
  for (const [key, value] of Object.entries(theme)) {
    if (key === "name" || key === "mode") {
      continue;
    }
    root.style.setProperty(`--${key}`, value);
  }
  for (const [key, value] of Object.entries(semantics)) {
    root.style.setProperty(`--${key}`, value);
  }
  root.dataset.theme = theme.name;
  root.dataset.mode = theme.mode;
}
class UiSettingsStore {
  theme = "Parchment";
  dyslexiaMode = false;
  highFidelityEnabled = false;
  startOnLogin = false;
  sidebarCollapsed = false;
  applyTheme() {
    applyTheme(this.theme);
  }
  applyBodyMode() {
    document.body.dataset.dyslexia = this.dyslexiaMode ? "true" : "false";
  }
  toggleSidebar() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }
  async hydrateFromDesktop() {
    const desktopSettings = await window.dossier?.settings.get();
    if (!desktopSettings) {
      this.applyTheme();
      this.applyBodyMode();
      return;
    }
    this.theme = desktopSettings.theme ?? this.theme;
    this.dyslexiaMode = Boolean(desktopSettings.dyslexiaMode);
    this.highFidelityEnabled = Boolean(desktopSettings.highFidelityEnabled);
    this.startOnLogin = Boolean(desktopSettings.startOnLogin);
    this.applyTheme();
    this.applyBodyMode();
  }
  async persist() {
    await window.dossier?.settings.set({
      theme: this.theme,
      dyslexiaMode: this.dyslexiaMode,
      highFidelityEnabled: this.highFidelityEnabled,
      startOnLogin: this.startOnLogin
    });
  }
}
const uiSettings = new UiSettingsStore();
export {
  THEMES as T,
  uiSettings as u
};
