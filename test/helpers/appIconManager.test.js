const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { EventEmitter } = require("events");
const { AppIconManager } = require("../../src/helpers/appIconManager");
const appIcons = require("../../src/constants/appIcons.json");

function fixture(t, platform = "darwin", directory) {
  const userData = directory || fs.mkdtempSync(path.join(os.tmpdir(), "ducky-icon-test-"));
  if (!directory) t.after(() => fs.rmSync(userData, { recursive: true, force: true }));
  const app = new EventEmitter();
  const dockIcons = [];
  const windowIcons = [];
  const messages = [];
  const handlers = new Map();
  const window = {
    isDestroyed: () => false,
    setIcon: (image) => windowIcons.push(image),
    webContents: { send: (...args) => messages.push(args) },
  };
  app.getPath = () => userData;
  app.dock = { setIcon: (image) => dockIcons.push(image) };
  const manager = new AppIconManager({
    app,
    BrowserWindow: { getAllWindows: () => [window] },
    nativeImage: { createFromPath: (file) => ({ file, isEmpty: () => !fs.existsSync(file) }) },
    getIconPath: (id) => path.resolve("src/assets", appIcons.find((icon) => icon.id === id).file),
    logger: { warn: () => {} },
    platform,
  });
  manager.initialize({ handle: (name, handler) => handlers.set(name, handler) });
  return { manager, userData, app, dockIcons, windowIcons, messages, handlers };
}

test("all bundled choices are valid PNGs and included by the packaging config", () => {
  const config = require("../../electron-builder.json");
  assert.ok(config.extraResources.includes("src/assets/**/*"));
  for (const icon of appIcons) {
    const file = fs.readFileSync(path.resolve("src/assets", icon.file));
    assert.equal(file.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  }
});

test("selection immediately updates the Dock, persists, broadcasts, and survives restart", (t) => {
  const f = fixture(t);
  assert.equal(f.handlers.get("get-app-icon")().selectedIcon, "classic");
  for (const id of ["glacier", "rose", "classic"]) {
    assert.deepEqual(f.handlers.get("set-app-icon")(null, id), {
      selectedIcon: id,
      supported: true,
      success: true,
    });
    assert.equal(f.dockIcons.at(-1).file, f.manager.getIconPath(id));
    assert.deepEqual(JSON.parse(fs.readFileSync(f.manager.settingsPath)), { iconId: id });
    assert.deepEqual(f.messages.at(-1), [
      "app-icon-changed",
      { selectedIcon: id, supported: true },
    ]);
    const restarted = fixture(t, "darwin", f.userData);
    assert.equal(restarted.manager.selectedIcon, id);
    assert.equal(restarted.dockIcons.at(-1).file, f.manager.getIconPath(id));
  }
  assert.equal(f.windowIcons.length, 0, "macOS must use the Dock API");
});

test("Windows and Linux update existing and newly created windows", (t) => {
  for (const platform of ["win32", "linux"]) {
    const f = fixture(t, platform);
    f.manager.select("rose");
    assert.equal(f.windowIcons.at(-1).file, f.manager.getIconPath("rose"));
    assert.equal(f.dockIcons.length, 0);
    const newIcons = [];
    f.app.emit("browser-window-created", null, { setIcon: (icon) => newIcons.push(icon) });
    assert.deepEqual(newIcons, [f.manager.getIconPath("rose")]);
  }
});

test("renderer values cannot select arbitrary files or mutate preferences", (t) => {
  const f = fixture(t);
  for (const value of ["../secret.png", "/tmp/icon.png", "__proto__", {}, null, 1]) {
    assert.equal(f.manager.select(value).success, false);
  }
  assert.equal(f.dockIcons.length, 1);
  assert.equal(fs.existsSync(f.manager.settingsPath), false);
  assert.equal(f.messages.length, 0);
});

test("corrupt and unknown saved values fall back to Classic", (t) => {
  const f = fixture(t);
  for (const contents of ["broken JSON", '{"iconId":"../outside.png"}', "null"]) {
    fs.writeFileSync(f.manager.settingsPath, contents);
    const restarted = fixture(t, "darwin", f.userData);
    assert.equal(restarted.manager.selectedIcon, "classic");
    assert.equal(restarted.dockIcons.at(-1).file, f.manager.getIconPath("classic"));
  }
});

test("a failed preference write restores the previous icon and reports failure", (t) => {
  const f = fixture(t);
  f.manager.select("glacier");
  const originalSettings = fs.readFileSync(f.manager.settingsPath, "utf8");
  fs.mkdirSync(`${f.manager.settingsPath}.tmp`);
  const result = f.manager.select("rose");
  assert.deepEqual(result, { success: false, supported: true, selectedIcon: "glacier" });
  assert.equal(f.dockIcons.at(-1).file, f.manager.getIconPath("glacier"));
  assert.equal(fs.readFileSync(f.manager.settingsPath, "utf8"), originalSettings);
  assert.equal(f.messages.length, 1);
});

test("missing alternative artwork fails without changing the saved selection", (t) => {
  const f = fixture(t);
  const resolveIcon = f.manager.getIconPath;
  f.manager.getIconPath = (id) =>
    id === "rose" ? path.join(f.userData, "missing.png") : resolveIcon(id);
  assert.equal(f.manager.select("rose").success, false);
  assert.equal(f.manager.selectedIcon, "classic");
  assert.equal(f.dockIcons.at(-1).file, resolveIcon("classic"));
  assert.equal(fs.existsSync(f.manager.settingsPath), false);
});

test("a closed renderer cannot roll back a successfully saved icon", (t) => {
  const f = fixture(t);
  f.manager.BrowserWindow.getAllWindows = () => [
    {
      isDestroyed: () => false,
      webContents: {
        send: () => {
          throw new Error("Renderer exited");
        },
      },
    },
  ];
  assert.equal(f.manager.select("rose").success, true);
  assert.equal(f.manager.selectedIcon, "rose");
  assert.equal(JSON.parse(fs.readFileSync(f.manager.settingsPath)).iconId, "rose");
  assert.equal(f.dockIcons.at(-1).file, f.manager.getIconPath("rose"));
});
