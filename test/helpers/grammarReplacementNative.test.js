const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

test(
  "native grammar replacement verifies selections and never retries uncertain edits",
  {
    skip: process.platform !== "darwin",
    timeout: 60000,
  },
  (t) => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "ducky-grammar-native-"));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    const source = fs.readFileSync(
      path.join(__dirname, "../../resources/macos-text-monitor.swift"),
      "utf8"
    );
    function section(start, end) {
      const from = source.indexOf(start);
      const to = source.indexOf(end, from);
      assert.ok(from >= 0 && to > from, `Missing native section: ${start}`);
      return source.slice(from, to);
    }
    const harness = [
      "import Cocoa\nimport Carbon\nimport Foundation\nimport Darwin\n",
      section("private struct GrammarField", "private func attribute"),
      section("private func sameTextField", "private func select"),
      section("private func grammarEdit", "private func rangeAttribute"),
      section("private func replaceGrammarSelection", "private func runGrammarCorrection"),
      fs.readFileSync(path.join(__dirname, "../native/grammarReplacement.swift"), "utf8"),
    ].join("\n");
    const swift = path.join(directory, "main.swift");
    const binary = path.join(directory, "grammar-test");
    fs.writeFileSync(swift, harness);
    const compiled = spawnSync(
      "xcrun",
      [
        "swiftc",
        swift,
        "-module-cache-path",
        path.join(os.tmpdir(), "ducky-grammar-swift-module-cache"),
        "-o",
        binary,
      ],
      { encoding: "utf8", timeout: 45000 }
    );
    assert.equal(compiled.status, 0, compiled.stderr || compiled.error?.message);
    const result = spawnSync(binary, [], { encoding: "utf8", timeout: 10000 });
    assert.equal(result.status, 0, result.stderr || result.error?.message);
    assert.match(result.stdout, /12 grammar replacement scenarios passed/);
  }
);
