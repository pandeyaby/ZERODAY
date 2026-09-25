/**
 * Desk evidence-pack — POST /api/evidence-pack fail-closed.
 * Reuses runEvidencePack. Historical gpu-evidence only — no RunPod.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  EVIDENCE_PACK_DEFAULT_OUT,
  EVIDENCE_PACK_GPU_EVIDENCE_FILE,
  EVIDENCE_PACK_MANIFEST_FILE,
  EVIDENCE_PACK_PROVE_DOORS_FILE,
  EVIDENCE_PACK_REPORT_JSON_FILE,
  EVIDENCE_PACK_REPORT_MD_FILE,
  EVIDENCE_PACK_SCHEMA,
  evidencePackCatalog,
} from "../../src/locate/evidence-pack.ts";
import {
  GET as evidencePackGet,
  POST as evidencePackPost,
} from "../../src/app/api/evidence-pack/route.ts";
import { GPU_EVIDENCE_SCHEMA } from "../../src/desk/gpu-evidence.ts";
import { PROVE_DOORS_SCHEMA } from "../../src/desk/prove-doors.ts";
import { REPORT_SCHEMA } from "../../src/locate/report-summary.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("evidencePackCatalog", () => {
  it("documents POST /api/evidence-pack + honesty (no RunPod)", () => {
    const c = evidencePackCatalog();
    assert.equal(c.endpoint, "POST /api/evidence-pack");
    assert.equal(c.schemaVersion, EVIDENCE_PACK_SCHEMA);
    assert.equal(c.defaultOut, EVIDENCE_PACK_DEFAULT_OUT);
    assert.ok(c.files.includes(EVIDENCE_PACK_MANIFEST_FILE));
    assert.ok(c.files.includes(EVIDENCE_PACK_PROVE_DOORS_FILE));
    assert.ok(c.files.includes(EVIDENCE_PACK_GPU_EVIDENCE_FILE));
    assert.ok(c.files.includes(EVIDENCE_PACK_REPORT_JSON_FILE));
    assert.ok(c.files.includes(EVIDENCE_PACK_REPORT_MD_FILE));
    assert.ok(c.honesty.some((h) => /does not start RunPod|no GPU spend/i.test(h)));
    assert.ok(c.honesty.some((h) => /Fail-closed|fail-closed/i.test(h)));
    assert.ok(c.honesty.some((h) => /runProveDoors|loadGpuEvidence/i.test(h)));
    assert.ok(c.honesty.some((h) => /runReport/i.test(h)));
    assert.ok(
      c.honesty.some((h) => /Desk body top|parseReportTop|omit/i.test(h)),
    );
  });
});

describe("GET/POST /api/evidence-pack", () => {
  it("GET returns catalog without building a pack", async () => {
    const res = await evidencePackGet();
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      kind: string;
      endpoint: string;
      honesty: string[];
    };
    assert.equal(body.kind, "evidence-pack-catalog");
    assert.equal(body.endpoint, "POST /api/evidence-pack");
    assert.ok(body.honesty.some((h) => /RunPod/i.test(h)));
  });

  it("POST builds pack JSON (CLI out/evidence file names · startsRunPod false)", async () => {
    const req = new Request("http://localhost/api/evidence-pack", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const res = await evidencePackPost(req);
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      ok: boolean;
      schemaVersion: string;
      startsRunPod: boolean;
      historicalGpuEvidenceOnly: boolean;
      defaultOut: string;
      files: Record<string, { schemaVersion?: string; ok?: boolean; startsRunPod?: boolean } | string>;
      manifest: {
        schemaVersion: string;
        outDir: string;
        startsRunPod: boolean;
        files: Array<{ name: string; sha256: string }>;
      };
      proveDoors: { schemaVersion: string; ok: boolean };
      gpuEvidence: {
        schemaVersion: string;
        ok: boolean;
        historical: boolean;
        startsRunPod: boolean;
      };
      report?: { schemaVersion: string; runpod: boolean };
      reportMarkdown?: string;
    };
    assert.equal(body.ok, true);
    assert.equal(body.schemaVersion, EVIDENCE_PACK_SCHEMA);
    assert.equal(body.startsRunPod, false);
    assert.equal(body.historicalGpuEvidenceOnly, true);
    assert.equal(body.defaultOut, "out/evidence");
    assert.ok(body.files[EVIDENCE_PACK_MANIFEST_FILE]);
    assert.ok(body.files[EVIDENCE_PACK_PROVE_DOORS_FILE]);
    assert.ok(body.files[EVIDENCE_PACK_GPU_EVIDENCE_FILE]);
    assert.ok(body.files[EVIDENCE_PACK_REPORT_JSON_FILE]);
    assert.equal(typeof body.files[EVIDENCE_PACK_REPORT_MD_FILE], "string");
    assert.equal(body.manifest.schemaVersion, EVIDENCE_PACK_SCHEMA);
    assert.equal(body.manifest.outDir, "out/evidence");
    assert.equal(body.manifest.startsRunPod, false);
    assert.equal(body.proveDoors.schemaVersion, PROVE_DOORS_SCHEMA);
    assert.equal(body.proveDoors.ok, true);
    assert.equal(body.gpuEvidence.schemaVersion, GPU_EVIDENCE_SCHEMA);
    assert.equal(body.gpuEvidence.ok, true);
    assert.equal(body.gpuEvidence.historical, true);
    assert.equal(body.gpuEvidence.startsRunPod, false);
    assert.equal(
      (body.files[EVIDENCE_PACK_PROVE_DOORS_FILE] as { schemaVersion?: string } | undefined)?.schemaVersion,
      PROVE_DOORS_SCHEMA,
    );
    assert.equal(
      (body.files[EVIDENCE_PACK_GPU_EVIDENCE_FILE] as { startsRunPod?: boolean } | undefined)?.startsRunPod,
      false,
    );
    const reportFile = body.files[EVIDENCE_PACK_REPORT_JSON_FILE] as {
      schemaVersion?: string;
      runpod?: boolean;
    };
    assert.equal(reportFile.schemaVersion, REPORT_SCHEMA);
    assert.equal(reportFile.runpod, false);
    assert.match(String(body.files[EVIDENCE_PACK_REPORT_MD_FILE]), /localization/i);
    assert.match(String(body.files[EVIDENCE_PACK_REPORT_MD_FILE]), /exploitability/i);
    assert.ok(
      body.manifest.files.some((f) => f.name === EVIDENCE_PACK_REPORT_JSON_FILE),
    );
    assert.ok(
      body.manifest.files.some((f) => f.name === EVIDENCE_PACK_REPORT_MD_FILE),
    );
  });

  it("POST refuses secret / provision fields", async () => {
    const req = new Request("http://localhost/api/evidence-pack", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runpodApiKey: "x" }),
    });
    const res = await evidencePackPost(req);
    assert.equal(res.status, 403);
    const body = (await res.json()) as {
      ok: boolean;
      code?: string;
      startsRunPod: boolean;
    };
    assert.equal(body.ok, false);
    assert.equal(body.code, "SECRET_FIELD_REFUSED");
    assert.equal(body.startsRunPod, false);
  });

  it("POST fail-closed on missing gpu-evidence --from", async () => {
    const missing = path.join(root, "no-such-gpu-evidence-for-desk-api.json");
    const req = new Request("http://localhost/api/evidence-pack", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gpuEvidenceFrom: missing }),
    });
    const res = await evidencePackPost(req);
    assert.equal(res.status, 422);
    const body = (await res.json()) as {
      ok: boolean;
      code?: string;
      startsRunPod: boolean;
      historicalGpuEvidenceOnly: boolean;
    };
    assert.equal(body.ok, false);
    assert.equal(body.code, "GPU_EVIDENCE_FAILED");
    assert.equal(body.startsRunPod, false);
    assert.equal(body.historicalGpuEvidenceOnly, true);
  });

  it("POST omit top → full packed report (no top/truncated)", async () => {
    const req = new Request("http://localhost/api/evidence-pack", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const res = await evidencePackPost(req);
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      ok: boolean;
      startsRunPod: boolean;
      report: {
        findings: unknown[];
        top?: number;
        truncated?: boolean;
        runpod: boolean;
      };
      files: Record<string, unknown>;
    };
    assert.equal(body.ok, true);
    assert.equal(body.startsRunPod, false);
    assert.equal(body.report.runpod, false);
    assert.equal(body.report.top, undefined);
    assert.equal(body.report.truncated, undefined);
    assert.ok(Array.isArray(body.report.findings));
    const reportFile = body.files[EVIDENCE_PACK_REPORT_JSON_FILE] as {
      top?: number;
      truncated?: boolean;
      findings: unknown[];
    };
    assert.equal(reportFile.top, undefined);
    assert.equal(reportFile.truncated, undefined);
    assert.equal(reportFile.findings.length, body.report.findings.length);
  });

  it("POST top=1 truncates packed report (same as CLI --top)", async () => {
    const fullReq = new Request("http://localhost/api/evidence-pack", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const fullRes = await evidencePackPost(fullReq);
    assert.equal(fullRes.status, 200);
    const full = (await fullRes.json()) as {
      report: { findings: Array<{ path?: string }>; top?: number };
    };

    const req = new Request("http://localhost/api/evidence-pack", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ top: 1 }),
    });
    const res = await evidencePackPost(req);
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      ok: boolean;
      startsRunPod: boolean;
      report: {
        findings: Array<{ path?: string }>;
        top?: number;
        truncated?: boolean;
        runpod: boolean;
      };
      reportMarkdown?: string;
      files: Record<string, unknown>;
    };
    assert.equal(body.ok, true);
    assert.equal(body.startsRunPod, false);
    assert.equal(body.report.runpod, false);
    assert.equal(body.report.top, 1);
    assert.equal(body.report.truncated, full.report.findings.length > 1);
    assert.ok(body.report.findings.length <= 1);
    if (full.report.findings.length > 0) {
      assert.equal(body.report.findings[0]?.path, full.report.findings[0]?.path);
    }
    const reportFile = body.files[EVIDENCE_PACK_REPORT_JSON_FILE] as {
      findings: unknown[];
      top?: number;
      truncated?: boolean;
    };
    assert.equal(reportFile.top, 1);
    assert.equal(reportFile.truncated, full.report.findings.length > 1);
    assert.ok(reportFile.findings.length <= 1);
    assert.ok(
      typeof body.reportMarkdown === "string" &&
        /Showing top 1/i.test(body.reportMarkdown),
    );
  });

  it("POST invalid top fail-closed 400 INPUT_INVALID", async () => {
    for (const bad of [0, -1, 1.5, "abc", "", "1e2"]) {
      const req = new Request("http://localhost/api/evidence-pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ top: bad }),
      });
      const res = await evidencePackPost(req);
      assert.equal(
        res.status,
        400,
        `expected 400 for top=${JSON.stringify(bad)}`,
      );
      const body = (await res.json()) as {
        ok: boolean;
        code?: string;
        error?: string;
        startsRunPod: boolean;
        historicalGpuEvidenceOnly: boolean;
      };
      assert.equal(body.ok, false);
      assert.equal(body.code, "INPUT_INVALID");
      assert.equal(body.startsRunPod, false);
      assert.equal(body.historicalGpuEvidenceOnly, true);
      assert.match(String(body.error), /top/i);
    }
  });
});

describe("Prove doors evidence-pack wiring", () => {
  it("panel + route call runEvidencePack (no RunPod / no reimplement)", () => {
    const prove = fs.readFileSync(
      path.join(root, "src/components/operator/prove-doors-panel.tsx"),
      "utf8",
    );
    const route = fs.readFileSync(
      path.join(root, "src/app/api/evidence-pack/route.ts"),
      "utf8",
    );
    assert.match(prove, /data-testid="prove-doors-evidence-pack-card"/);
    assert.match(prove, /data-testid="prove-doors-evidence-pack-run"/);
    assert.match(prove, /data-testid="prove-doors-evidence-pack-download"/);
    assert.match(prove, /data-testid="prove-doors-evidence-pack-top"/);
    assert.match(prove, /\/api\/evidence-pack/);
    assert.match(prove, /downloadEvidencePackFiles/);
    assert.match(prove, /does not start RunPod/i);
    assert.match(prove, /out\/evidence/);
    assert.match(prove, /body\.top|packTop|topRaw/);
    assert.doesNotMatch(prove, /create-pod|auto-provision|AUROC\s*=/i);
    assert.match(route, /runEvidencePack/);
    assert.match(route, /EvidencePackError/);
    assert.match(route, /parseReportTop/);
    assert.match(route, /INPUT_INVALID/);
    assert.match(route, /startsRunPod:\s*false/);
    assert.match(route, /historicalGpuEvidenceOnly:\s*true/);
    assert.doesNotMatch(route, /create-pod|runpod\.com|auto-provision/i);
    assert.doesNotMatch(route, /runProveDoors\s*\(|loadGpuEvidence\s*\(/);
    // Must reuse CLI truncate helper — not fork ranking.
    assert.doesNotMatch(route, /findings\.slice\(/);
  });
});
