/**
 * Keyless unit: parse checked-in Secure L4 live-locate evidence (2026-09-24 PT).
 * Does not call RunPod, pull weights, or invent AUROC/File-F1/SLA figures.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  GPU_LIVE_LOCATE_EVIDENCE_KIND,
  loadGpuEvidence,
} from "../../src/desk/gpu-evidence.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const CASES = [
  {
    rel: "docs/reports/l4-live-locate-20260924.json",
    podId: "17dxif43j5rw2b",
    model: "fdtn-ai/antares-1b",
    startedAt: "2026-09-25T01:28:53Z",
    wall: 2.85,
    usd: 0.0233,
    formula: "2.85/60 × $0.49",
    sha: "aa60f8dbc11e05791ed5c1a0c8291181799f43cc943858ff0ee98a982897a9ea",
  },
  {
    rel: "docs/reports/l4-live-locate-350m-20260924.json",
    podId: "zbnj0j2pfcwqwd",
    model: "fdtn-ai/antares-350m",
    startedAt: "2026-09-25T01:31:51Z",
    wall: 1.83,
    usd: 0.0149,
    formula: "1.83/60 × $0.49",
    sha: "cd7f5f66f8b8b12b8c40e0f50d86145e05c5ac653d85feecc40b78493d744c15",
  },
] as const;

describe("l4 live locate evidence 2026-09-24 (keyless parse)", () => {
  for (const c of CASES) {
    it(`${c.rel} validates against gpu_live_locate_evidence/v1`, () => {
      const file = path.join(root, c.rel);
      assert.ok(fs.existsSync(file), `missing ${c.rel}`);
      const raw = fs.readFileSync(file, "utf8");
      assert.doesNotMatch(raw, /hf_[A-Za-z0-9]+|HUGGING_FACE_HUB_TOKEN|HF_TOKEN|sk-/);

      const loaded = loadGpuEvidence({ cwd: root, relativePath: c.rel });
      assert.equal(loaded.ok, true);
      assert.equal(loaded.startsRunPod, false);
      const e = loaded.evidence;

      assert.equal(e.kind, GPU_LIVE_LOCATE_EVIDENCE_KIND);
      assert.equal(e.measured, true);
      assert.equal(e.checked_in_cassette, false);
      assert.equal(e.ci_live_gpu, false);
      assert.match(e.label, /Live locate \(2026-09-24 PT\)/);

      assert.equal(e.pod.id, c.podId);
      assert.equal(e.pod.tier, "RunPod Secure Cloud");
      assert.equal(e.pod.gpu, "NVIDIA L4");
      assert.equal(e.pod.dataCenter, "EU-RO-1");
      assert.equal(e.pod.image, "vllm/vllm-openai:latest");
      assert.equal(e.pod.model, c.model);
      assert.equal(e.pod.maxModelLen, 8192);
      assert.equal(e.pod.rateUsdPerHourAtCreate, 0.49);

      assert.equal(e.timelineUtc.startedAt, c.startedAt);
      assert.equal(e.timelineUtc.wallStartToTerminateMinutesApprox, c.wall);
      assert.equal(e.spend.estimatedUsd, c.usd);
      assert.equal(e.spend.formula, c.formula);
      assert.equal(e.spend.billingApiSettled, false);
      assert.match(e.spend.label, /estimate/i);

      assert.equal(e.smoke.modelsGetHttp, 200);
      assert.equal(e.smoke.completionsPostHttp, 200);

      assert.equal(e.liveLocate.cwe, "CWE-89");
      assert.equal(e.liveLocate.repo, "fixtures/locate/demo-app");
      assert.equal(e.liveLocate.rankedFile, "src/users.js");
      assert.equal(e.liveLocate.rank, 1);
      assert.equal(e.liveLocate.findingCount, 1);
      assert.equal(e.liveLocate.incompleteReason, null);
      assert.equal(e.liveLocate.terminalCallsUsed, 1);
      assert.equal(e.liveLocate.toolBudget, 15);
      assert.equal(e.liveLocate.fullerLocateWithRealToolCalls, true);
      assert.equal(e.liveLocate.sarifResults, 1);
      assert.equal(e.liveLocate.sarifSha256, c.sha);
      assert.match(e.liveLocate.commandShape, /--remote-inference/);
      assert.match(e.liveLocate.commandShape, new RegExp(c.podId));

      assert.equal(e.posture.localizationOnly, true);
      assert.equal(e.posture.notExploitProof, true);
      assert.equal(e.posture.noPoC, true);
      assert.equal(e.posture.noAutoMerge, true);
      assert.equal(e.posture.needsHuman, true);

      assert.ok(e.non_claims.some((n) => /exploitability/i.test(n)));
      assert.ok(e.non_claims.some((n) => /AUROC|File-F1/i.test(n)));
      assert.ok(e.non_claims.some((n) => /SLA/i.test(n)));
      assert.ok(e.non_claims.some((n) => /keyless CI|cassette/i.test(n)));
    });
  }

  it("gpu-claims.md cites the 2026-09-24 L4 section with non-claims", () => {
    const doc = fs.readFileSync(path.join(root, "docs/gpu-claims.md"), "utf8");
    assert.match(doc, /## Live locate \(2026-09-24 PT\)/);
    assert.match(doc, /17dxif43j5rw2b/);
    assert.match(doc, /zbnj0j2pfcwqwd/);
    assert.match(doc, /l4-live-locate-20260924\.json/);
    assert.match(doc, /l4-live-locate-350m-20260924\.json/);
    assert.match(doc, /~\$0\.0233/);
    // Prior A40 sections stay intact.
    assert.match(doc, /## Live locate \(2026-09-19\/20 PT\)/);
    assert.match(doc, /## Live re-proof \(2026-09-19 PT\)/);
  });
});
