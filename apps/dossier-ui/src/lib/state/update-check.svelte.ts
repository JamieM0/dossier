import { uiSettings } from "./ui-settings.svelte";

class UpdateCheckStore {
  available = $state<{ currentVersion: string; nextVersion: string } | null>(null);
  status = $state("");
  busy = $state(false);

  async check(): Promise<void> {
    this.busy = true;
    this.status = "";
    try {
      const update = await window.dossier?.updater.checkForUpdate();
      if (!update) {
        this.status = "You're on the latest version.";
        return;
      }
      if (uiSettings.skippedUpdateVersion === update.version) {
        this.status = `You skipped v${update.version} previously — no new update since then.`;
        return;
      }
      this.available = { currentVersion: update.currentVersion, nextVersion: update.version };
    } catch (error) {
      this.status = error instanceof Error ? error.message : String(error);
    } finally {
      this.busy = false;
    }
  }

  dismiss(): void {
    this.available = null;
  }
}

export const updateCheck = new UpdateCheckStore();
