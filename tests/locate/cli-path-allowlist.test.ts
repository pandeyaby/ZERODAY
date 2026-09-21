/**
 * CLI fail-closed read path allowlist — reuses assertAllowedReadPath (Desk #104).
 * Allows fixtures; rejects ../etc/passwd and absolute escape. No RunPod / no PoC.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const cli = path.join(root, "cli/index.ts");

const FIXTURE_PROVE = "fixtures/locate/report-sample/prove-doors.json";
const FIXTURE_SARIF = "fixtures/locate/ingest-sample/sample.sarif";
const FIXTURE_CASSETTE =
  "fixtures/locate/org-recordings/rules-cwe-89.cassette.json";

function runCli(
  args: string[],
  timeoutMs = 120_000,
): { status: number | null; stdout: string; stderr: string } {
  const r = spawnSync("npx", ["tsx", cli, ...args], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, FORCE_COLOR: "0" },
    timeout: timeoutMs,
  });
  return {
    status: r.status,
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? "",
  };
}

describe("CLI path allowlist (assertAllowedReadPath)", () => {
  it("report --from fixture exits 0", () => {
    const r = runCli(["report", "--from", FIXTURE_PROVE, "--json"]);
    assert.equal(r.status, 0, r.stderr || r.stdout);
    const json = JSON.parse(r.stdout) as { ok?: boolean; runpod?: boolean };
    assert.equal(json.runpod, false);
  });

  it("report --sarif fixture exits 0", () => {
    const r = runCli(["report", "--sarif", FIXTURE_SARIF, "--json"]);
    assert.equal(r.status, 0, r.stderr || r.stdout);
  });

  it("report rejects ../etc/passwd traversal (non-zero + PATH_POLICY)", () => {
    const r = runCli(["report", "--from", "../etc/passwd", "--json"]);
    assert.notEqual(r.status, 0);
    const json = JSON.parse(r.stdout) as {
      ok: boolean;
      code?: string;
      error?: string;
      runpod?: boolean;
    };
    assert.equal(json.ok, false);
    assert.equal(json.code, "PATH_POLICY");
    assert.equal(json.runpod, false);
    assert.match(String(json.error), /escapes sandbox/i);
  });

  it("report rejects absolute path outside repo", () => {
    const outside = path.join(os.tmpdir(), `zd-cli-escape-${Date.now()}.json`);
    fs.writeFileSync(outside, "{}" + "\n", "utf8");
    try {
      const r = runCli(["report", "--from", outside, "--json"]);
      assert.notEqual(r.status, 0);
      const json = JSON.parse(r.stdout) as { ok: boolean; code?: string };
      assert.equal(json.ok, false);
      assert.equal(json.code, "PATH_POLICY");
    } finally {
      fs.rmSync(outside, { force: true });
    }
  });

  it("evidence-pack --from absolute escape → PATH_POLICY", () => {
    const outside = path.join(os.tmpdir(), `zd-cli-ep-escape-${Date.now()}.json`);
    fs.writeFileSync(outside, "{}" + "\n", "utf8");
    const out = path.join(root, "out", `zd-cli-ep-${Date.now()}`);
    try {
      const r = runCli([
        "evidence-pack",
        "--json",
        "--out",
        out,
        "--from",
        outside,
      ]);
      assert.notEqual(r.status, 0);
      const json = JSON.parse(r.stdout) as { ok: boolean; code?: string };
      assert.equal(json.ok, false);
      assert.equal(json.code, "PATH_POLICY");
    } finally {
      fs.rmSync(outside, { force: true });
      fs.rmSync(out, { recursive: true, force: true });
    }
  });

  it("gpu-evidence --from ../etc/passwd → PATH_POLICY", () => {
    const r = runCli(["gpu-evidence", "--from", "../etc/passwd", "--json"]);
    assert.notEqual(r.status, 0);
    const json = JSON.parse(r.stdout) as { ok: boolean; code?: string };
    assert.equal(json.ok, false);
    assert.equal(json.code, "PATH_POLICY");
  });

  it("prove-doors --recording traversal → PATH_POLICY", () => {
    const r = runCli([
      "prove-doors",
      "--json",
      "--recording",
      "../etc/passwd",
    ]);
    assert.notEqual(r.status, 0);
    const json = JSON.parse(r.stdout) as {
      ok: boolean;
      code?: string;
      error?: string;
    };
    assert.equal(json.ok, false);
    assert.equal(json.code, "PATH_POLICY");
    assert.match(String(json.error), /escapes sandbox/i);
  });

  it("cassette:replay default fixture recording still works", () => {
    const r = runCli(["cassette:replay"], 180_000);
    assert.equal(r.status, 0, r.stderr || r.stdout);
  });

  it("cassette:replay rejects absolute escape", () => {
    const outside = path.join(
      os.tmpdir(),
      `zd-cli-cass-escape-${Date.now()}.json`,
    );
    fs.writeFileSync(outside, "{}" + "\n", "utf8");
    try {
      const r = runCli(["cassette:replay", "--recording", outside]);
      assert.notEqual(r.status, 0);
      assert.match(r.stderr, /PATH_POLICY|escapes sandbox/i);
    } finally {
      fs.rmSync(outside, { force: true });
    }
  });
});
