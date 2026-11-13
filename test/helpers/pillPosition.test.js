const test = require("node:test");
const assert = require("node:assert/strict");

const display = {
  bounds: { x: -1800, y: -200, width: 1800, height: 1169 },
  workArea: { x: -1740, y: -162, width: 1740, height: 1100 },
};

require.cache[require.resolve("electron")] = {
  exports: {
    app: { on() {} },
    screen: { getDisplayNearestPoint: () => display },
    BrowserWindow: {},
    shell: {},
    dialog: {},
    globalShortcut: {},
    Menu: {},
  },
};

const { WindowPositionUtil, WINDOW_SIZES } = require("../../src/helpers/windowConfig");
const WindowManager = require("../../src/helpers/windowManager");

test("grammar activity shows a passive pill and sends state without focusing the editor away", () => {
  const calls = [];
  const manager = {
    mainWindow: {
      isDestroyed: () => false,
      isMinimized: () => false,
      isVisible: () => false,
      showInactive: () => calls.push("showInactive"),
      focus: () => assert.fail("Grammar correction must retain editor focus"),
      webContents: { send: (...args) => calls.push(args) },
    },
    _repositionToCursorDisplay() {},
    setMainWindowFocusable: (value) => calls.push(["focusable", value]),
    setMainWindowInteractivity: (value) => calls.push(["interactive", value]),
    showDictationPanel: WindowManager.prototype.showDictationPanel,
  };
  WindowManager.prototype.setGrammarCorrectionWorking.call(manager, true);
  WindowManager.prototype.setGrammarCorrectionWorking.call(manager, false);
  assert.deepEqual(calls, [
    ["focusable", false],
    ["interactive", false],
    "showInactive",
    ["grammar-correction-state", true],
    ["grammar-correction-state", false],
  ]);
});

test("top-center uses the display center and starts below the menu bar", () => {
  assert.deepEqual(WindowPositionUtil.getMainWindowPosition(display, null, "top-center"), {
    x: -948,
    y: -158,
    ...WINDOW_SIZES.BASE,
  });
});

test("top-center stays anchored when the pill expands and collapses", () => {
  let bounds = WindowPositionUtil.getMainWindowPosition(display, null, "top-center");
  const manager = {
    _panelStartPosition: "top-center",
    mainWindow: {
      isDestroyed: () => false,
      getBounds: () => bounds,
      setBounds: (next) => {
        bounds = next;
      },
    },
  };
  const initial = { ...bounds };
  WindowManager.prototype.resizeMainWindow.call(manager, "EXPANDED");
  assert.equal(bounds.y, initial.y);
  assert.equal(bounds.x + bounds.width / 2, initial.x + initial.width / 2);
  WindowManager.prototype.resizeMainWindow.call(manager, "BASE");
  assert.deepEqual(bounds, initial);
});

test("transcription preview opens below a pill near the top of the screen", () => {
  const pill = WindowPositionUtil.getMainWindowPosition(display, null, "top-center");
  const preview = WindowPositionUtil.getTranscriptionPreviewPosition(display, pill, {
    width: 400,
    height: 300,
  });
  assert.equal(preview.y, pill.y + pill.height + 8);
});
