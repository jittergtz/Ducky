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
