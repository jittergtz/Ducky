const path = require("path");
const fs = require("fs");
const appIcons = require("../constants/appIcons.json");

const APP_NAME = "Ducky";
const APP_ID = "com.gizmolabs.ducky";

// Reuse an existing profile in place so SQLite, localStorage, audio, and
// encrypted credentials survive the rename. Fresh installs use Ducky paths.
function resolveUserDataPath(appData, channel, exists = fs.existsSync) {
  const names =
    channel === "production"
      ? [APP_NAME, "Waddle", "spoken", "Spoken"]
      : [`${APP_NAME}-${channel}`, `Waddle-${channel}`, `Spoken-${channel}`, `spoken-${channel}`];
  const candidates = names.map((name) => path.join(appData, name));
  return candidates.find((candidate) => exists(candidate)) || candidates[0];
}

function getAppIconPath(iconId = "classic") {
  const { app } = require("electron");
  const icon = appIcons.find((entry) => entry.id === iconId) || appIcons[0];
  const assets = app.isPackaged
    ? path.join(process.resourcesPath, "src", "assets")
    : path.join(__dirname, "..", "assets");
  return path.join(assets, icon.file);
}

module.exports = { APP_NAME, APP_ID, resolveUserDataPath, getAppIconPath };
