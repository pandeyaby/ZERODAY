/**
 * CI contract: evidence-pack --json --out out/evidence artifact (mirror gpu-evidence).
 * Fail-closed design-partner pack · historical Measured A40 only · no RunPod.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ASSERT = path.join(root, "scripts/assert-evidence-pack-ci-json.mjs");
const LOCATE_WF = path.join(root, ".github/workflows/zeroday-locate.yml");
const REUSABLE_WF = path.join(root, ".github/workflows/stranger-verify.yml");

function sha256Hex(buf: Buffer | string): string {
  return createHash("sha256").update(buf).digest("hex");
}

function writeGoodPack(dir: string): string {
  const prove = JSON.stringify({ schemaVersion: "zeroday-prove-doors/v1", ok: true });
  const gpu = JSON.stringify({
    schemaVersion: "zeroday-gpu-evidence/v1",
    ok: true,
    historical: true,
    startsRunPod: false,
  });
  fs.writeFileSync(path.join(dir, "prove-doors.json"), prove + "\n");
  fs.writeFileSync(path.join(dir, "gpu-evidence.json"), gpu + "\n");
  const manifest = {
    schemaVersion: "zeroday.evidence_pack/v1",
    created_at: "2026-09-20T00:00:00.000Z",
    pack_version: "1",
    files: [
      { name: "prove-doors.json", sha256: sha256Hex(prove + "\n") },
      { name: "gpu-evidence.json", sha256: sha256Hex(gpu + "\n") },
    ],
    notes: ["gpu-evidence is historical Measured A40 only — not live GPU"],
    ok: true,
    outDir: dir,
    historicalGpuEvidenceOnly: true,
    startsRunPod: false,
  };
  fs.writeFileSync(
    path.join(dir, "manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );
  return dir;
}

function assertWorkflowEvidencePack(wf: string, label: string): void {
  assert.match(
    wf,
    /npm run --silent evidence-pack -- --json --out out\/evidence/,
    `${label}: must write evidence-pack --json --out out/evidence`,
  );
  assert.doesNotMatch(
    wf,
    /evidence-pack -- --json > /,
    `${label}: must not redirect evidence-pack stdout (use --out)`,
  );
  assert.match(
    wf,
    /node scripts\/assert-evidence-pack-ci-json\.mjs out\/evidence/,
    `${label}: must run shared CI JSON shape assert`,
  );
  assert.match(
    wf,
    /name:\s*evidence-pack/,
    `${label}: must upload artifact evidence-pack`,
  );
  assert.match(
    wf,
    /path:\s*out\/evidence\//,
    `${label}: upload path must be out/evidence/`,
  );

  const uploadIdx = wf.indexOf("Upload evidence-pack");
  assert.ok(uploadIdx >= 0, `${label}: missing Upload evidence-pack step`);
  const uploadTail = wf.slice(uploadIdx, uploadIdx + 400);
  assert.doesNotMatch(
    uploadTail,
    /if:\s*always\(\)/,
    `${label}: evidence-pack upload must not use if: always() (fail-closed)`,
  );
  assert.match(uploadTail, /if-no-files-found:\s*error/);
  assert.doesNotMatch(
    uploadTail,
    /--live-url|--endpoint|HF_TOKEN|create-pod/i,
    `${label}: evidence-pack upload block must stay keyless`,
  );

  assert.match(
    wf,
    /does not start RunPod|historical Measured A40|design-partner pack/i,
    `${label}: must document historical / no-RunPod posture`,
  );
}

describe("evidence-pack CI artifact contract", () => {
  it("package.json exposes evidence-pack → cli evidence-pack", () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(root, "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };
    assert.ok(pkg.scripts["evidence-pack"], "missing npm run evidence-pack");
    assert.match(pkg.scripts["evidence-pack"], /evidence-pack/);
  });

  it("assert script exists and accepts keyless CI shape", () => {
    assert.ok(
      fs.existsSync(ASSERT),
      "missing scripts/assert-evidence-pack-ci-json.mjs",
    );

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "evidence-pack-ci-"));
    const goodDir = path.join(tmp, "good");
    fs.mkdirSync(goodDir);
    writeGoodPack(goodDir);
    const ok = spawnSync("node", [ASSERT, goodDir], { encoding: "utf8" });
    assert.equal(ok.status, 0, `good pack failed:\n${ok.stderr}\n${ok.stdout}`);

    const viaManifest = spawnSync(
      "node",
      [ASSERT, path.join(goodDir, "manifest.json")],
      { encoding: "utf8" },
    );
    assert.equal(viaManifest.status, 0, "manifest.json path should resolve outDir");

    const badSchema = path.join(tmp, "bad-schema");
    fs.mkdirSync(badSchema);
    writeGoodPack(badSchema);
    const man = JSON.parse(
      fs.readFileSync(path.join(badSchema, "manifest.json"), "utf8"),
    );
    man.schemaVersion = "wrong/v0";
    fs.writeFileSync(
      path.join(badSchema, "manifest.json"),
      JSON.stringify(man, null, 2) + "\n",
    );
    const failSchema = spawnSync("node", [ASSERT, badSchema], {
      encoding: "utf8",
    });
    assert.equal(failSchema.status, 2, "bad schema must exit 2");

    const badOk = path.join(tmp, "bad-ok");
    fs.mkdirSync(badOk);
    writeGoodPack(badOk);
    const manOk = JSON.parse(
      fs.readFileSync(path.join(badOk, "manifest.json"), "utf8"),
    );
    manOk.ok = false;
    fs.writeFileSync(
      path.join(badOk, "manifest.json"),
      JSON.stringify(manOk, null, 2) + "\n",
    );
    const failOk = spawnSync("node", [ASSERT, badOk], { encoding: "utf8" });
    assert.equal(failOk.status, 3, "ok≠true must exit 3");

    const badHist = path.join(tmp, "bad-hist");
    fs.mkdirSync(badHist);
    writeGoodPack(badHist);
    const manHist = JSON.parse(
      fs.readFileSync(path.join(badHist, "manifest.json"), "utf8"),
    );
    manHist.historicalGpuEvidenceOnly = false;
    fs.writeFileSync(
      path.join(badHist, "manifest.json"),
      JSON.stringify(manHist, null, 2) + "\n",
    );
    const failHist = spawnSync("node", [ASSERT, badHist], { encoding: "utf8" });
    assert.equal(failHist.status, 4, "historicalGpuEvidenceOnly≠true must exit 4");

    const badPod = path.join(tmp, "bad-pod");
    fs.mkdirSync(badPod);
    writeGoodPack(badPod);
    const manPod = JSON.parse(
      fs.readFileSync(path.join(badPod, "manifest.json"), "utf8"),
    );
    manPod.startsRunPod = true;
    fs.writeFileSync(
      path.join(badPod, "manifest.json"),
      JSON.stringify(manPod, null, 2) + "\n",
    );
    const failPod = spawnSync("node", [ASSERT, badPod], { encoding: "utf8" });
    assert.equal(failPod.status, 5, "startsRunPod≠false must exit 5");

    const badSha = path.join(tmp, "bad-sha");
    fs.mkdirSync(badSha);
    writeGoodPack(badSha);
    fs.writeFileSync(path.join(badSha, "prove-doors.json"), '{"tampered":true}\n');
    const failSha = spawnSync("node", [ASSERT, badSha], { encoding: "utf8" });
    assert.equal(failSha.status, 6, "sha256 mismatch must exit 6");

    const missing = path.join(tmp, "missing-gpu");
    fs.mkdirSync(missing);
    writeGoodPack(missing);
    fs.unlinkSync(path.join(missing, "gpu-evidence.json"));
    const failMissing = spawnSync("node", [ASSERT, missing], {
      encoding: "utf8",
    });
    assert.equal(failMissing.status, 6, "missing file must exit 6");
  });

  it("locate + reusable stranger-verify run evidence-pack --json --out", () => {
    assertWorkflowEvidencePack(
      fs.readFileSync(LOCATE_WF, "utf8"),
      "zeroday-locate.yml",
    );
    assertWorkflowEvidencePack(
      fs.readFileSync(REUSABLE_WF, "utf8"),
      "stranger-verify.yml",
    );
  });

  it("docs name evidence-pack CI validation (historical; no RunPod)", () => {
    const trust = fs.readFileSync(path.join(root, "docs/ci-trust.md"), "utf8");
    const stranger = fs.readFileSync(
      path.join(root, "docs/stranger-verify.md"),
      "utf8",
    );
    assert.match(trust, /evidence-pack/);
    assert.match(trust, /does not start RunPod|historical/i);
    assert.match(stranger, /evidence-pack/);
    assert.match(stranger, /out\/evidence|evidence-pack/);
  });
});
