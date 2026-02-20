import { contextBridge, ipcRenderer } from "electron";
const api = {
    app: {
        getVersion: () => ipcRenderer.invoke("app:get-version")
    },
    window: {
        show: () => ipcRenderer.invoke("window:show"),
        hide: () => ipcRenderer.invoke("window:hide"),
        quit: () => ipcRenderer.invoke("window:quit")
    },
    settings: {
        get: () => ipcRenderer.invoke("settings:get"),
        set: (next) => ipcRenderer.invoke("settings:set", next)
    },
    profile: {
        listItems: () => ipcRenderer.invoke("profile:list-items"),
        createManualItem: (payload) => ipcRenderer.invoke("profile:create-manual-item", payload)
    },
    data: {
        exportEncrypted: (passphrase) => ipcRenderer.invoke("data:export-encrypted", passphrase),
        importEncrypted: (artifact, passphrase) => ipcRenderer.invoke("data:import-encrypted", artifact, passphrase),
        runTakeoutImport: (path) => ipcRenderer.invoke("data:run-takeout-import", path)
    },
    server: {
        health: () => ipcRenderer.invoke("server:health")
    },
    consent: {
        onRequest: (callback) => {
            const listener = (_event, payload) => callback(payload);
            ipcRenderer.on("consent:request", listener);
            return () => ipcRenderer.removeListener("consent:request", listener);
        }
    }
};
contextBridge.exposeInMainWorld("dossier", api);
//# sourceMappingURL=preload.js.map