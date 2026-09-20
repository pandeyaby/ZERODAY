/**
 * Keyless unit: parse checked-in A40 live-locate evidence JSON.
 * Does not call RunPod, pull weights, or invent AUROC/File-F1/SLA figures.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const EVIDENCE_KIND = "zeroday.gpu_live_locate_evidence/v1" as const;
const EVIDENCE_REL = "docs/reports/a40-live-locate-20260920.json";

interface A40LiveLocateEvidence {
  kind: string;
  label: string;
  measured: boolean;
  checked_in_cassette: boolean;
  ci_live_gpu: boolean;
  pod: {
    id: string;
    tier: string;
    gpu: string;
    dataCenter: string;
    image: string;
    model: string;
    maxModelLen: number;
    rateUsdPerHourAtCreate: number;
  };
  timelineUtc: {
    startedAt: string;
    modelsGet200Approx: string;
    locateFinishedApprox: string;
    terminateDeletePod204Approx: string;
    wallStartToTerminateMinutesApprox: number;
  };
  spend: {
    estimatedUsd: number;
    formula: string;
    billingApiSettled: boolean;
    label: string;
  };
  smoke: {
    modelsGetHttp: number;
    completionsPostHttp: number;
  };
  liveLocate: {
    rankedFile: string;
    rank: number;
    findingCount: number;
    incompleteReason: null;
    terminalCallsUsed: number;
    toolBudget: number;
    fullerLocateWithRealToolCalls: boolean;
    sarifResults: number;
    sarifSha256: string;
    commandShape: string;
  };
  posture: {
    localizationOnly: boolean;
    notExploitProof: boolean;
    noPoC: boolean;
    noAutoMerge: boolean;
    needsHuman: boolean;
  };
  non_claims: string[];
}

describe("a40 live locate evidence (keyless parse)", () => {
  it("checked-in evidence JSON parses and matches measured facts only", () => {
    const file = path.join(root, EVIDENCE_REL);
    assert.ok(fs.existsSync(file), `missing ${EVIDENCE_REL}`);
    const raw = fs.readFileSync(file, "utf8");
    assert.doesNotMatch(raw, /hf_[A-Za-z0-9]+|HUGGING_FACE_HUB_TOKEN|sk-/);
    const evidence = JSON.parse(raw) as A40LiveLocateEvidence;

    assert.equal(evidence.kind, EVIDENCE_KIND);
    assert.equal(evidence.measured, true);
    assert.equal(evidence.checked_in_cassette, false);
    assert.equal(evidence.ci_live_gpu, false);
    assert.match(evidence.label, /Live locate \(2026-09-19\/20 PT\)/);

    assert.equal(evidence.pod.id, "1trf1rks3h40vs");
    assert.equal(evidence.pod.tier, "RunPod Secure Cloud");
    assert.equal(evidence.pod.gpu, "NVIDIA A40");
    assert.equal(evidence.pod.dataCenter, "EU-RO-1");
    assert.equal(evidence.pod.image, "vllm/vllm-openai:latest");
    assert.equal(evidence.pod.model, "fdtn-ai/antares-1b");
    assert.equal(evidence.pod.maxModelLen, 8192);
    assert.equal(evidence.pod.rateUsdPerHourAtCreate, 0.49);

    assert.equal(evidence.timelineUtc.startedAt, "2026-09-20T02:21:56Z");
    assert.equal(evidence.timelineUtc.modelsGet200Approx, "2026-09-20T02:24:18Z");
    assert.equal(
      evidence.timelineUtc.locateFinishedApprox,
      "2026-09-20T02:24:48Z",
    );
    assert.equal(
      evidence.timelineUtc.terminateDeletePod204Approx,
      "2026-09-20T02:24:56Z",
    );
    assert.equal(evidence.timelineUtc.wallStartToTerminateMinutesApprox, 3.0);

    assert.equal(evidence.spend.estimatedUsd, 0.0245);
    assert.equal(evidence.spend.formula, "3.0/60 × $0.49");
    assert.equal(evidence.spend.billingApiSettled, false);
    assert.match(evidence.spend.label, /estimate/i);

    assert.equal(evidence.smoke.modelsGetHttp, 200);
    assert.equal(evidence.smoke.completionsPostHttp, 200);

    assert.equal(evidence.liveLocate.rankedFile, "src/users.js");
    assert.equal(evidence.liveLocate.rank, 1);
    assert.equal(evidence.liveLocate.findingCount, 1);
    assert.equal(evidence.liveLocate.incompleteReason, null);
    assert.equal(evidence.liveLocate.terminalCallsUsed, 1);
    assert.equal(evidence.liveLocate.toolBudget, 15);
    assert.equal(evidence.liveLocate.fullerLocateWithRealToolCalls, true);
    assert.equal(evidence.liveLocate.sarifResults, 1);
    assert.equal(
      evidence.liveLocate.sarifSha256,
      "b600e95f17720974ca9206abcc69aa30ec54cc2933a3259a02150b8b2cf9997e",
    );
    assert.match(evidence.liveLocate.commandShape, /--remote-inference/);
    assert.match(evidence.liveLocate.commandShape, /1trf1rks3h40vs/);

    assert.equal(evidence.posture.localizationOnly, true);
    assert.equal(evidence.posture.notExploitProof, true);
    assert.equal(evidence.posture.noPoC, true);
    assert.equal(evidence.posture.noAutoMerge, true);
    assert.equal(evidence.posture.needsHuman, true);

    assert.ok(evidence.non_claims.some((c) => /exploitability/i.test(c)));
    assert.ok(evidence.non_claims.some((c) => /AUROC|File-F1/i.test(c)));
    assert.ok(evidence.non_claims.some((c) => /SLA/i.test(c)));
    assert.ok(evidence.non_claims.some((c) => /keyless CI|cassette/i.test(c)));
  });

  it("gpu-claims.md keeps prior smoke and adds fuller live locate section", () => {
    const doc = fs.readFileSync(path.join(root, "docs/gpu-claims.md"), "utf8");
    assert.match(doc, /## Live re-proof \(2026-09-19 PT\)/);
    assert.match(doc, /d65ny3xqf7bwza/);
    assert.match(doc, /## Live locate \(2026-09-19\/20 PT\)/);
    assert.match(doc, /1trf1rks3h40vs/);
    assert.match(doc, /fuller locate with real tool-calls/i);
    assert.match(doc, /a40-live-locate-20260920\.json/);
    assert.match(doc, /~\$0\.0245/);
    assert.match(doc, /terminalCallsUsed/);
    assert.match(doc, /Not.*AUROC|not AUROC/i);
    assert.match(doc, /keyless.*CI|CI.*keyless/i);
    assert.match(doc, /Localization ≠ exploitability|localization ≠ exploitability/i);
  });

  it("antares doctor print-only cites evidence JSON (no spend)", () => {
    const script = path.join(root, "scripts/runpod-vllm-antares.sh");
    const bash = spawnSync("bash", [script, "--print-only"], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, CI: "true" },
    });
    assert.equal(bash.status, 0, bash.stderr || bash.stdout);
    assert.match(bash.stdout, /a40-live-locate-20260920\.json/);
    assert.match(bash.stdout, /gpu-claims\.md/);
    assert.match(bash.stdout, /Live locate \(2026-09-19\/20 PT\)/);
    assert.doesNotMatch(bash.stdout, /Creating pod|runpod\.create/i);

    const cli = spawnSync(
      "npx",
      ["tsx", "cli/index.ts", "antares", "doctor"],
      {
        cwd: root,
        encoding: "utf8",
        env: { ...process.env, CI: "true" },
      },
    );
    assert.equal(cli.status, 0, cli.stderr || cli.stdout);
    assert.match(cli.stdout, /a40-live-locate-20260920\.json/);
    assert.match(cli.stdout, /gpu-claims\.md/);
    assert.match(cli.stdout, /localization ≠ exploitability|not AUROC/i);
  });
});
