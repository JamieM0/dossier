import { contextBridge, ipcRenderer } from "electron";

const api = {
  app: {
    getVersion: (): Promise<string> => ipcRenderer.invoke("app:get-version")
  },
  window: {
    show: (): Promise<void> => ipcRenderer.invoke("window:show"),
    hide: (): Promise<void> => ipcRenderer.invoke("window:hide"),
    quit: (): Promise<void> => ipcRenderer.invoke("window:quit")
  },
  settings: {
    get: (): Promise<Record<string, unknown>> => ipcRenderer.invoke("settings:get"),
    set: (next: Record<string, unknown>): Promise<Record<string, unknown>> => ipcRenderer.invoke("settings:set", next)
  },
  profile: {
    listItems: (): Promise<unknown[]> => ipcRenderer.invoke("profile:list-items"),
    createManualItem: (payload: { text: string; itemType: string; categoryId: string | null }): Promise<unknown> =>
      ipcRenderer.invoke("profile:create-manual-item", payload)
  },
  data: {
    exportEncrypted: (passphrase: string): Promise<unknown> => ipcRenderer.invoke("data:export-encrypted", passphrase),
    importEncrypted: (artifact: unknown, passphrase: string): Promise<void> =>
      ipcRenderer.invoke("data:import-encrypted", artifact, passphrase),
    runTakeoutImport: (path: string): Promise<unknown> => ipcRenderer.invoke("data:run-takeout-import", path)
  },
  server: {
    health: (): Promise<unknown> => ipcRenderer.invoke("server:health")
  },
  consent: {
    onRequest: (callback: (request: unknown) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: unknown): void => callback(payload);
      ipcRenderer.on("consent:request", listener);
      return () => ipcRenderer.removeListener("consent:request", listener);
    }
  }
};

contextBridge.exposeInMainWorld("dossier", api);

declare global {
  interface Window {
    dossier: typeof api;
  }
}
