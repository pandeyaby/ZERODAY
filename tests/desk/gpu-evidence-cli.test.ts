/**
 * CLI gpu-evidence — valid fixture pass; missing/corrupt fail-closed.
 * Spawns `tsx cli/index.ts gpu-evidence` (same path as `npm run gpu-evidence`).
 * Historical evidence only — does not start RunPod.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  GPU_EVIDENCE_SCHEMA,
  GPU_EVIDENCE_REL,
  formatGpuEvidenceBanner,
  loadGpuEvidence,
} from "../../src/desk/gpu-evidence.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const cli = path.join(root, "cli/index.ts");

function runGpuEvidenceCli(
  args: string[],
  timeoutMs = 60_000,
): { status: number | null; stdout: string; stderr: string } {
  const r = spawnSync("npx", ["tsx", cli, "gpu-evidence", ...args], {
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

describe("CLI gpu-evidence", () => {
  it("package.json exposes gpu-evidence → cli gpu-evidence", () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(root, "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };
    assert.ok(pkg.scripts["gpu-evidence"], "missing npm run gpu-evidence");
    assert.match(pkg.scripts["gpu-evidence"], /gpu-evidence/);
  });

  it("valid checked-in fixture: --json exits 0 with zeroday-gpu-evidence/v1", () => {
    const r = runGpuEvidenceCli(["--json"]);
    assert.equal(r.status, 0, `stderr=${r.stderr}\nstdout=${r.stdout}`);
    const body = JSON.parse(r.stdout) as {
      ok: boolean;
      schemaVersion: string;
      source: string;
      historical: boolean;
      startsRunPod: boolean;
      evidence: { measured: boolean; pod: { gpu: string } };
    };
    assert.equal(body.ok, true);
    assert.equal(body.schemaVersion, GPU_EVIDENCE_SCHEMA);
    assert.equal(body.source, GPU_EVIDENCE_REL);
    assert.equal(body.historical, true);
    assert.equal(body.startsRunPod, false);
    assert.equal(body.evidence.measured, true);
    assert.equal(body.evidence.pod.gpu, "NVIDIA A40");
  });

  it("human summary (no --json) exits 0 and states historical / not live GPU", () => {
    const r = runGpuEvidenceCli([]);
    assert.equal(r.status, 0, `stderr=${r.stderr}\nstdout=${r.stdout}`);
    assert.match(r.stdout, /ZERODAY gpu-evidence/);
    assert.match(r.stdout, /historical/i);
    assert.match(r.stdout, /does not start RunPod/i);
    assert.match(r.stdout, /not live GPU/i);
  });

  it("formatGpuEvidenceBanner mirrors loader non-claims", () => {
    const loaded = loadGpuEvidence({ cwd: root });
    const banner = formatGpuEvidenceBanner(loaded);
    assert.match(banner, /historical/i);
    assert.match(banner, /startsRunPod: false/);
    assert.match(banner, /does not start RunPod/);
  });

  it("fail-closed: missing evidence --json exits non-zero", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zd-gpu-cli-missing-"));
    try {
      const missing = path.join(tmp, "no-such-evidence.json");
      const r = runGpuEvidenceCli(["--json", "--from", missing]);
      assert.notEqual(r.status, 0);
      const body = JSON.parse(r.stdout) as {
        ok: boolean;
        code?: string;
        schemaVersion: string;
        startsRunPod: boolean;
      };
      assert.equal(body.ok, false);
      assert.equal(body.code, "EVIDENCE_MISSING");
      assert.equal(body.schemaVersion, GPU_EVIDENCE_SCHEMA);
      assert.equal(body.startsRunPod, false);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("fail-closed: corrupt JSON --json exits non-zero", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zd-gpu-cli-corrupt-"));
    try {
      const bad = path.join(tmp, "broken.json");
      fs.writeFileSync(bad, "{not-json", "utf8");
      const r = runGpuEvidenceCli(["--json", "--from", bad]);
      assert.notEqual(r.status, 0);
      const body = JSON.parse(r.stdout) as {
        ok: boolean;
        code?: string;
        startsRunPod: boolean;
      };
      assert.equal(body.ok, false);
      assert.equal(body.code, "EVIDENCE_CORRUPT");
      assert.equal(body.startsRunPod, false);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("fail-closed: schema mismatch --from exits non-zero (human)", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zd-gpu-cli-schema-"));
    try {
      const bad = path.join(tmp, "bad-schema.json");
      fs.writeFileSync(bad, JSON.stringify({ kind: "wrong" }), "utf8");
      const r = runGpuEvidenceCli(["--from", bad]);
      assert.notEqual(r.status, 0);
      assert.match(r.stderr, /EVIDENCE_SCHEMA|gpu-evidence failed/);
      assert.match(r.stderr, /does not start RunPod|not live GPU/i);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
