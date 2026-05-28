/** Tracks whether the user has configured a working TMDB token. The app
 * is gated on this: without a token there is no catalogue to show. */
class TmdbState {
  /** null = not yet checked; true/false once known. */
  configured = $state<boolean | null>(null);
  busy = $state(false);
  error = $state<string | null>(null);

  async refresh(): Promise<void> {
    if (!window.dossier?.tmdb) {
      // Browser/dev without the desktop shell — treat as unconfigured.
      this.configured = false;
      return;
    }
    try {
      const { configured } = await window.dossier.tmdb.status();
      this.configured = configured;
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
      this.configured = false;
    }
  }

  /** Validate + persist a token. Returns true on success; sets `error`
   *  and returns false if TMDB rejects it. */
  async setToken(token: string): Promise<boolean> {
    if (!window.dossier?.tmdb) {
      this.error = "Desktop bridge unavailable.";
      return false;
    }
    this.busy = true;
    this.error = null;
    try {
      console.log("[ui] calling tmdb.setToken IPC...");
      const { configured } = await window.dossier.tmdb.setToken(token.trim());
      console.log(`[ui] IPC response: configured=${configured}`);
      this.configured = configured;
      return configured;
    } catch (err) {
      // Backend surfaces a 400 with the TMDB rejection message.
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[ui] IPC error:", err);
      this.error = /401|reject|token/i.test(msg)
        ? "TMDB rejected that token. Double-check you pasted a valid API Key (v3) or Read Access Token (v4)."
        : msg;
      return false;
    } finally {
      this.busy = false;
    }
  }

  async clearToken(): Promise<void> {
    if (!window.dossier?.tmdb) return;
    await window.dossier.tmdb.clearToken();
    this.configured = false;
  }
}

export const tmdbState = new TmdbState();
