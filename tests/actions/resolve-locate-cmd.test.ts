/**
 * Unit tests for the locate-gate Action mode resolver (keyless only).
 */

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(import.meta.url);
const { resolveLocateCmd } = require(
  path.join(root, ".github/actions/zeroday-locate-gate/resolve-locate-cmd.js"),
);

describe("zeroday-locate-gate resolveLocateCmd", () => {
  it("defaults to fixture mode", () => {
    const r = resolveLocateCmd({});
    assert.equal(r.expectedMode, "fixture");
    assert.ok(r.argv.includes("--fixture"));
    assert.ok(!r.argv.includes("--rules"));
    assert.ok(!r.argv.includes("--recording"));
    assert.ok(!r.argv.includes("--endpoint"));
    assert.ok(!r.argv.includes("--live"));
  });

  it("resolves rules mode with offline", () => {
    const r = resolveLocateCmd({
      mode: "rules",
      cwe: "CWE-89",
      repo: "fixtures/locate/rules-sample",
      output: "zeroday-reports/ci-org-rules",
    });
    assert.equal(r.expectedMode, "rules");
    assert.ok(r.argv.includes("--rules"));
    assert.ok(r.argv.includes("--offline"));
    assert.ok(r.argv.includes("fixtures/locate/rules-sample"));
    assert.ok(!r.argv.includes("--fixture"));
    assert.ok(!r.argv.includes("--endpoint"));
  });

  it("resolves recording mode from cassette path", () => {
    const cassette =
      "fixtures/locate/org-recordings/rules-cwe-89.cassette.json";
    const r = resolveLocateCmd({
      mode: "recording",
      recording: cassette,
      output: "zeroday-reports/ci-org-recording",
    });
    assert.equal(r.expectedMode, "recording");
    assert.ok(r.argv.includes("--recording"));
    assert.ok(r.argv.includes(cassette));
    assert.ok(!r.argv.includes("--rules"));
    assert.ok(!r.argv.includes("--fixture"));
  });

  it("refuses live / endpoint modes (spend gate)", () => {
    assert.throws(() => resolveLocateCmd({ mode: "live" }), /refused|workstation/i);
    assert.throws(
      () => resolveLocateCmd({ mode: "endpoint" }),
      /refused|workstation/i,
    );
  });

  it("refuses recording without cassette path", () => {
    assert.throws(
      () => resolveLocateCmd({ mode: "recording" }),
      /requires input `recording`/,
    );
  });

  it("refuses unknown modes", () => {
    assert.throws(() => resolveLocateCmd({ mode: "ingest" }), /unknown mode/i);
  });
});
