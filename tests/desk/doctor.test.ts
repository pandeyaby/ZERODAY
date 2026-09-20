/**
 * Desk doctor — GET/POST /api/doctor fail-closed.
 * Reuses runDoctor. Historical / local only — no RunPod.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  DOCTOR_SCHEMA,
  doctorCatalog,
  runDoctor,
} from "../../src/doctor/index.ts";
import {
  GET as doctorGet,
  POST as doctorPost,
} from "../../src/app/api/doctor/route.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("doctorCatalog", () => {
  it("documents POST /api/doctor + honesty (no RunPod)", () => {
    const c = doctorCatalog();
    assert.equal(c.endpoint, "POST /api/doctor");
    assert.equal(c.getEndpoint, "GET /api/doctor");
    assert.equal(c.schemaVersion, DOCTOR_SCHEMA);
    assert.equal(c.defaultOut, "out/doctor.json");
    assert.ok(c.honesty.some((h) => /does not start RunPod|no GPU spend/i.test(h)));
    assert.ok(c.honesty.some((h) => /Fail-closed|fail-closed/i.test(h)));
    assert.ok(c.honesty.some((h) => /runDoctor/i.test(h)));
  });
});

describe("GET/POST /api/doctor", () => {
  it("GET ?catalog=1 returns catalog without running checks", async () => {
    const req = new Request("http://localhost/api/doctor?catalog=1");
    const res = await doctorGet(req);
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      kind: string;
      endpoint: string;
      honesty: string[];
    };
    assert.equal(body.kind, "doctor-catalog");
    assert.equal(body.endpoint, "POST /api/doctor");
    assert.ok(body.honesty.some((h) => /RunPod/i.test(h)));
  });

  it("GET returns zeroday.doctor/v1 (startsRunPod false)", async () => {
    const req = new Request("http://localhost/api/doctor");
    const res = await doctorGet(req);
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      ok: boolean;
      schemaVersion: string;
      startsRunPod: boolean;
      runpod: boolean;
      networkRequired: boolean;
      checks: Array<{ id: string; ok: boolean; detail: string }>;
    };
    assert.equal(body.schemaVersion, DOCTOR_SCHEMA);
    assert.equal(body.ok, true);
    assert.equal(body.startsRunPod, false);
    assert.equal(body.runpod, false);
    assert.equal(body.networkRequired, false);
    assert.ok(Array.isArray(body.checks) && body.checks.length >= 1);
    assert.ok(body.checks.every((c) => c.ok === true));
  });

  it("POST builds doctor JSON (CLI --out shape · startsRunPod false)", async () => {
    const req = new Request("http://localhost/api/doctor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const res = await doctorPost(req);
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      ok: boolean;
      schemaVersion: string;
      startsRunPod: boolean;
      runpod: boolean;
      networkRequired: boolean;
      checks: Array<{ id: string; ok: boolean }>;
    };
    const direct = runDoctor({ cwd: root });
    assert.equal(body.schemaVersion, DOCTOR_SCHEMA);
    assert.equal(body.ok, direct.ok);
    assert.equal(body.startsRunPod, false);
    assert.equal(body.runpod, false);
    assert.equal(body.networkRequired, false);
    assert.equal(body.checks.length, direct.checks.length);
    assert.deepEqual(
      body.checks.map((c) => c.id),
      direct.checks.map((c) => c.id),
    );
  });

  it("POST refuses secret / provision fields", async () => {
    const req = new Request("http://localhost/api/doctor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runpodApiKey: "x" }),
    });
    const res = await doctorPost(req);
    assert.equal(res.status, 403);
    const body = (await res.json()) as {
      ok: boolean;
      code?: string;
      startsRunPod: boolean;
      runpod: boolean;
    };
    assert.equal(body.ok, false);
    assert.equal(body.code, "SECRET_FIELD_REFUSED");
    assert.equal(body.startsRunPod, false);
    assert.equal(body.runpod, false);
  });

  it("POST fail-closed on bad JSON body", async () => {
    const req = new Request("http://localhost/api/doctor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not-json",
    });
    const res = await doctorPost(req);
    assert.equal(res.status, 400);
    const body = (await res.json()) as {
      ok: boolean;
      code?: string;
      startsRunPod: boolean;
    };
    assert.equal(body.ok, false);
    assert.equal(body.code, "BAD_JSON");
    assert.equal(body.startsRunPod, false);
  });
});

describe("Prove doors doctor wiring", () => {
  it("panel + route call runDoctor (no RunPod / no reimplement)", () => {
    const prove = fs.readFileSync(
      path.join(root, "src/components/operator/prove-doors-panel.tsx"),
      "utf8",
    );
    const route = fs.readFileSync(
      path.join(root, "src/app/api/doctor/route.ts"),
      "utf8",
    );
    assert.match(prove, /data-testid="prove-doors-doctor-card"/);
    assert.match(prove, /data-testid="prove-doors-doctor-run"/);
    assert.match(prove, /data-testid="prove-doors-doctor-download"/);
    assert.match(prove, /prove-doors-doctor-copy/);
    assert.match(prove, /\/api\/doctor/);
    assert.match(prove, /downloadDoctorJson/);
    assert.match(prove, /DOCTOR_DOWNLOAD_FILENAME/);
    assert.match(prove, /does not start RunPod/i);
    assert.match(prove, /out\/doctor\.json/);
    assert.match(prove, /runDoctor/);
    assert.doesNotMatch(prove, /create-pod|auto-provision|AUROC\s*=/i);
    assert.match(route, /runDoctor/);
    assert.match(route, /doctorCatalog/);
    assert.match(route, /startsRunPod:\s*false/);
    assert.match(route, /SECRET_FIELD_REFUSED/);
    assert.doesNotMatch(route, /create-pod|runpod\.com|auto-provision/i);
    // Must call existing module — not reimplement checks inline.
    assert.doesNotMatch(route, /checkNodeRuntime|checkPackageScripts|checkGpuEvidence/);
  });
});
