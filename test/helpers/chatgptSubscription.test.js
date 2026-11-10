const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");

let userData;
const safeStorage = {
  isEncryptionAvailable: () => true,
  decryptString: () => {
    throw new Error("Error while decrypting the ciphertext provided to safeStorage.decryptString.");
  },
};
const shell = { openExternal: () => assert.fail("Unexpected browser sign-in") };
require.cache[require.resolve("electron")] = {
  exports: { app: { getPath: () => userData }, safeStorage, shell },
};
const chatgpt = require("../../src/helpers/chatgptSubscription");

function savedSession(t) {
  userData = fs.mkdtempSync(path.join(os.tmpdir(), "ducky-chatgpt-"));
  const directory = userData;
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const file = path.join(directory, "chatgpt-subscription.bin");
  fs.writeFileSync(file, "old ciphertext");
  return file;
}

test("an unreadable session allows a new sign-in and survives a declined authorization", async (t) => {
  const file = savedSession(t);
  const server = Object.assign(new EventEmitter(), {
    listen: (_port, _host, callback) => callback(),
    address: () => ({ port: 12345 }),
    close: () => {},
  });
  t.mock.method(http, "createServer", () => server);
  const open = t.mock.method(shell, "openExternal", async (url) => {
    const params = new URL(url).searchParams;
    const callback = new URL(params.get("redirect_uri"));
    callback.searchParams.set("state", params.get("state"));
    callback.searchParams.set("error", "access_denied");
    server.emit(
      "request",
      { url: callback.pathname + callback.search },
      {
        writeHead: () => ({ end: () => {} }),
      }
    );
  });

  assert.deepEqual(chatgpt.status(), { connected: false, email: "" });
  await assert.rejects(chatgpt.signIn(), /Sign-in failed: access_denied/);
  const auth = new URL(open.mock.calls[0].arguments[0]);
  assert.equal(auth.searchParams.get("client_id"), "dynamic_agent_client");
  assert.equal(fs.readFileSync(file, "utf8"), "old ciphertext");
});

test("a readable saved session remains connected", (t) => {
  savedSession(t);
  t.mock.method(safeStorage, "decryptString", () =>
    JSON.stringify({ email: "user@example.com", tokens: { access_token: "access" } })
  );

  assert.deepEqual(chatgpt.status(), { connected: true, email: "user@example.com" });
});

test("unavailable secure storage blocks sign-in before opening the browser", async (t) => {
  savedSession(t);
  t.mock.method(safeStorage, "isEncryptionAvailable", () => false);

  await assert.rejects(chatgpt.signIn(), /Secure credential storage is unavailable/);
});
