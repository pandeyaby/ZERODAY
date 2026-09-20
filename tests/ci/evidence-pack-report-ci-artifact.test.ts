/**
 * CI contract: evidence-pack must ship report.json + report.md (zeroday.report/v1).
 * Fail-closed assert-evidence-pack-report · reuse assert-report-ci-json · no RunPod / PoC.
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
const ASSERT = path.join(root, "scripts/assert-evidence-pack-report.mjs");
const PACK_ASSERT = path.join(root, "scripts/assert-evidence-pack-ci-json.mjs");
const LOCATE_WF = path.join(root, ".github/workflows/zeroday-locate.yml");
const REUSABLE_WF = path.join(root, ".github/workflows/stranger-verify.yml");

function sha256Hex(buf: Buffer | string): string {
  return createHash("sha256").update(buf).digest("hex");
}

function goodReport(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: "zeroday.report/v1",
    generated_at: "2026-09-20T00:00:00.000Z",
    sources: [
      {
        kind: "prove-doors",
        path: "fixtures/locate/report-sample/prove-doors.json",
        schemaVersion: "zeroday-prove-doors/v1",
        label: "prove-doors fixture",
      },
    ],
    findings: [
      {
        path: "src/search.js",
        rank: 1,
        score: 0.9,
        cweIds: ["CWE-89"],
        evidence: ["cassette ranked file"],
        source: "prove-doors",
      },
    ],
    disclaimers: [
      "Localization ≠ exploitability — ranked files / door outcomes are candidates for human review only.",
      "No PoC / exploit / payload content is emitted or implied.",
      "No auto-merge — open a normal reviewable PR if a fix is warranted.",
      "needs_human: true — always.",
      "No AUROC / File F1 / SLA invented by this report command.",
      "runpod: false — this command does not start RunPod or live GPU.",
    ],
    runpod: false,
    whatWasRun: {
      keyless: true,
      doorsLabel: "A + cassette",
      historicalGpu: false,
    },
    ...overrides,
  };
}

const GOOD_MD = `# ZERODAY localization summary

> **Localization only.** Not proof of exploitability. No PoC. No auto-merge. needs_human.

## Explicit non-claims

- Localization ≠ exploitability
- No PoC
- needs_human: true
- runpod: false — this command does not start RunPod
`;

function writeGoodPack(
  dir: string,
  opts?: {
    report?: Record<string, unknown>;
    reportMd?: string;
    omitReportFiles?: boolean;
    omitManifestReport?: boolean;
  },
): string {
  const prove = JSON.stringify({
    schemaVersion: "zeroday-prove-doors/v1",
    ok: true,
  });
  const gpu = JSON.stringify({
    schemaVersion: "zeroday-gpu-evidence/v1",
    ok: true,
    historical: true,
    startsRunPod: false,
  });
  const reportObj = opts?.report ?? goodReport();
  const report = JSON.stringify(reportObj);
  const reportMd = opts?.reportMd ?? GOOD_MD;

  fs.writeFileSync(path.join(dir, "prove-doors.json"), prove + "\n");
  fs.writeFileSync(path.join(dir, "gpu-evidence.json"), gpu + "\n");
  if (!opts?.omitReportFiles) {
    fs.writeFileSync(path.join(dir, "report.json"), report + "\n");
    fs.writeFileSync(path.join(dir, "report.md"), reportMd);
  }

  const files: { name: string; sha256: string }[] = [
    { name: "prove-doors.json", sha256: sha256Hex(prove + "\n") },
    { name: "gpu-evidence.json", sha256: sha256Hex(gpu + "\n") },
  ];
  if (!opts?.omitManifestReport && !opts?.omitReportFiles) {
    files.push(
      { name: "report.json", sha256: sha256Hex(report + "\n") },
      { name: "report.md", sha256: sha256Hex(reportMd) },
    );
  }

  const manifest = {
    schemaVersion: "zeroday.evidence_pack/v1",
    created_at: "2026-09-20T00:00:00.000Z",
    pack_version: "1",
    files,
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

function assertWorkflowPackReport(wf: string, label: string): void {
  assert.match(
    wf,
    /npm run --silent evidence-pack -- --json --out out\/evidence/,
    `${label}: must write evidence-pack --json --out out/evidence`,
  );
  assert.match(
    wf,
    /test -s out\/evidence\/report\.json/,
    `${label}: must fail-closed require out/evidence/report.json`,
  );
  assert.match(
    wf,
    /test -s out\/evidence\/report\.md/,
    `${label}: must fail-closed require out/evidence/report.md`,
  );
  assert.match(
    wf,
    /node scripts\/assert-evidence-pack-ci-json\.mjs out\/evidence/,
    `${label}: must run pack shape assert`,
  );
  assert.match(
    wf,
    /node scripts\/assert-evidence-pack-report\.mjs out\/evidence/,
    `${label}: must run pack report assert after evidence-pack`,
  );

  const packStepIdx = wf.indexOf("npm run --silent evidence-pack");
  assert.ok(packStepIdx >= 0, `${label}: missing evidence-pack step`);
  const afterPack = wf.slice(packStepIdx, packStepIdx + 1200);
  const reportAssertIdx = afterPack.indexOf(
    "node scripts/assert-evidence-pack-report.mjs out/evidence",
  );
  const packAssertIdx = afterPack.indexOf(
    "node scripts/assert-evidence-pack-ci-json.mjs out/evidence",
  );
  assert.ok(
    reportAssertIdx >= 0,
    `${label}: report assert missing near evidence-pack`,
  );
  assert.ok(packAssertIdx >= 0, `${label}: pack assert missing near evidence-pack`);
  assert.ok(
    reportAssertIdx > packAssertIdx,
    `${label}: assert-evidence-pack-report must run after pack assert`,
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
  assert.match(
    wf,
    /report\.json\/md|report \+ manifest|report\.json.*report\.md/i,
    `${label}: summary/upload must mention packed report`,
  );
  assert.doesNotMatch(
    afterPack,
    /--live-url|--endpoint|HF_TOKEN|create-pod/i,
    `${label}: evidence-pack block must stay keyless`,
  );
}

describe("evidence-pack report CI gate", () => {
  it("assert script exists and accepts #100 pack shape", () => {
    assert.ok(
      fs.existsSync(ASSERT),
      "missing scripts/assert-evidence-pack-report.mjs",
    );
    assert.ok(
      fs.existsSync(PACK_ASSERT),
      "missing scripts/assert-evidence-pack-ci-json.mjs",
    );

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ep-report-ci-"));
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
  });

  it("fail-closed: missing report files / bad schema / runpod / md non-claims", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ep-report-ci-bad-"));

    const missingFiles = path.join(tmp, "missing-files");
    fs.mkdirSync(missingFiles);
    writeGoodPack(missingFiles, {
      omitReportFiles: true,
      omitManifestReport: true,
    });
    const miss = spawnSync("node", [ASSERT, missingFiles], { encoding: "utf8" });
    assert.equal(
      miss.status,
      3,
      `missing report in manifest must exit 3:\n${miss.stderr}`,
    );

    const listedMissing = path.join(tmp, "listed-missing");
    fs.mkdirSync(listedMissing);
    writeGoodPack(listedMissing);
    fs.unlinkSync(path.join(listedMissing, "report.json"));
    const missFile = spawnSync("node", [ASSERT, listedMissing], {
      encoding: "utf8",
    });
    assert.equal(missFile.status, 3, "listed but absent report.json must exit 3");

    const badSchema = path.join(tmp, "bad-schema");
    fs.mkdirSync(badSchema);
    writeGoodPack(badSchema, {
      report: goodReport({ schemaVersion: "wrong/v0" }),
    });
    const failSchema = spawnSync("node", [ASSERT, badSchema], {
      encoding: "utf8",
    });
    assert.equal(failSchema.status, 5, "bad report schema must exit 5 (delegated)");

    const badPod = path.join(tmp, "bad-pod");
    fs.mkdirSync(badPod);
    writeGoodPack(badPod, { report: goodReport({ runpod: true }) });
    const failPod = spawnSync("node", [ASSERT, badPod], { encoding: "utf8" });
    assert.equal(failPod.status, 5, "runpod≠false must exit 5 (delegated)");

    const badMd = path.join(tmp, "bad-md");
    fs.mkdirSync(badMd);
    writeGoodPack(badMd, {
      reportMd: "# empty claims\n\nNo useful non-claims here.\n",
    });
    const failMd = spawnSync("node", [ASSERT, badMd], { encoding: "utf8" });
    assert.equal(failMd.status, 6, "weak report.md non-claims must exit 6");

    const badSha = path.join(tmp, "bad-sha");
    fs.mkdirSync(badSha);
    writeGoodPack(badSha);
    fs.writeFileSync(path.join(badSha, "report.md"), GOOD_MD + "\ntampered\n");
    const failSha = spawnSync("node", [ASSERT, badSha], { encoding: "utf8" });
    assert.equal(failSha.status, 4, "sha256 mismatch must exit 4");
  });

  it("locate + stranger-verify wire assert after evidence-pack", () => {
    assertWorkflowPackReport(
      fs.readFileSync(LOCATE_WF, "utf8"),
      "zeroday-locate.yml",
    );
    assertWorkflowPackReport(
      fs.readFileSync(REUSABLE_WF, "utf8"),
      "stranger-verify.yml",
    );
  });

  it("docs name pack report assert (historical; no RunPod)", () => {
    const trust = fs.readFileSync(path.join(root, "docs/ci-trust.md"), "utf8");
    const stranger = fs.readFileSync(
      path.join(root, "docs/stranger-verify.md"),
      "utf8",
    );
    assert.match(trust, /assert-evidence-pack-report/);
    assert.match(trust, /report\.json/);
    assert.match(trust, /does not start RunPod|historical/i);
    assert.match(stranger, /assert-evidence-pack-report/);
    assert.match(stranger, /report\.json/);
  });
});
