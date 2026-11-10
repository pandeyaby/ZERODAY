/**
 * The snapshot never copies a file from outside the repository, even when a
 * symbolic link inside the repository points at one.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createSnapshot, destroySnapshot } from "../../src/locate/snapshot.ts";

describe("snapshot and symbolic links", { skip: process.platform === "win32" }, () => {
  it("skips links that leave the repository and keeps links inside it", () => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), "zd-snap-outside-"));
    fs.writeFileSync(path.join(outside, "secret.js"), "const key = 'do-not-copy';\n");
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), "zd-snap-repo-"));
    fs.mkdirSync(path.join(repo, "src"));
    fs.writeFileSync(path.join(repo, "src/app.js"), "module.exports = 1;\n");
    fs.symlinkSync(path.join(outside, "secret.js"), path.join(repo, "src/leak.js"));
    fs.symlinkSync(outside, path.join(repo, "linked-dir"));
    fs.symlinkSync(path.join(repo, "src/app.js"), path.join(repo, "alias.js"));

    const snap = createSnapshot(repo);
    try {
      assert.equal(fs.existsSync(path.join(snap.snapshotPath, "src/app.js")), true);
      assert.equal(fs.existsSync(path.join(snap.snapshotPath, "alias.js")), true, "a link inside the repo is kept");
      assert.equal(fs.existsSync(path.join(snap.snapshotPath, "src/leak.js")), false);
      assert.equal(fs.existsSync(path.join(snap.snapshotPath, "linked-dir")), false);
      assert.ok(snap.warnings.some((w) => /2 symbolic link\(s\) that point outside the repository/.test(w)), snap.warnings.join("\n"));
    } finally {
      destroySnapshot(snap.snapshotPath);
    }
  });
});
