/**
 * Baseline + diff mode: only new findings (or findings in changed files) block CI.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { locate } from "../../src/locate/index.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OLD = `app.get("/a", (req, res) => db.query("SELECT * FROM a WHERE x='" + req.query.x + "'"));\n`;
const NEW = `app.get("/b", (req, res) => db.query("SELECT * FROM b WHERE y='" + req.query.y + "'"));\n`;

function git(dir: string, ...args: string[]) {
  const r = spawnSync("git", ["-C", dir, ...args], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
}

function repoWithHistory(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-baseline-"));
  git(dir, "init", "-q", "-b", "main");
  git(dir, "config", "user.email", "t@example.com");
  git(dir, "config", "user.name", "t");
  fs.mkdirSync(path.join(dir, "src"));
  fs.writeFileSync(path.join(dir, "src/old.js"), OLD);
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "base");
  return dir;
}

const out = () => fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-baseline-out-"));

describe("baseline + diff mode", () => {
  it("fingerprints survive line shifts; new findings are marked new", async () => {
    const dir = repoWithHistory();
    const base = await locate({ repo: dir, advisory: "CWE-89", rules: true, offline: true, outputDir: out() });
    assert.equal(base.result.rankedFiles.length, 1);
    assert.match(base.result.rankedFiles[0]!.fingerprint!, /^[0-9a-f]{24}$/);

    // Shift the old finding down a few lines and add a new vulnerable file.
    fs.writeFileSync(path.join(dir, "src/old.js"), `// header\n\n\n${OLD}`);
    fs.writeFileSync(path.join(dir, "src/new.js"), NEW);

    const next = await locate({ repo: dir, advisory: "CWE-89", rules: true, offline: true, outputDir: out(), baseline: base.jsonPath });
    assert.deepEqual(next.result.summary.baseline && { n: next.result.summary.baseline.new, u: next.result.summary.baseline.unchanged, a: next.result.summary.baseline.absent }, { n: 1, u: 1, a: 0 });
    assert.equal(next.result.rankedFiles[0]!.filePath, "src/new.js");
    assert.equal(next.result.rankedFiles[0]!.baselineState, "new");
    assert.equal(next.result.rankedFiles[1]!.baselineState, "unchanged");

    const sarif = JSON.parse(fs.readFileSync(next.sarifPath, "utf8"));
    const states = sarif.runs[0].results.map((r: { baselineState?: string }) => r.baselineState).sort();
    assert.deepEqual(states, ["new", "unchanged"]);
    assert.ok(sarif.runs[0].results.every((r: { partialFingerprints: Record<string, string> }) => /^[0-9a-f]{24}$/.test(r.partialFingerprints["zeroday/v1"]!)));
  });

  it("--changed-since keeps only findings in changed files", async () => {
    const dir = repoWithHistory();
    fs.writeFileSync(path.join(dir, "src/new.js"), NEW);
    const r = await locate({ repo: dir, advisory: "CWE-89", rules: true, offline: true, outputDir: out(), changedSince: "HEAD" });
    assert.deepEqual(r.result.rankedFiles.map((f) => f.filePath), ["src/new.js"]);
    assert.equal(r.result.summary.changedSince?.droppedFindings, 1);
  });

  it("--changed-since outside a git repo fails closed", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-nogit-"));
    fs.writeFileSync(path.join(dir, "a.js"), OLD);
    await assert.rejects(
      () => locate({ repo: dir, advisory: "CWE-89", rules: true, offline: true, outputDir: out(), changedSince: "HEAD" }),
      /--changed-since HEAD: git/,
    );
  });

  it("CLI --fail-on-findings with --baseline exits 1 only for new findings", () => {
    const dir = repoWithHistory();
    const cli = (...args: string[]) =>
      spawnSync(process.execPath, [path.join(root, "node_modules/tsx/dist/cli.mjs"), path.join(root, "cli/index.ts"), "locate", "--cwe", "CWE-89", "--rules", "--offline", "--repo", dir, ...args], { encoding: "utf8" });
    const baseOut = out();
    assert.equal(cli("--output", baseOut).status, 0);
    const same = cli("--output", out(), "--baseline", baseOut, "--fail-on-findings");
    assert.equal(same.status, 0, same.stdout + same.stderr);
    assert.match(same.stdout, /0 new, 1 unchanged/);
    fs.writeFileSync(path.join(dir, "src/new.js"), NEW);
    const added = cli("--output", out(), "--baseline", baseOut, "--fail-on-findings");
    assert.equal(added.status, 1);
    assert.match(added.stdout, /\[new\] src\/new\.js/);
  });
});
