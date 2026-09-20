/**
 * Door test: cassette:replay — offline org cassette + CI-stable assert.
 * Replay-only (no record). No GPU / RunPod / invented metrics.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import os from "node:os";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("cassette:replay door (Keyless K3)", () => {
  it("package.json exposes cassette:replay → cli cassette:replay", () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(root, "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };
    assert.ok(pkg.scripts["cassette:replay"], "missing npm run cassette:replay");
    assert.match(pkg.scripts["cassette:replay"], /cassette:replay/);
  });

  it("npm run cassette:replay exits 0 with pinned finding count + ranked file", () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-cassette-replay-"));
    const r = spawnSync(
      "npm",
      [
        "run",
        "cassette:replay",
        "--",
        "--output",
        out,
        "--expect-findings",
        "1",
        "--expect-file",
        "src/search.js",
        "--expect-cwe",
        "CWE-89",
      ],
      {
        cwd: root,
        encoding: "utf8",
        env: { ...process.env, FORCE_COLOR: "0" },
        timeout: 120_000,
      },
    );
    assert.equal(
      r.status,
      0,
      `cassette:replay failed (status=${r.status})\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`,
    );
    assert.match(r.stdout, /Assert OK/);
    assert.match(r.stdout, /findingCount\s*:\s*1/);
    assert.match(r.stdout, /src\/search\.js/);
    assert.match(r.stdout, /SARIF results\s*:\s*1/);
    assert.match(r.stdout, /replay-only|not run/i);
    assert.ok(fs.existsSync(path.join(out, "report.json")));
    assert.ok(fs.existsSync(path.join(out, "report.sarif")));

    const report = JSON.parse(
      fs.readFileSync(path.join(out, "report.json"), "utf8"),
    ) as { mode: string; summary: { findingCount: number } };
    assert.equal(report.mode, "recording");
    assert.equal(report.summary.findingCount, 1);
  });

  it("cassette:replay fails closed on wrong expect-file", () => {
    const out = fs.mkdtempSync(
      path.join(os.tmpdir(), "zeroday-cassette-replay-bad-"),
    );
    const r = spawnSync(
      "npm",
      [
        "run",
        "cassette:replay",
        "--",
        "--output",
        out,
        "--expect-file",
        "src/definitely-not-this.js",
      ],
      {
        cwd: root,
        encoding: "utf8",
        env: { ...process.env, FORCE_COLOR: "0" },
        timeout: 120_000,
      },
    );
    assert.notEqual(r.status, 0);
    const blob = `${r.stdout}\n${r.stderr}`;
    assert.match(blob, /rankedFile|assert/i);
  });
});
