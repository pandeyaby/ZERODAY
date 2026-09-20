/**
 * Contract: zeroday evidence-pack builds out/evidence/ from existing doors.
 * Happy path → prove-doors.json + gpu-evidence.json + manifest.json.
 * Fail-closed when gpu-evidence missing/invalid. No RunPod.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  runEvidencePack,
  EvidencePackError,
  EVIDENCE_PACK_SCHEMA,
  EVIDENCE_PACK_VERSION,
  EVIDENCE_PACK_DEFAULT_OUT,
  EVIDENCE_PACK_PROVE_DOORS_FILE,
  EVIDENCE_PACK_GPU_EVIDENCE_FILE,
  EVIDENCE_PACK_MANIFEST_FILE,
} from "../../src/locate/evidence-pack.ts";
import { PROVE_DOORS_SCHEMA } from "../../src/desk/prove-doors.ts";
import { GPU_EVIDENCE_SCHEMA } from "../../src/desk/gpu-evidence.ts";
import { sha256Buffer } from "../../src/evidence/vault.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const cli = path.join(root, "cli/index.ts");

function runEvidencePackCli(
  args: string[],
  timeoutMs = 180_000,
): { status: number | null; stdout: string; stderr: string } {
  const r = spawnSync("npx", ["tsx", cli, "evidence-pack", ...args], {
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

describe("evidence-pack module + CLI", () => {
  it("package.json exposes evidence-pack → cli evidence-pack", () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(root, "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };
    assert.ok(pkg.scripts["evidence-pack"], "missing npm run evidence-pack");
    assert.match(pkg.scripts["evidence-pack"], /evidence-pack/);
  });

  it("happy path: writes three files with correct schemas + sha256", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zd-evidence-pack-ok-"));
    try {
      const out = path.join(tmp, "evidence");
      const result = await runEvidencePack({ out, cwd: root });
      assert.equal(result.ok, true);
      assert.equal(result.manifest.schemaVersion, EVIDENCE_PACK_SCHEMA);
      assert.equal(result.manifest.pack_version, EVIDENCE_PACK_VERSION);
      assert.equal(result.manifest.historicalGpuEvidenceOnly, true);
      assert.equal(result.manifest.startsRunPod, false);
      assert.ok(Array.isArray(result.manifest.notes));
      assert.ok(
        result.manifest.notes.some((n) => /historical/i.test(n) && /not live GPU/i.test(n)),
      );
      assert.ok(result.manifest.notes.some((n) => /does not start RunPod/i.test(n)));

      const provePath = path.join(out, EVIDENCE_PACK_PROVE_DOORS_FILE);
      const gpuPath = path.join(out, EVIDENCE_PACK_GPU_EVIDENCE_FILE);
      const manifestPath = path.join(out, EVIDENCE_PACK_MANIFEST_FILE);
      assert.ok(fs.existsSync(provePath));
      assert.ok(fs.existsSync(gpuPath));
      assert.ok(fs.existsSync(manifestPath));

      const prove = JSON.parse(fs.readFileSync(provePath, "utf8")) as {
        schemaVersion: string;
        ok: boolean;
      };
      const gpu = JSON.parse(fs.readFileSync(gpuPath, "utf8")) as {
        schemaVersion: string;
        ok: boolean;
        historical: boolean;
        startsRunPod: boolean;
      };
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
        schemaVersion: string;
        created_at: string;
        pack_version: string;
        files: Array<{ name: string; sha256: string }>;
        notes: string[];
        startsRunPod: boolean;
      };

      assert.equal(prove.schemaVersion, PROVE_DOORS_SCHEMA);
      assert.equal(prove.ok, true);
      assert.equal(gpu.schemaVersion, GPU_EVIDENCE_SCHEMA);
      assert.equal(gpu.ok, true);
      assert.equal(gpu.historical, true);
      assert.equal(gpu.startsRunPod, false);
      assert.equal(manifest.schemaVersion, EVIDENCE_PACK_SCHEMA);
      assert.equal(manifest.pack_version, EVIDENCE_PACK_VERSION);
      assert.match(manifest.created_at, /^\d{4}-\d{2}-\d{2}T/);
      assert.equal(manifest.startsRunPod, false);

      const byName = Object.fromEntries(manifest.files.map((f) => [f.name, f.sha256]));
      assert.equal(
        byName[EVIDENCE_PACK_PROVE_DOORS_FILE],
        sha256Buffer(fs.readFileSync(provePath)),
      );
      assert.equal(
        byName[EVIDENCE_PACK_GPU_EVIDENCE_FILE],
        sha256Buffer(fs.readFileSync(gpuPath)),
      );
      assert.equal(
        byName[EVIDENCE_PACK_PROVE_DOORS_FILE],
        createHash("sha256").update(fs.readFileSync(provePath)).digest("hex"),
      );
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("fail-closed: missing gpu-evidence --from does not claim ok", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zd-evidence-pack-miss-"));
    try {
      const out = path.join(tmp, "evidence");
      const missing = path.join(tmp, "no-such-gpu-evidence.json");
      await assert.rejects(
        () =>
          runEvidencePack({
            out,
            cwd: root,
            gpuEvidenceFrom: missing,
          }),
        (err: unknown) => {
          assert.ok(err instanceof EvidencePackError);
          assert.equal(err.code, "GPU_EVIDENCE_FAILED");
          assert.match(err.message, /EVIDENCE_MISSING|gpu-evidence failed/i);
          return true;
        },
      );
      assert.equal(fs.existsSync(path.join(out, EVIDENCE_PACK_MANIFEST_FILE)), false);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("fail-closed: corrupt gpu-evidence --from", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zd-evidence-pack-bad-"));
    try {
      const bad = path.join(tmp, "broken.json");
      fs.writeFileSync(bad, "{not-json", "utf8");
      const out = path.join(tmp, "evidence");
      await assert.rejects(
        () =>
          runEvidencePack({
            out,
            cwd: root,
            gpuEvidenceFrom: bad,
          }),
        (err: unknown) => {
          assert.ok(err instanceof EvidencePackError);
          assert.equal(err.code, "GPU_EVIDENCE_FAILED");
          assert.match(err.message, /EVIDENCE_CORRUPT|gpu-evidence failed/i);
          return true;
        },
      );
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("CLI: --json --out writes pack and prints manifest only", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zd-evidence-pack-cli-"));
    const out = path.join(tmp, "pack");
    try {
      const r = runEvidencePackCli(["--json", "--out", out]);
      assert.equal(
        r.status,
        0,
        `evidence-pack CLI failed (status=${r.status})\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`,
      );
      const manifest = JSON.parse(r.stdout) as {
        schemaVersion: string;
        ok: boolean;
        startsRunPod: boolean;
        files: Array<{ name: string; sha256: string }>;
      };
      assert.equal(manifest.schemaVersion, EVIDENCE_PACK_SCHEMA);
      assert.equal(manifest.ok, true);
      assert.equal(manifest.startsRunPod, false);
      assert.ok(fs.existsSync(path.join(out, EVIDENCE_PACK_PROVE_DOORS_FILE)));
      assert.ok(fs.existsSync(path.join(out, EVIDENCE_PACK_GPU_EVIDENCE_FILE)));
      assert.ok(fs.existsSync(path.join(out, EVIDENCE_PACK_MANIFEST_FILE)));
      assert.equal(manifest.files.length, 2);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("CLI: fail-closed --from missing exits non-zero", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zd-evidence-pack-cli-miss-"));
    try {
      const missing = path.join(tmp, "gone.json");
      const out = path.join(tmp, "pack");
      const r = runEvidencePackCli(["--json", "--out", out, "--from", missing]);
      assert.notEqual(r.status, 0);
      const body = JSON.parse(r.stdout) as {
        ok: boolean;
        schemaVersion: string;
        startsRunPod: boolean;
        code?: string;
      };
      assert.equal(body.ok, false);
      assert.equal(body.schemaVersion, EVIDENCE_PACK_SCHEMA);
      assert.equal(body.startsRunPod, false);
      assert.equal(body.code, "GPU_EVIDENCE_FAILED");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("default out dir constant is out/evidence", () => {
    assert.equal(EVIDENCE_PACK_DEFAULT_OUT, "out/evidence");
  });
});
