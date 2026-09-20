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
  EVIDENCE_PACK_SCHEMA,
  evidencePackCatalog,
} from "../../src/locate/evidence-pack.ts";
import {
  GET as evidencePackGet,
  POST as evidencePackPost,
} from "../../src/app/api/evidence-pack/route.ts";
import { GPU_EVIDENCE_SCHEMA } from "../../src/desk/gpu-evidence.ts";
import { PROVE_DOORS_SCHEMA } from "../../src/desk/prove-doors.ts";

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
    assert.ok(c.honesty.some((h) => /does not start RunPod|no GPU spend/i.test(h)));
    assert.ok(c.honesty.some((h) => /Fail-closed|fail-closed/i.test(h)));
    assert.ok(c.honesty.some((h) => /runProveDoors|loadGpuEvidence/i.test(h)));
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
      files: Record<string, { schemaVersion?: string; ok?: boolean; startsRunPod?: boolean }>;
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
    };
    assert.equal(body.ok, true);
    assert.equal(body.schemaVersion, EVIDENCE_PACK_SCHEMA);
    assert.equal(body.startsRunPod, false);
    assert.equal(body.historicalGpuEvidenceOnly, true);
    assert.equal(body.defaultOut, "out/evidence");
    assert.ok(body.files[EVIDENCE_PACK_MANIFEST_FILE]);
    assert.ok(body.files[EVIDENCE_PACK_PROVE_DOORS_FILE]);
    assert.ok(body.files[EVIDENCE_PACK_GPU_EVIDENCE_FILE]);
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
      body.files[EVIDENCE_PACK_PROVE_DOORS_FILE]?.schemaVersion,
      PROVE_DOORS_SCHEMA,
    );
    assert.equal(
      body.files[EVIDENCE_PACK_GPU_EVIDENCE_FILE]?.startsRunPod,
      false,
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
    assert.match(prove, /\/api\/evidence-pack/);
    assert.match(prove, /downloadEvidencePackFiles/);
    assert.match(prove, /does not start RunPod/i);
    assert.match(prove, /out\/evidence/);
    assert.doesNotMatch(prove, /create-pod|auto-provision|AUROC\s*=/i);
    assert.match(route, /runEvidencePack/);
    assert.match(route, /EvidencePackError/);
    assert.match(route, /startsRunPod:\s*false/);
    assert.match(route, /historicalGpuEvidenceOnly:\s*true/);
    assert.doesNotMatch(route, /create-pod|runpod\.com|auto-provision/i);
    assert.doesNotMatch(route, /runProveDoors\s*\(|loadGpuEvidence\s*\(/);
  });
});
