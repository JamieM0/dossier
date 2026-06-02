/** Tiny browser-native file save/open helpers for library export/import.
 * Works in both the web build and the Tauri webview without extra plugins:
 * a Blob download to save, an <input type="file"> to open. */

/** Trigger a download of `content` as a UTF-8 file named `filename`. */
export function downloadTextFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick so the click has a chance to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Prompt the user to pick a file and return its text, or null if cancelled. */
export function pickTextFile(accept = ".dossier,application/json"): Promise<{
  name: string;
  content: string;
} | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.style.display = "none";
    let settled = false;

    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      input.remove();
      if (!file) {
        if (!settled) resolve(null);
        return;
      }
      settled = true;
      resolve({ name: file.name, content: await file.text() });
    });

    // If the picker is dismissed without a selection, resolve null on focus.
    input.addEventListener(
      "cancel",
      () => {
        input.remove();
        if (!settled) resolve(null);
      },
      { once: true }
    );

    document.body.appendChild(input);
    input.click();
  });
}

/** A timestamped default filename for a library export. */
export function defaultExportFilename(): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return `dossier-library-${stamp}.dossier`;
}
