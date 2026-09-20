/**
 * CI contract: prove-doors --json → prove-doors.json artifact (mirror stranger-verify-json).
 * Keyless only · upload on success (no if: always()) · shared shape assert.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ASSERT = path.join(root, "scripts/assert-prove-doors-ci-json.mjs");
const LOCATE_WF = path.join(root, ".github/workflows/zeroday-locate.yml");
const REUSABLE_WF = path.join(root, ".github/workflows/stranger-verify.yml");

function assertWorkflowProveDoorsArtifact(wf: string, label: string): void {
  assert.match(
    wf,
    /npm run --silent prove-doors -- --json > prove-doors\.json/,
    `${label}: must redirect prove-doors --json to prove-doors.json`,
  );
  assert.match(
    wf,
    /node scripts\/assert-prove-doors-ci-json\.mjs prove-doors\.json/,
    `${label}: must run shared CI JSON shape assert`,
  );
  assert.match(
    wf,
    /name:\s*prove-doors-json/,
    `${label}: must upload artifact prove-doors-json`,
  );
  assert.match(
    wf,
    /path:\s*prove-doors\.json/,
    `${label}: upload path must be prove-doors.json`,
  );

  // Isolate the prove-doors upload step — success-only (match stranger-verify-json).
  const uploadIdx = wf.indexOf("Upload prove-doors JSON");
  assert.ok(uploadIdx >= 0, `${label}: missing Upload prove-doors JSON step`);
  const uploadTail = wf.slice(uploadIdx, uploadIdx + 400);
  assert.doesNotMatch(
    uploadTail,
    /if:\s*always\(\)/,
    `${label}: prove-doors-json upload must not use if: always() (fail-closed; match stranger-verify-json)`,
  );
  assert.match(uploadTail, /if-no-files-found:\s*error/);
  assert.doesNotMatch(
    uploadTail,
    /--live-url|--endpoint|HF_TOKEN|create-pod/i,
    `${label}: prove-doors upload block must stay keyless`,
  );
}

describe("prove-doors.json CI artifact contract", () => {
  it("assert script exists and accepts keyless CI shape", () => {
    assert.ok(fs.existsSync(ASSERT), "missing scripts/assert-prove-doors-ci-json.mjs");

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "prove-doors-ci-"));
    const good = path.join(tmp, "prove-doors.json");
    fs.writeFileSync(
      good,
      JSON.stringify({
        schemaVersion: "zeroday-prove-doors/v1",
        ok: true,
        doors: {
          a: { status: "ok" },
          cassette: { status: "ok" },
          b: { status: "skipped" },
          d: { status: "ok", schemaVersion: "zeroday-gpu-evidence/v1" },
        },
      }),
    );
    const ok = spawnSync("node", [ASSERT, good], { encoding: "utf8" });
    assert.equal(ok.status, 0, `good JSON failed:\n${ok.stderr}\n${ok.stdout}`);

    const bad = path.join(tmp, "bad.json");
    fs.writeFileSync(
      bad,
      JSON.stringify({
        schemaVersion: "zeroday-prove-doors/v1",
        ok: true,
        doors: {
          a: { status: "ok" },
          cassette: { status: "ok" },
          b: { status: "ok" },
          d: { status: "ok", schemaVersion: "zeroday-gpu-evidence/v1" },
        },
      }),
    );
    const fail = spawnSync("node", [ASSERT, bad], { encoding: "utf8" });
    assert.equal(fail.status, 6, "Door B not skipped must exit 6");

    const badD = path.join(tmp, "bad-d.json");
    fs.writeFileSync(
      badD,
      JSON.stringify({
        schemaVersion: "zeroday-prove-doors/v1",
        ok: true,
        doors: {
          a: { status: "ok" },
          cassette: { status: "ok" },
          b: { status: "skipped" },
          d: { status: "failed" },
        },
      }),
    );
    const failD = spawnSync("node", [ASSERT, badD], { encoding: "utf8" });
    assert.equal(failD.status, 7, "Door D not ok must exit 7");
  });

  it("locate + reusable stranger-verify upload prove-doors-json on success", () => {
    assertWorkflowProveDoorsArtifact(
      fs.readFileSync(LOCATE_WF, "utf8"),
      "zeroday-locate.yml",
    );
    assertWorkflowProveDoorsArtifact(
      fs.readFileSync(REUSABLE_WF, "utf8"),
      "stranger-verify.yml",
    );
  });

  it("docs name prove-doors-json artifact", () => {
    const stranger = fs.readFileSync(
      path.join(root, "docs/stranger-verify.md"),
      "utf8",
    );
    const trust = fs.readFileSync(path.join(root, "docs/ci-trust.md"), "utf8");
    assert.match(stranger, /prove-doors-json/);
    assert.match(trust, /prove-doors-json/);
  });
});
