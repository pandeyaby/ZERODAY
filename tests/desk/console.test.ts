/**
 * Path sandbox + Desk Console API happy paths (rules locate / inventory).
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  assertPathAllowed,
  getAllowedRoots,
  isInsideRoot,
  parseUiRootsEnv,
  PathPolicyError,
  resolveOutputDir,
} from "../../src/lib/path-policy.ts";
import {
  deskCatalog,
  runDeskAction,
  runDeskInventory,
  runDeskRules,
} from "../../src/desk/console.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const rulesSample = path.join(root, "fixtures/locate/rules-sample");
const sidecar = path.join(root, "fixtures/inventory/sidecar-app");

describe("path-policy sandbox", () => {
  it("defaults allowed roots to cwd", () => {
    const roots = getAllowedRoots({ cwd: root, envRoots: null });
    assert.deepEqual(roots, [root]);
  });

  it("parses ZERODAY_UI_ROOTS extras", () => {
    assert.deepEqual(parseUiRootsEnv("/a:/b;/c,/d"), ["/a", "/b", "/c", "/d"]);
    const roots = getAllowedRoots({
      cwd: root,
      envRoots: path.join(root, "fixtures"),
    });
    assert.ok(roots.includes(root));
    assert.ok(roots.includes(path.join(root, "fixtures")));
  });

  it("allows paths under cwd", () => {
    const abs = assertPathAllowed("fixtures/locate/rules-sample", {
      cwd: root,
      mustExist: true,
      kind: "dir",
    });
    assert.equal(abs, rulesSample);
  });

  it("rejects .. escape outside roots", () => {
    assert.throws(
      () =>
        assertPathAllowed("../../etc/passwd", {
          cwd: path.join(root, "fixtures"),
          envRoots: null,
        }),
      (e: Error) =>
        e instanceof PathPolicyError && /escapes sandbox/i.test(e.message),
    );
  });

  it("rejects absolute paths outside roots", () => {
    const outside = path.join(os.tmpdir(), `zeroday-escape-${Date.now()}`);
    fs.mkdirSync(outside, { recursive: true });
    try {
      assert.throws(
        () =>
          assertPathAllowed(outside, {
            cwd: root,
            envRoots: null,
          }),
        PathPolicyError,
      );
    } finally {
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });

  it("isInsideRoot rejects sibling escape", () => {
    assert.equal(isInsideRoot("/workspace/foo", "/workspace"), true);
    assert.equal(isInsideRoot("/workspace", "/workspace"), true);
    assert.equal(isInsideRoot("/other", "/workspace"), false);
  });

  it("resolveOutputDir stays under sandbox", () => {
    const out = resolveOutputDir(undefined, "desk-test", { cwd: root });
    assert.ok(out.startsWith(root));
    assert.match(out, /zeroday-reports/);
  });
});

describe("desk console runners", () => {
  it("catalog lists desk actions + honesty", () => {
    const c = deskCatalog({ cwd: root });
    assert.equal(c.kind, "catalog");
    assert.ok(c.actions.some((a) => a.id === "rules"));
    assert.ok(c.actions.some((a) => a.id === "inventory"));
    assert.ok(c.honesty.some((h) => /needs_human/i.test(h)));
    assert.ok(c.allowedRoots.includes(root));
  });

  it("rules locate on fixtures/locate/rules-sample", async () => {
    const out = path.join(root, "zeroday-reports", "test-desk-rules");
    const r = await runDeskRules({
      action: "rules",
      cwe: "CWE-89",
      repo: "fixtures/locate/rules-sample",
      output: out,
      cwd: root,
    });
    assert.equal(r.kind, "locate");
    assert.equal(r.mode, "rules");
    assert.equal(r.needs_human, true);
    assert.equal(r.cweId, "CWE-89");
    assert.ok(r.findingCount >= 1);
    assert.ok(r.rankedFiles.length >= 1);
    assert.ok(fs.existsSync(r.paths.sarif));
    assert.ok(fs.existsSync(r.paths.json));
  });

  it("inventory on fixtures/inventory/sidecar-app", async () => {
    const out = path.join(root, "zeroday-reports", "test-desk-inventory");
    const r = await runDeskInventory({
      action: "inventory",
      repo: "fixtures/inventory/sidecar-app",
      output: out,
      cwd: root,
    });
    assert.equal(r.kind, "inventory");
    assert.equal(r.needs_human, true);
    assert.ok(r.fileCount >= 1);
    assert.ok(fs.existsSync(r.paths.json));
    assert.ok(sidecar === r.repoRoot || r.repoRoot.includes("sidecar"));
  });

  it("from-sarif ingest on fixtures sample", async () => {
    const out = path.join(root, "zeroday-reports", "test-desk-ingest");
    const r = await runDeskAction({
      action: "from-sarif",
      sarif: "fixtures/locate/ingest-sample/sample.sarif",
      output: out,
      cwd: root,
    });
    assert.equal(r.kind, "locate");
    assert.equal(r.mode, "ingest");
    assert.equal(r.needs_human, true);
    assert.ok(
      "findingCount" in r && (r as { findingCount: number }).findingCount >= 1,
    );
  });

  it("runDeskAction refuses path escape on rules", async () => {
    await assert.rejects(
      () =>
        runDeskAction({
          action: "rules",
          cwe: "CWE-89",
          repo: "/tmp",
          cwd: root,
        }),
      (e: Error) =>
        e instanceof PathPolicyError || /escapes sandbox/i.test(e.message),
    );
  });
});
