const fs = require("fs");
const path = require("path");
const appIcons = require("../constants/appIcons.json");

// Only shipped artwork can be selected. Never accept a renderer-provided path.
class AppIconManager {
  constructor({
    app,
    BrowserWindow,
    nativeImage,
    getIconPath,
    logger,
    platform = process.platform,
  }) {
    this.app = app;
    this.BrowserWindow = BrowserWindow;
    this.nativeImage = nativeImage;
    this.getIconPath = getIconPath;
    this.logger = logger;
    this.platform = platform;
    this.selectedIcon = "classic";
  }

  getState() {
    return {
      selectedIcon: this.selectedIcon,
      supported: ["darwin", "win32", "linux"].includes(this.platform),
    };
  }

  initialize(ipcMain) {
    this.settingsPath = path.join(this.app.getPath("userData"), "app-icon.json");
    try {
      const { iconId } = JSON.parse(fs.readFileSync(this.settingsPath, "utf8"));
      if (appIcons.some((icon) => icon.id === iconId)) this.selectedIcon = iconId;
    } catch (error) {
      if (error.code !== "ENOENT") this.logger.warn("Could not read app icon preference", error);
    }

    try {
      this.apply(this.selectedIcon);
    } catch (error) {
      this.logger.warn("Could not restore app icon", error);
      this.selectedIcon = "classic";
      this.apply(this.selectedIcon);
    }

    // Windows can be recreated long after startup (e.g. reopening Settings).
    this.app.on("browser-window-created", (_event, window) => {
      if (this.platform === "darwin" || !this.getState().supported) return;
      try {
        window.setIcon(this.getIconPath(this.selectedIcon));
      } catch (error) {
        this.logger.warn("Could not set new window icon", error);
      }
    });
    ipcMain.handle("get-app-icon", () => this.getState());
    ipcMain.handle("set-app-icon", (_event, iconId) => this.select(iconId));
  }

  apply(iconId) {
    const image = this.nativeImage.createFromPath(this.getIconPath(iconId));
    if (image.isEmpty()) throw new Error("App icon artwork could not be loaded");
    if (this.platform === "darwin") {
      this.app.dock.setIcon(image);
    } else if (this.getState().supported) {
      for (const window of this.BrowserWindow.getAllWindows()) {
        if (!window.isDestroyed()) window.setIcon(image);
      }
    }
  }

  select(iconId) {
    if (!this.getState().supported || !appIcons.some((icon) => icon.id === iconId)) {
      return { ...this.getState(), success: false };
    }
    const previousIcon = this.selectedIcon;
    try {
      this.apply(iconId);
      // Atomic replacement keeps an interrupted write from losing the preference.
      const temporary = `${this.settingsPath}.tmp`;
      fs.writeFileSync(temporary, JSON.stringify({ iconId }), { mode: 0o600 });
      fs.renameSync(temporary, this.settingsPath);
    } catch (error) {
      this.logger.warn("Could not change app icon", error);
      try {
        this.apply(previousIcon);
      } catch (rollbackError) {
        this.logger.warn("Could not restore previous app icon", rollbackError);
      }
      return { ...this.getState(), success: false };
    }
    this.selectedIcon = iconId;
    for (const window of this.BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) {
        try {
          window.webContents.send("app-icon-changed", this.getState());
        } catch (error) {
          this.logger.warn("Could not notify window of app icon change", error);
        }
      }
    }
    return { ...this.getState(), success: true };
  }
}

module.exports = { AppIconManager };
