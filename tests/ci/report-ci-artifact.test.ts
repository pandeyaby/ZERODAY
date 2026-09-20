/**
 * CI contract: report --json --out out/report.json artifact (mirror doctor / evidence-pack).
 * Fail-closed CISO localization summary · fixture prove-doors · no RunPod / PoC.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ASSERT = path.join(root, "scripts/assert-report-ci-json.mjs");
const LOCATE_WF = path.join(root, ".github/workflows/zeroday-locate.yml");
const REUSABLE_WF = path.join(root, ".github/workflows/stranger-verify.yml");
const FIXTURE = path.join(
  root,
  "fixtures/locate/report-sample/prove-doors.json",
);

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

function assertWorkflowReport(wf: string, label: string): void {
  assert.match(
    wf,
    /npm run --silent report -- --from fixtures\/locate\/report-sample\/prove-doors\.json --json --out out\/report\.json/,
    `${label}: must write report --json --out out/report.json from prove-doors fixture`,
  );
  assert.match(
    wf,
    /npm run --silent report -- --from fixtures\/locate\/report-sample\/prove-doors\.json --out out\/report\.md/,
    `${label}: must also write report --out out/report.md`,
  );
  assert.doesNotMatch(
    wf,
    /report -- --json > out\/report\.json/,
    `${label}: must not redirect report stdout (use --out)`,
  );
  assert.match(
    wf,
    /node scripts\/assert-report-ci-json\.mjs out\/report\.json/,
    `${label}: must run shared CI JSON shape assert`,
  );
  assert.match(
    wf,
    /name:\s*report/,
    `${label}: must upload artifact report`,
  );
  assert.match(
    wf,
    /out\/report\.json/,
    `${label}: upload path must include out/report.json`,
  );
  assert.match(
    wf,
    /out\/report\.md/,
    `${label}: upload path must include out/report.md`,
  );

  const uploadIdx = wf.indexOf("Upload report");
  assert.ok(uploadIdx >= 0, `${label}: missing Upload report step`);
  const uploadTail = wf.slice(uploadIdx, uploadIdx + 500);
  assert.doesNotMatch(
    uploadTail,
    /if:\s*always\(\)/,
    `${label}: report upload must not use if: always() (fail-closed)`,
  );
  assert.match(uploadTail, /if-no-files-found:\s*error/);
  assert.doesNotMatch(
    uploadTail,
    /--live-url|--endpoint|HF_TOKEN|create-pod/i,
    `${label}: report upload block must stay keyless`,
  );

  assert.match(
    wf,
    /CISO localization summary|localization summary|no PoC/i,
    `${label}: must document localization / no-PoC posture`,
  );
  assert.match(
    wf,
    /does not start RunPod|no RunPod/i,
    `${label}: must document no-RunPod posture`,
  );
}

describe("report.json CI artifact contract", () => {
  it("package.json exposes report → cli report", () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(root, "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };
    assert.ok(pkg.scripts["report"], "missing npm run report");
    assert.match(pkg.scripts["report"], /report/);
  });

  it("assert script exists and accepts keyless CI shape", () => {
    assert.ok(fs.existsSync(ASSERT), "missing scripts/assert-report-ci-json.mjs");

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "report-ci-"));
    const good = path.join(tmp, "report.json");
    fs.writeFileSync(good, JSON.stringify(goodReport()));
    const ok = spawnSync("node", [ASSERT, good], { encoding: "utf8" });
    assert.equal(ok.status, 0, `good JSON failed:\n${ok.stderr}\n${ok.stdout}`);

    const badSchema = path.join(tmp, "bad-schema.json");
    fs.writeFileSync(
      badSchema,
      JSON.stringify(goodReport({ schemaVersion: "wrong/v0" })),
    );
    const failSchema = spawnSync("node", [ASSERT, badSchema], {
      encoding: "utf8",
    });
    assert.equal(failSchema.status, 2, "bad schema must exit 2");

    const badOk = path.join(tmp, "bad-ok.json");
    fs.writeFileSync(
      badOk,
      JSON.stringify(goodReport({ ok: false, error: "boom" })),
    );
    const failOk = spawnSync("node", [ASSERT, badOk], { encoding: "utf8" });
    assert.equal(failOk.status, 3, "ok=false error envelope must exit 3");

    const badSources = path.join(tmp, "bad-sources.json");
    fs.writeFileSync(badSources, JSON.stringify(goodReport({ sources: [] })));
    const failSources = spawnSync("node", [ASSERT, badSources], {
      encoding: "utf8",
    });
    assert.equal(failSources.status, 4, "empty sources[] must exit 4");

    const badFindings = path.join(tmp, "bad-findings.json");
    fs.writeFileSync(
      badFindings,
      JSON.stringify(goodReport({ findings: [{ path: "", evidence: [], source: "x" }] })),
    );
    const failFindings = spawnSync("node", [ASSERT, badFindings], {
      encoding: "utf8",
    });
    assert.equal(failFindings.status, 5, "empty finding path must exit 5");

    const badDisc = path.join(tmp, "bad-disc.json");
    fs.writeFileSync(
      badDisc,
      JSON.stringify(goodReport({ disclaimers: ["something vague"] })),
    );
    const failDisc = spawnSync("node", [ASSERT, badDisc], { encoding: "utf8" });
    assert.equal(failDisc.status, 6, "missing localization disclaimer must exit 6");

    const badPod = path.join(tmp, "bad-pod.json");
    fs.writeFileSync(badPod, JSON.stringify(goodReport({ runpod: true })));
    const failPod = spawnSync("node", [ASSERT, badPod], { encoding: "utf8" });
    assert.equal(failPod.status, 7, "runpod≠false must exit 7");

    const badWhat = path.join(tmp, "bad-what.json");
    fs.writeFileSync(
      badWhat,
      JSON.stringify(goodReport({ whatWasRun: { keyless: "yes" } })),
    );
    const failWhat = spawnSync("node", [ASSERT, badWhat], { encoding: "utf8" });
    assert.equal(failWhat.status, 8, "whatWasRun.keyless≠boolean must exit 8");
  });

  it("assert accepts real CLI output from prove-doors fixture", () => {
    assert.ok(fs.existsSync(FIXTURE), "missing report-sample prove-doors fixture");
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "report-ci-live-"));
    const outJson = path.join(tmp, "report.json");
    const r = spawnSync(
      "npx",
      [
        "tsx",
        path.join(root, "cli/index.ts"),
        "report",
        "--from",
        FIXTURE,
        "--json",
        "--out",
        outJson,
      ],
      { cwd: root, encoding: "utf8", env: process.env },
    );
    assert.equal(r.status, 0, `report CLI failed:\n${r.stderr}\n${r.stdout}`);
    assert.ok(fs.existsSync(outJson) && fs.statSync(outJson).size > 0);
    const assertR = spawnSync("node", [ASSERT, outJson], { encoding: "utf8" });
    assert.equal(
      assertR.status,
      0,
      `assert on real CLI output failed:\n${assertR.stderr}\n${assertR.stdout}`,
    );
  });

  it("locate + reusable stranger-verify run report --json --out", () => {
    assertWorkflowReport(
      fs.readFileSync(LOCATE_WF, "utf8"),
      "zeroday-locate.yml",
    );
    assertWorkflowReport(
      fs.readFileSync(REUSABLE_WF, "utf8"),
      "stranger-verify.yml",
    );
  });

  it("docs name report CI validation (localization; no RunPod)", () => {
    const trust = fs.readFileSync(path.join(root, "docs/ci-trust.md"), "utf8");
    const stranger = fs.readFileSync(
      path.join(root, "docs/stranger-verify.md"),
      "utf8",
    );
    assert.match(trust, /report/);
    assert.match(trust, /out\/report\.json|zeroday\.report\/v1/);
    assert.match(trust, /does not start RunPod|no RunPod/i);
    assert.match(stranger, /report/);
    assert.match(stranger, /out\/report\.json/);
  });
});
