/**
 * Workstation doctor (zeroday.doctor/v1) — happy path on repo checkout;
 * fail-closed when gpu-evidence / scripts / cassette injectably missing.
 * No RunPod / no network.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  DOCTOR_SCHEMA,
  DOCTOR_REQUIRED_SCRIPTS,
  runDoctor,
  formatDoctorBanner,
} from "../../src/doctor/index.ts";
import { GPU_EVIDENCE_REL } from "../../src/desk/gpu-evidence.ts";
import { RULES_CWE_89_CASSETTE } from "../../src/locate/record/index.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const cli = path.join(root, "cli/index.ts");

function runDoctorCli(
  args: string[],
  cwd = root,
  timeoutMs = 60_000,
): { status: number | null; stdout: string; stderr: string } {
  const r = spawnSync("npx", ["tsx", cli, "doctor", ...args], {
    cwd,
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

describe("workstation doctor (zeroday.doctor/v1)", () => {
  it("package.json exposes doctor → cli doctor", () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(root, "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };
    assert.ok(pkg.scripts.doctor, "missing npm run doctor");
    assert.match(pkg.scripts.doctor, /doctor/);
    for (const name of DOCTOR_REQUIRED_SCRIPTS) {
      assert.ok(pkg.scripts[name], `missing npm run ${name}`);
    }
  });

  it("happy path on repo checkout: all checks pass", () => {
    const result = runDoctor({ cwd: root });
    assert.equal(result.schemaVersion, DOCTOR_SCHEMA);
    assert.equal(result.ok, true);
    assert.equal(result.runpod, false);
    assert.equal(result.startsRunPod, false);
    assert.equal(result.networkRequired, false);
    const ids = result.checks.map((c) => c.id);
    assert.deepEqual(ids, [
      "node_runtime",
      "package_scripts",
      "gpu_evidence",
      "cassette_fixture",
      "prove_doors_entry",
      "no_live_gpu",
    ]);
    for (const c of result.checks) {
      assert.equal(c.ok, true, `${c.id}: ${c.detail}`);
    }
    assert.match(result.checks.find((c) => c.id === "gpu_evidence")!.detail, /historical|gpu-evidence/i);
    assert.match(
      result.checks.find((c) => c.id === "cassette_fixture")!.detail,
      /Cassette loads|cwe=/i,
    );
  });

  it("formatDoctorBanner shows PASS/FAIL and no-RunPod honesty", () => {
    const result = runDoctor({ cwd: root });
    const text = formatDoctorBanner(result);
    assert.match(text, /ZERODAY doctor/);
    assert.match(text, /\[PASS\] node_runtime/);
    assert.match(text, /runpod/i);
    assert.match(text, /no RunPod/i);
    assert.doesNotMatch(text, /Creating pod|runpod\.create|billing/i);
  });

  it("fail-closed when gpu-evidence path missing (injectable root)", () => {
    const result = runDoctor({
      cwd: root,
      gpuEvidencePath: "docs/reports/does-not-exist-gpu-evidence.json",
    });
    assert.equal(result.ok, false);
    assert.equal(result.runpod, false);
    const gpu = result.checks.find((c) => c.id === "gpu_evidence");
    assert.ok(gpu);
    assert.equal(gpu!.ok, false);
    assert.match(gpu!.detail, /missing|EVIDENCE_MISSING/i);
    // Other checks on real checkout still pass
    assert.equal(
      result.checks.find((c) => c.id === "node_runtime")!.ok,
      true,
    );
    assert.equal(
      result.checks.find((c) => c.id === "package_scripts")!.ok,
      true,
    );
  });

  it("fail-closed when package scripts stripped (injectable package.json)", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-doctor-"));
    try {
      const pkgPath = path.join(tmp, "package.json");
      fs.writeFileSync(
        pkgPath,
        JSON.stringify({ name: "x", scripts: { mvp: "echo hi" } }, null, 2),
      );
      const result = runDoctor({
        cwd: root,
        packageJsonPath: pkgPath,
      });
      assert.equal(result.ok, false);
      const scripts = result.checks.find((c) => c.id === "package_scripts");
      assert.ok(scripts);
      assert.equal(scripts!.ok, false);
      assert.match(scripts!.detail, /Missing package\.json scripts/);
      assert.match(scripts!.detail, /prove-doors/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("fail-closed when cassette path missing", () => {
    const result = runDoctor({
      cwd: root,
      cassettePath: "fixtures/locate/org-recordings/missing.cassette.json",
    });
    assert.equal(result.ok, false);
    const cas = result.checks.find((c) => c.id === "cassette_fixture");
    assert.ok(cas);
    assert.equal(cas!.ok, false);
    assert.match(cas!.detail, /missing/i);
  });

  it("CLI --json exits 0 with zeroday.doctor/v1 on checkout", () => {
    const r = runDoctorCli(["--json"]);
    assert.equal(r.status, 0, `stderr=${r.stderr}\nstdout=${r.stdout}`);
    const body = JSON.parse(r.stdout) as {
      ok: boolean;
      schemaVersion: string;
      runpod: boolean;
      startsRunPod: boolean;
      networkRequired: boolean;
      checks: Array<{ id: string; ok: boolean }>;
    };
    assert.equal(body.ok, true);
    assert.equal(body.schemaVersion, DOCTOR_SCHEMA);
    assert.equal(body.runpod, false);
    assert.equal(body.startsRunPod, false);
    assert.equal(body.networkRequired, false);
    assert.ok(body.checks.every((c) => c.ok));
  });

  it("CLI human summary exits 0 and lists PASS checks", () => {
    const r = runDoctorCli([]);
    assert.equal(r.status, 0, `stderr=${r.stderr}\nstdout=${r.stdout}`);
    assert.match(r.stdout, /ZERODAY doctor/);
    assert.match(r.stdout, /\[PASS\] node_runtime/);
    assert.match(r.stdout, /\[PASS\] gpu_evidence/);
    assert.match(r.stdout, /no RunPod/i);
    assert.doesNotMatch(r.stdout, /Creating pod|runpod\.create/i);
  });

  it("CLI --out writes doctor.json and exits 0", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-doctor-out-"));
    const out = path.join(tmp, "doctor.json");
    try {
      const r = runDoctorCli(["--json", "--out", out]);
      assert.equal(r.status, 0, `stderr=${r.stderr}\nstdout=${r.stdout}`);
      assert.ok(fs.existsSync(out));
      const written = JSON.parse(fs.readFileSync(out, "utf8")) as {
        schemaVersion: string;
        ok: boolean;
        runpod: boolean;
      };
      assert.equal(written.schemaVersion, DOCTOR_SCHEMA);
      assert.equal(written.ok, true);
      assert.equal(written.runpod, false);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("default cassette path matches cassette:replay pin", () => {
    assert.equal(
      RULES_CWE_89_CASSETTE.recording,
      "fixtures/locate/org-recordings/rules-cwe-89.cassette.json",
    );
    assert.ok(
      fs.existsSync(path.join(root, RULES_CWE_89_CASSETTE.recording)),
    );
    assert.ok(fs.existsSync(path.join(root, GPU_EVIDENCE_REL)));
  });
});
