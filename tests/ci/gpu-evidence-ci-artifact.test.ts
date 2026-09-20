/**
 * CI contract: npm run gpu-evidence -- --json in stranger-verify jobs.
 * Fail-closed historical Measured A40 evidence · no RunPod / live GPU.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ASSERT = path.join(root, "scripts/assert-gpu-evidence-ci-json.mjs");
const LOCATE_WF = path.join(root, ".github/workflows/zeroday-locate.yml");
const REUSABLE_WF = path.join(root, ".github/workflows/stranger-verify.yml");

function assertWorkflowGpuEvidence(wf: string, label: string): void {
  assert.match(
    wf,
    /npm run --silent gpu-evidence -- --json > gpu-evidence\.json/,
    `${label}: must run gpu-evidence --json → gpu-evidence.json`,
  );
  assert.match(
    wf,
    /gpu-evidence/,
    `${label}: must mention gpu-evidence`,
  );
  assert.match(
    wf,
    /--json/,
    `${label}: must include --json`,
  );
  assert.match(
    wf,
    /node scripts\/assert-gpu-evidence-ci-json\.mjs gpu-evidence\.json/,
    `${label}: must run shared CI JSON shape assert`,
  );
  assert.match(
    wf,
    /name:\s*gpu-evidence-json/,
    `${label}: must upload artifact gpu-evidence-json`,
  );
  assert.match(
    wf,
    /path:\s*gpu-evidence\.json/,
    `${label}: upload path must be gpu-evidence.json`,
  );

  const uploadIdx = wf.indexOf("Upload gpu-evidence JSON");
  assert.ok(uploadIdx >= 0, `${label}: missing Upload gpu-evidence JSON step`);
  const uploadTail = wf.slice(uploadIdx, uploadIdx + 400);
  assert.doesNotMatch(
    uploadTail,
    /if:\s*always\(\)/,
    `${label}: gpu-evidence-json upload must not use if: always() (fail-closed)`,
  );
  assert.match(uploadTail, /if-no-files-found:\s*error/);
  assert.doesNotMatch(
    uploadTail,
    /--live-url|--endpoint|HF_TOKEN|create-pod/i,
    `${label}: gpu-evidence upload block must stay keyless`,
  );

  // Step comment / summary must stay honest: historical only, no RunPod.
  assert.match(
    wf,
    /does not start RunPod|historical Measured A40/i,
    `${label}: must document historical / no-RunPod posture`,
  );
}

describe("gpu-evidence.json CI artifact contract", () => {
  it("assert script exists and accepts keyless CI shape", () => {
    assert.ok(fs.existsSync(ASSERT), "missing scripts/assert-gpu-evidence-ci-json.mjs");

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gpu-evidence-ci-"));
    const good = path.join(tmp, "gpu-evidence.json");
    fs.writeFileSync(
      good,
      JSON.stringify({
        schemaVersion: "zeroday-gpu-evidence/v1",
        ok: true,
        historical: true,
        startsRunPod: false,
        source: "docs/reports/a40-live-locate-20260920.json",
      }),
    );
    const ok = spawnSync("node", [ASSERT, good], { encoding: "utf8" });
    assert.equal(ok.status, 0, `good JSON failed:\n${ok.stderr}\n${ok.stdout}`);

    const badSchema = path.join(tmp, "bad-schema.json");
    fs.writeFileSync(
      badSchema,
      JSON.stringify({
        schemaVersion: "wrong/v0",
        ok: true,
        historical: true,
        startsRunPod: false,
      }),
    );
    const failSchema = spawnSync("node", [ASSERT, badSchema], {
      encoding: "utf8",
    });
    assert.equal(failSchema.status, 2, "bad schema must exit 2");

    const badOk = path.join(tmp, "bad-ok.json");
    fs.writeFileSync(
      badOk,
      JSON.stringify({
        schemaVersion: "zeroday-gpu-evidence/v1",
        ok: false,
        historical: true,
        startsRunPod: false,
      }),
    );
    const failOk = spawnSync("node", [ASSERT, badOk], { encoding: "utf8" });
    assert.equal(failOk.status, 3, "ok≠true must exit 3");

    const badHist = path.join(tmp, "bad-hist.json");
    fs.writeFileSync(
      badHist,
      JSON.stringify({
        schemaVersion: "zeroday-gpu-evidence/v1",
        ok: true,
        historical: false,
        startsRunPod: false,
      }),
    );
    const failHist = spawnSync("node", [ASSERT, badHist], { encoding: "utf8" });
    assert.equal(failHist.status, 4, "historical≠true must exit 4");

    const badPod = path.join(tmp, "bad-pod.json");
    fs.writeFileSync(
      badPod,
      JSON.stringify({
        schemaVersion: "zeroday-gpu-evidence/v1",
        ok: true,
        historical: true,
        startsRunPod: true,
      }),
    );
    const failPod = spawnSync("node", [ASSERT, badPod], { encoding: "utf8" });
    assert.equal(failPod.status, 5, "startsRunPod≠false must exit 5");
  });

  it("locate + reusable stranger-verify run gpu-evidence --json", () => {
    assertWorkflowGpuEvidence(
      fs.readFileSync(LOCATE_WF, "utf8"),
      "zeroday-locate.yml",
    );
    assertWorkflowGpuEvidence(
      fs.readFileSync(REUSABLE_WF, "utf8"),
      "stranger-verify.yml",
    );
  });

  it("docs name gpu-evidence CI validation (historical; no RunPod)", () => {
    const trust = fs.readFileSync(path.join(root, "docs/ci-trust.md"), "utf8");
    const gpu = fs.readFileSync(path.join(root, "docs/gpu-claims.md"), "utf8");
    assert.match(trust, /gpu-evidence/);
    assert.match(trust, /does not start RunPod|historical/i);
    assert.match(gpu, /gpu-evidence/);
    assert.match(
      gpu,
      /CI validates historical evidence|does not start RunPod/i,
    );
  });
});
