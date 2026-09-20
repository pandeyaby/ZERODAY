/**
 * Desk GPU evidence — loader + GET /api/gpu-evidence fail-closed.
 * No RunPod / GPU spend. Cite only checked-in measured fields.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  GPU_EVIDENCE_REL,
  GPU_EVIDENCE_SCHEMA,
  GPU_LIVE_LOCATE_EVIDENCE_KIND,
  loadGpuEvidence,
  parseGpuLiveLocateEvidence,
  gpuEvidenceCatalog,
  GpuEvidenceError,
} from "../../src/desk/gpu-evidence.ts";
import { GET as gpuEvidenceGet } from "../../src/app/api/gpu-evidence/route.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("loadGpuEvidence (checked-in fixture)", () => {
  it("loads + validates docs/reports/a40-live-locate-20260920.json", () => {
    const result = loadGpuEvidence({ cwd: root });
    assert.equal(result.ok, true);
    assert.equal(result.schemaVersion, GPU_EVIDENCE_SCHEMA);
    assert.equal(result.source, GPU_EVIDENCE_REL);
    assert.equal(result.historical, true);
    assert.equal(result.startsRunPod, false);
    assert.equal(result.evidence.kind, GPU_LIVE_LOCATE_EVIDENCE_KIND);
    assert.equal(result.evidence.measured, true);
    assert.equal(result.evidence.pod.id, "1trf1rks3h40vs");
    assert.equal(result.evidence.pod.gpu, "NVIDIA A40");
    assert.equal(result.evidence.spend.estimatedUsd, 0.0245);
    assert.equal(result.evidence.liveLocate.rankedFile, "src/users.js");
    assert.equal(result.evidence.liveLocate.terminalCallsUsed, 1);
    assert.equal(result.evidence.liveLocate.sarifResults, 1);
    assert.ok(result.evidence.non_claims.some((c) => /AUROC|File-F1/i.test(c)));
    assert.equal(result.nonClaims.doesNotStartRunPod, true);
    assert.equal(result.nonClaims.notLiveProbe, true);
    assert.equal(result.nonClaims.notSla, true);
  });

  it("fail-closed when evidence file is missing", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zd-gpu-ev-missing-"));
    try {
      assert.throws(
        () =>
          loadGpuEvidence({
            cwd: tmp,
            relativePath: "docs/reports/a40-live-locate-20260920.json",
          }),
        (e: unknown) => {
          assert.ok(e instanceof GpuEvidenceError);
          assert.equal(e.code, "EVIDENCE_MISSING");
          return true;
        },
      );
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("fail-closed on corrupt JSON", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zd-gpu-ev-corrupt-"));
    try {
      const rel = "broken.json";
      fs.writeFileSync(path.join(tmp, rel), "{not-json", "utf8");
      assert.throws(
        () => loadGpuEvidence({ cwd: tmp, relativePath: rel }),
        (e: unknown) => {
          assert.ok(e instanceof GpuEvidenceError);
          assert.equal(e.code, "EVIDENCE_CORRUPT");
          return true;
        },
      );
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("fail-closed on bad schema (wrong kind / missing pod)", () => {
    assert.throws(
      () => parseGpuLiveLocateEvidence({ kind: "wrong", measured: true }),
      (e: unknown) => {
        assert.ok(e instanceof GpuEvidenceError);
        assert.equal(e.code, "EVIDENCE_SCHEMA");
        return true;
      },
    );

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zd-gpu-ev-schema-"));
    try {
      const rel = "bad-schema.json";
      fs.writeFileSync(
        path.join(tmp, rel),
        JSON.stringify({
          kind: GPU_LIVE_LOCATE_EVIDENCE_KIND,
          label: "x",
          session: "y",
          measured: true,
          checked_in_cassette: false,
          ci_live_gpu: false,
          // pod missing → schema fail
        }),
        "utf8",
      );
      assert.throws(
        () => loadGpuEvidence({ cwd: tmp, relativePath: rel }),
        (e: unknown) => {
          assert.ok(e instanceof GpuEvidenceError);
          assert.equal(e.code, "EVIDENCE_SCHEMA");
          return true;
        },
      );
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("catalog documents honesty + fail-closed", () => {
    const c = gpuEvidenceCatalog();
    assert.equal(c.endpoint, "GET /api/gpu-evidence");
    assert.equal(c.source, GPU_EVIDENCE_REL);
    assert.ok(c.honesty.some((h) => /does not start RunPod|no GPU spend/i.test(h)));
    assert.ok(c.honesty.some((h) => /AUROC|File-F1|SLA/i.test(h)));
    assert.ok(c.honesty.some((h) => /404|422|fail-closed/i.test(h)));
  });
});

describe("GET /api/gpu-evidence", () => {
  it("returns validated evidence JSON (startsRunPod: false)", async () => {
    const req = new Request("http://localhost/api/gpu-evidence");
    const res = await gpuEvidenceGet(req);
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      ok: boolean;
      schemaVersion: string;
      startsRunPod: boolean;
      historical: boolean;
      evidence: {
        pod: { id: string };
        spend: { estimatedUsd: number };
        liveLocate: {
          rankedFile: string;
          terminalCallsUsed: number;
          sarifResults: number;
        };
        non_claims: string[];
      };
    };
    assert.equal(body.ok, true);
    assert.equal(body.schemaVersion, GPU_EVIDENCE_SCHEMA);
    assert.equal(body.startsRunPod, false);
    assert.equal(body.historical, true);
    assert.equal(body.evidence.pod.id, "1trf1rks3h40vs");
    assert.equal(body.evidence.spend.estimatedUsd, 0.0245);
    assert.equal(body.evidence.liveLocate.rankedFile, "src/users.js");
    assert.equal(body.evidence.liveLocate.terminalCallsUsed, 1);
    assert.equal(body.evidence.liveLocate.sarifResults, 1);
    assert.ok(body.evidence.non_claims.length > 0);
  });

  it("catalog=1 returns honesty catalog without loading failure paths", async () => {
    const req = new Request("http://localhost/api/gpu-evidence?catalog=1");
    const res = await gpuEvidenceGet(req);
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      kind: string;
      endpoint: string;
      honesty: string[];
    };
    assert.equal(body.kind, "gpu-evidence-catalog");
    assert.equal(body.endpoint, "GET /api/gpu-evidence");
    assert.ok(body.honesty.some((h) => /RunPod/i.test(h)));
  });
});

describe("Prove doors Measured A40 evidence wiring", () => {
  it("panel loads GET /api/gpu-evidence + honest labels", () => {
    const prove = fs.readFileSync(
      path.join(root, "src/components/operator/prove-doors-panel.tsx"),
      "utf8",
    );
    const route = fs.readFileSync(
      path.join(root, "src/app/api/gpu-evidence/route.ts"),
      "utf8",
    );
    assert.match(prove, /data-testid="prove-doors-a40-evidence-card"/);
    assert.match(prove, /data-testid="prove-doors-a40-evidence-fields"/);
    assert.match(prove, /data-testid="prove-doors-a40-evidence-json"/);
    assert.match(prove, /prove-doors-a40-evidence-copy/);
    assert.match(prove, /\/api\/gpu-evidence/);
    assert.match(prove, /Measured A40 evidence/);
    assert.match(prove, /historical measured|Historical measured/i);
    assert.match(prove, /does not start RunPod/i);
    assert.match(prove, /not a live probe|not an SLA/i);
    assert.match(prove, /a40-live-locate-20260920\.json/);
    assert.match(prove, /pod id|est USD|ranked file|tool calls|SARIF/i);
    assert.doesNotMatch(prove, /create-pod|auto-provision|AUROC\s*=|File-F1\s*=/i);
    assert.match(route, /loadGpuEvidence/);
    assert.match(route, /EVIDENCE_MISSING/);
    assert.match(route, /EVIDENCE_SCHEMA|EVIDENCE_CORRUPT/);
    assert.match(route, /startsRunPod:\s*false/);
  });
});
