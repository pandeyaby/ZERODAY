/**
 * CI contract: doctor --json --out out/doctor.json artifact (mirror gpu-evidence).
 * Fail-closed local workstation readiness · no RunPod / live GPU / network.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ASSERT = path.join(root, "scripts/assert-doctor-ci-json.mjs");
const LOCATE_WF = path.join(root, ".github/workflows/zeroday-locate.yml");
const REUSABLE_WF = path.join(root, ".github/workflows/stranger-verify.yml");

function goodDoctor(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: "zeroday.doctor/v1",
    ok: true,
    checks: [
      { id: "node_runtime", ok: true, detail: "Node v22 usable (>=20)" },
      { id: "package_scripts", ok: true, detail: "Key doors present" },
      { id: "no_live_gpu", ok: true, detail: "runpod=false" },
    ],
    runpod: false,
    startsRunPod: false,
    networkRequired: false,
    ...overrides,
  };
}

function assertWorkflowDoctor(wf: string, label: string): void {
  assert.match(
    wf,
    /npm run --silent doctor -- --json --out out\/doctor\.json/,
    `${label}: must write doctor --json --out out/doctor.json`,
  );
  assert.doesNotMatch(
    wf,
    /doctor -- --json > out\/doctor\.json/,
    `${label}: must not redirect doctor stdout (use --out)`,
  );
  assert.match(
    wf,
    /node scripts\/assert-doctor-ci-json\.mjs out\/doctor\.json/,
    `${label}: must run shared CI JSON shape assert`,
  );
  assert.match(
    wf,
    /name:\s*doctor/,
    `${label}: must upload artifact doctor`,
  );
  assert.match(
    wf,
    /path:\s*out\/doctor\.json/,
    `${label}: upload path must be out/doctor.json`,
  );

  const uploadIdx = wf.indexOf("Upload doctor JSON");
  assert.ok(uploadIdx >= 0, `${label}: missing Upload doctor JSON step`);
  const uploadTail = wf.slice(uploadIdx, uploadIdx + 400);
  assert.doesNotMatch(
    uploadTail,
    /if:\s*always\(\)/,
    `${label}: doctor upload must not use if: always() (fail-closed)`,
  );
  assert.match(uploadTail, /if-no-files-found:\s*error/);
  assert.doesNotMatch(
    uploadTail,
    /--live-url|--endpoint|HF_TOKEN|create-pod/i,
    `${label}: doctor upload block must stay keyless`,
  );

  assert.match(
    wf,
    /no RunPod|no live GPU|workstation readiness/i,
    `${label}: must document no-RunPod / workstation readiness posture`,
  );
}

describe("doctor.json CI artifact contract", () => {
  it("assert script exists and accepts keyless CI shape", () => {
    assert.ok(fs.existsSync(ASSERT), "missing scripts/assert-doctor-ci-json.mjs");

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "doctor-ci-"));
    const good = path.join(tmp, "doctor.json");
    fs.writeFileSync(good, JSON.stringify(goodDoctor()));
    const ok = spawnSync("node", [ASSERT, good], { encoding: "utf8" });
    assert.equal(ok.status, 0, `good JSON failed:\n${ok.stderr}\n${ok.stdout}`);

    const badSchema = path.join(tmp, "bad-schema.json");
    fs.writeFileSync(
      badSchema,
      JSON.stringify(goodDoctor({ schemaVersion: "wrong/v0" })),
    );
    const failSchema = spawnSync("node", [ASSERT, badSchema], {
      encoding: "utf8",
    });
    assert.equal(failSchema.status, 2, "bad schema must exit 2");

    const badOk = path.join(tmp, "bad-ok.json");
    fs.writeFileSync(badOk, JSON.stringify(goodDoctor({ ok: false })));
    const failOk = spawnSync("node", [ASSERT, badOk], { encoding: "utf8" });
    assert.equal(failOk.status, 3, "ok≠true must exit 3");

    const badChecks = path.join(tmp, "bad-checks.json");
    fs.writeFileSync(badChecks, JSON.stringify(goodDoctor({ checks: [] })));
    const failChecks = spawnSync("node", [ASSERT, badChecks], {
      encoding: "utf8",
    });
    assert.equal(failChecks.status, 4, "empty checks[] must exit 4");

    const badCheckOk = path.join(tmp, "bad-check-ok.json");
    fs.writeFileSync(
      badCheckOk,
      JSON.stringify(
        goodDoctor({
          checks: [
            { id: "node_runtime", ok: false, detail: "too old" },
          ],
        }),
      ),
    );
    const failCheckOk = spawnSync("node", [ASSERT, badCheckOk], {
      encoding: "utf8",
    });
    assert.equal(failCheckOk.status, 4, "checks[].ok≠true must exit 4");

    const badPod = path.join(tmp, "bad-pod.json");
    fs.writeFileSync(badPod, JSON.stringify(goodDoctor({ runpod: true })));
    const failPod = spawnSync("node", [ASSERT, badPod], { encoding: "utf8" });
    assert.equal(failPod.status, 5, "runpod≠false must exit 5");

    const badStarts = path.join(tmp, "bad-starts.json");
    fs.writeFileSync(
      badStarts,
      JSON.stringify(goodDoctor({ startsRunPod: true })),
    );
    const failStarts = spawnSync("node", [ASSERT, badStarts], {
      encoding: "utf8",
    });
    assert.equal(failStarts.status, 6, "startsRunPod≠false must exit 6");

    const badNet = path.join(tmp, "bad-net.json");
    fs.writeFileSync(
      badNet,
      JSON.stringify(goodDoctor({ networkRequired: true })),
    );
    const failNet = spawnSync("node", [ASSERT, badNet], { encoding: "utf8" });
    assert.equal(failNet.status, 7, "networkRequired≠false must exit 7");
  });

  it("locate + reusable stranger-verify run doctor --json --out", () => {
    assertWorkflowDoctor(
      fs.readFileSync(LOCATE_WF, "utf8"),
      "zeroday-locate.yml",
    );
    assertWorkflowDoctor(
      fs.readFileSync(REUSABLE_WF, "utf8"),
      "stranger-verify.yml",
    );
  });

  it("docs name doctor CI validation (no RunPod)", () => {
    const trust = fs.readFileSync(path.join(root, "docs/ci-trust.md"), "utf8");
    const stranger = fs.readFileSync(
      path.join(root, "docs/stranger-verify.md"),
      "utf8",
    );
    assert.match(trust, /doctor/);
    assert.match(trust, /out\/doctor\.json|zeroday\.doctor\/v1/);
    assert.match(trust, /does not start RunPod|no RunPod/i);
    assert.match(stranger, /doctor/);
    assert.match(stranger, /out\/doctor\.json/);
  });
});
