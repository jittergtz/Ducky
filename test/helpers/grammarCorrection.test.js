const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { EventEmitter } = require("node:events");

const handlers = new Map();
const registered = new Map();
const notifications = [];
const clipboardWrites = [];
const history = [];
const openedUrls = [];
const workingStates = [];
let generationWait;
let onGenerationStarted;
let permissionGranted = true;
let generatedText = "I wrote an email.";
let userData;
let requests;

require.cache[require.resolve("electron")] = {
  exports: {
    app: { getPath: () => userData },
    clipboard: { writeText: (text) => clipboardWrites.push(text) },
    dialog: {
      showMessageBox: () => assert.fail("Grammar Correction opened a modal"),
    },
    ipcMain: { handle: (channel, callback) => handlers.set(channel, callback) },
    BrowserWindow: class {},
    shell: { openExternal: async (url) => openedUrls.push(url) },
    systemPreferences: { isTrustedAccessibilityClient: () => permissionGranted },
    Notification: class extends EventEmitter {
      constructor(options) {
        super();
        this.options = options;
        notifications.push(this);
      }
      show() {}
      close() {
        this.emit("close");
      }
    },
    globalShortcut: {
      register(accelerator, callback) {
        if (registered.has(accelerator)) return false;
        registered.set(accelerator, callback);
        return true;
      },
      unregister: (accelerator) => registered.delete(accelerator),
      isRegistered: (accelerator) => registered.has(accelerator),
    },
  },
};
require.cache[require.resolve("../../src/helpers/chatgptSubscription")] = {
  exports: {
    status: () => ({ connected: true }),
    async generate(request) {
      requests.push(request);
      onGenerationStarted?.();
      await generationWait;
      return generatedText;
    },
  },
};

const HotkeyManager = require("../../src/helpers/hotkeyManager");
const setupGrammarCorrection = require("../../src/helpers/grammarCorrection");

function setUp(t, helperScript) {
  userData = fs.mkdtempSync(path.join(os.tmpdir(), "spoken-grammar-"));
  const directory = userData;
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  requests = [];
  handlers.clear();
  registered.clear();
  notifications.length = 0;
  clipboardWrites.length = 0;
  history.length = 0;
  openedUrls.length = 0;
  permissionGranted = true;
  generatedText = "I wrote an email.";
  generationWait = undefined;
  onGenerationStarted = undefined;
  workingStates.length = 0;

  const hotkeys = new HotkeyManager();
  hotkeys.setupShortcuts("F8", () => {});
  setupGrammarCorrection(
    hotkeys,
    { resolveBinary: () => ({ command: process.execPath, args: ["-e", helperScript, "--"] }) },
    (entry) => history.push(entry),
    (working) => workingStates.push(working)
  )();
  const setHotkey = (hotkey) => handlers.get("set-grammar-correction-hotkey")(null, hotkey);
  assert.equal(setHotkey("F8").success, false);
  assert.equal(setHotkey("F9").success, true);
  assert.equal(handlers.get("set-grammar-correction-model")(null, "test-model").success, true);
  return registered.get("F9");
}

const macOnly = { skip: process.platform !== "darwin" };

test("missing Accessibility access opens settings without reading text", macOnly, async (t) => {
  const correct = setUp(t, 'console.log("text:" + JSON.stringify("private draft"))');
  permissionGranted = false;
  await correct();
  assert.deepEqual(requests, []);
  assert.equal(notifications.length, 1);
  assert.match(notifications[0].options.body, /Accessibility/);
  notifications[0].emit("click");
  assert.deepEqual(openedUrls, [
    "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility",
  ]);
});

test("helper permission failures open Accessibility settings", macOnly, async (t) => {
  const correct = setUp(t, 'console.log("permission")');
  await correct();
  assert.deepEqual(requests, []);
  notifications[0].emit("click");
  assert.match(openedUrls[0], /Privacy_Accessibility/);
});

test(
  "permission lost during correction preserves the result and offers settings",
  macOnly,
  async (t) => {
    const correct = setUp(
      t,
      `console.log('text:' + JSON.stringify('I writed an email.'));
    require('node:readline').createInterface({ input: process.stdin }).once('line', () => {
      console.log('permission');
    });`
    );
    await correct();
    assert.equal(history[0].outcome, "preview");
    assert.deepEqual(clipboardWrites, []);
    notifications[0].emit("click");
    assert.deepEqual(clipboardWrites, ["I wrote an email."]);
    assert.match(openedUrls[0], /Privacy_Accessibility/);
  }
);

test("an empty model response never replaces the original", macOnly, async (t) => {
  const correct = setUp(
    t,
    `console.log('text:' + JSON.stringify('I writed an email.'));
    process.stdin.on('data', () => process.exit(1));`
  );
  generatedText = "  ";
  await correct();
  assert.equal(requests.length, 1);
  assert.deepEqual(history, []);
  assert.match(notifications[0].options.body, /couldn’t finish/);
});

test("unavailable fields never send text to ChatGPT", macOnly, async (t) => {
  const correct = setUp(t, 'console.log("unsupported")');
  await correct();
  assert.equal(notifications.length, 1);
  assert.deepEqual(requests, []);
  assert.deepEqual(history, []);
  assert.deepEqual(clipboardWrites, []);
  assert.deepEqual(workingStates, [true, false]);
  assert.equal(handlers.get("get-grammar-correction-state")(), false);
});

test(
  "working state spans capture, generation and replacement without duplicate starts",
  { ...macOnly, timeout: 5000 },
  async (t) => {
    const correct = setUp(
      t,
      `console.log('text:' + JSON.stringify('I writed an email.'));
    require('node:readline').createInterface({ input: process.stdin }).once('line', () => {
      console.log('applied');
    });`
    );
    let finish;
    generationWait = new Promise((resolve) => {
      finish = resolve;
    });
    const started = new Promise((resolve) => {
      onGenerationStarted = resolve;
    });
    const pending = correct();
    try {
      assert.deepEqual(workingStates, [true]);
      assert.equal(handlers.get("get-grammar-correction-state")(), true);
      await started;
      assert.equal(history.length, 0);
      assert.equal(requests.length, 1);
      assert.equal(handlers.get("get-grammar-correction-state")(), true);
      await correct();
      assert.deepEqual(workingStates, [true]);
    } finally {
      finish();
      await pending;
    }
    assert.deepEqual(workingStates, [true, false]);
    assert.equal(history[0].outcome, "applied");
    assert.equal(handlers.get("get-grammar-correction-state")(), false);
  }
);

test(
  "a changed field only copies the correction when the notification is clicked",
  macOnly,
  async (t) => {
    const correct = setUp(
      t,
      `console.log('text:' + JSON.stringify('  I writed an email.  '));
     require('node:readline').createInterface({ input: process.stdin }).once('line', (line) => {
       console.log(JSON.parse(line) === '  I wrote an email.  ' ? 'changed' : 'applied');
     });`
    );
    await correct();
    assert.equal(requests.length, 1);
    assert.equal(requests[0].text, "  I writed an email.  ");
    assert.equal(requests[0].model, "test-model");
    assert.deepEqual(history, [
      {
        text: "  I wrote an email.  ",
        raw_text: "  I writed an email.  ",
        model: "test-model",
        outcome: "changed",
      },
    ]);
    assert.equal(notifications.length, 1);
    assert.match(notifications[0].options.body, /field or selection changed/i);
    assert.equal(notifications[0].options.silent, true);
    assert.deepEqual(clipboardWrites, []);
    notifications[0].emit("click");
    assert.deepEqual(clipboardWrites, ["  I wrote an email.  "]);
  }
);

test("applied and unchanged corrections are silent", macOnly, async (t) => {
  const applied = setUp(
    t,
    `console.log('text:' + JSON.stringify('I writed an email.'));
     require('node:readline').createInterface({ input: process.stdin }).once('line', () => {
       console.log('applied');
     });`
  );
  await applied();
  await applied();
  assert.equal(requests.length, 2);
  assert.equal(history.length, 2);
  assert.equal(history[0].outcome, "applied");
  assert.deepEqual(notifications, []);
  assert.deepEqual(clipboardWrites, []);

  const unchanged = setUp(t, "console.log('text:' + JSON.stringify('I wrote an email.'))");
  await unchanged();
  assert.equal(requests.length, 1);
  assert.equal(history.length, 1);
  assert.equal(history[0].outcome, "unchanged");
  assert.deepEqual(notifications, []);
  assert.deepEqual(clipboardWrites, []);
});
