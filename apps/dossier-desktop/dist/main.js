import { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage } from "electron";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runGoogleTakeoutImport } from "@dossier/connectors-google-takeout";
import { DossierStoreService } from "@dossier/store";
import { LocalProfileServer } from "@dossier/local-server";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const APP_NAME = "Dossier";
let mainWindow = null;
let tray = null;
let isQuitting = false;
let storeService;
let server;
const defaultSettings = {
    theme: "Parchment",
    dyslexiaMode: false,
    highFidelityEnabled: false,
    startOnLogin: false
};
let settingsCache = defaultSettings;
function getAssetPath(fileName) {
    return join(__dirname, "..", "assets", fileName);
}
function getTrayIcon() {
    const trayPath = process.platform === "darwin" ? getAssetPath("trayTemplate.png") : getAssetPath("logo.png");
    const icon = nativeImage.createFromPath(trayPath);
    if (icon.isEmpty()) {
        return nativeImage.createEmpty();
    }
    if (process.platform === "darwin") {
        const resized = icon.resize({ width: 18, height: 18, quality: "best" });
        resized.setTemplateImage(true);
        return resized;
    }
    return icon;
}
function getRendererEntryUrl() {
    const devServer = process.env.DOSSIER_UI_DEV_SERVER;
    if (devServer) {
        return devServer;
    }
    const uiBuild = join(__dirname, "..", "..", "dossier-ui", "build", "index.html");
    return `file://${uiBuild}`;
}
function createMainWindow() {
    const window = new BrowserWindow({
        width: 1100,
        height: 750,
        minWidth: 800,
        minHeight: 600,
        show: false,
        webPreferences: {
            preload: join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            webSecurity: true
        },
        icon: getAssetPath("logo.png")
    });
    void window.loadURL(getRendererEntryUrl());
    window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    window.on("close", (event) => {
        if (!isQuitting) {
            event.preventDefault();
            window.hide();
        }
    });
    window.once("ready-to-show", () => {
        window.show();
    });
    return window;
}
function createTray() {
    tray = new Tray(getTrayIcon());
    tray.setToolTip(APP_NAME);
    const menu = Menu.buildFromTemplate([
        {
            label: `Open ${APP_NAME}`,
            click: () => {
                mainWindow?.show();
            }
        },
        {
            label: `Quit ${APP_NAME}`,
            click: () => {
                isQuitting = true;
                void server.stop().catch(() => undefined);
                app.quit();
            }
        }
    ]);
    tray.setContextMenu(menu);
    tray.on("click", () => mainWindow?.show());
}
process.title = APP_NAME;
app.setName(APP_NAME);
app.setAboutPanelOptions({
    applicationName: APP_NAME
});
function setMacApplicationMenu() {
    if (process.platform !== "darwin") {
        return;
    }
    const template = [
        {
            label: APP_NAME,
            submenu: [{ role: "about" }, { type: "separator" }, { role: "hide" }, { role: "hideOthers" }, { role: "unhide" }, { type: "separator" }, { role: "quit" }]
        }
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
function registerIpcHandlers() {
    ipcMain.handle("app:get-version", () => app.getVersion());
    ipcMain.handle("window:show", () => {
        mainWindow?.show();
    });
    ipcMain.handle("window:hide", () => {
        mainWindow?.hide();
    });
    ipcMain.handle("window:quit", async () => {
        isQuitting = true;
        await server.stop();
        app.quit();
    });
    ipcMain.handle("settings:get", () => settingsCache);
    ipcMain.handle("settings:set", (_event, next) => {
        settingsCache = {
            ...settingsCache,
            ...next
        };
        storeService.repository.setHighFidelityEnabled(settingsCache.highFidelityEnabled);
        storeService.repository.updateProfileSettings({ ...settingsCache });
        app.setLoginItemSettings({ openAtLogin: settingsCache.startOnLogin });
        return settingsCache;
    });
    ipcMain.handle("profile:list-items", () => {
        return storeService.repository.listItems();
    });
    ipcMain.handle("profile:create-manual-item", (_event, payload) => {
        return storeService.repository.createManualItem(payload);
    });
    ipcMain.handle("server:health", async () => {
        const response = await fetch("http://127.0.0.1:34250/health");
        return response.json();
    });
    ipcMain.handle("data:export-encrypted", (_event, passphrase) => {
        return storeService.createEncryptedExport(passphrase);
    });
    ipcMain.handle("data:import-encrypted", (_event, artifact, passphrase) => {
        storeService.importEncryptedExport(artifact, passphrase);
    });
    ipcMain.handle("data:run-takeout-import", (_event, importPath) => {
        return runGoogleTakeoutImport(storeService, importPath);
    });
}
async function bootstrap() {
    const dataDir = join(app.getPath("userData"), "dossier");
    storeService = await DossierStoreService.init(dataDir);
    settingsCache = {
        ...defaultSettings,
        ...storeService.repository.snapshot().profile.profile_settings_json
    };
    server = new LocalProfileServer(storeService);
    await server.start();
    server.on("consent:request", (payload) => {
        mainWindow?.webContents.send("consent:request", payload);
        if (!mainWindow?.isVisible()) {
            mainWindow?.show();
        }
    });
    mainWindow = createMainWindow();
    createTray();
    registerIpcHandlers();
}
app.whenReady().then(() => {
    setMacApplicationMenu();
    if (process.platform === "darwin") {
        const dockIcon = nativeImage.createFromPath(getAssetPath("logo-mac.png"));
        if (!dockIcon.isEmpty()) {
            app.dock?.setIcon(dockIcon);
        }
    }
    void bootstrap().catch((error) => {
        console.error("Failed to bootstrap Dossier desktop app", error);
        app.quit();
    });
});
app.on("before-quit", () => {
    isQuitting = true;
});
app.on("window-all-closed", () => undefined);
app.on("activate", () => {
    if (!mainWindow) {
        mainWindow = createMainWindow();
        return;
    }
    mainWindow.show();
});
//# sourceMappingURL=main.js.map