/**
 * Desk report — GET/POST /api/report fail-closed.
 * Reuses runReport. Localization only — no RunPod / no invented findings.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  REPORT_SCHEMA,
  REPORT_DEFAULT_FROM,
  reportCatalog,
  runReport,
} from "../../src/locate/report-summary.ts";
import {
  GET as reportGet,
  POST as reportPost,
} from "../../src/app/api/report/route.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURE_PROVE = path.join(root, REPORT_DEFAULT_FROM);
const FIXTURE_SARIF = path.join(
  root,
  "fixtures/locate/ingest-sample/sample.sarif",
);

describe("reportCatalog", () => {
  it("documents POST /api/report + honesty (no RunPod)", () => {
    const c = reportCatalog();
    assert.equal(c.endpoint, "POST /api/report");
    assert.equal(c.getEndpoint, "GET /api/report");
    assert.equal(c.schemaVersion, REPORT_SCHEMA);
    assert.equal(c.defaultFrom, REPORT_DEFAULT_FROM);
    assert.ok(c.honesty.some((h) => /does not start RunPod|runpod:\s*false/i.test(h)));
    assert.ok(c.honesty.some((h) => /Fail-closed|fail-closed/i.test(h)));
    assert.ok(c.honesty.some((h) => /runReport/i.test(h)));
    assert.ok(c.honesty.some((h) => /localization/i.test(h)));
  });
});

describe("GET/POST /api/report", () => {
  it("GET ?catalog=1 returns catalog without building a report", async () => {
    const req = new Request("http://localhost/api/report?catalog=1");
    const res = await reportGet(req);
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      kind: string;
      endpoint: string;
      honesty: string[];
    };
    assert.equal(body.kind, "report-catalog");
    assert.equal(body.endpoint, "POST /api/report");
    assert.ok(body.honesty.some((h) => /RunPod/i.test(h)));
  });

  it("GET defaults to fixture prove-doors (zeroday.report/v1 · runpod false)", async () => {
    const req = new Request("http://localhost/api/report");
    const res = await reportGet(req);
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      ok: boolean;
      schemaVersion: string;
      runpod: boolean;
      startsRunPod: boolean;
      findings: unknown[];
      markdown?: string;
      source?: string;
      disclaimers: string[];
    };
    assert.equal(body.schemaVersion, REPORT_SCHEMA);
    assert.equal(body.ok, true);
    assert.equal(body.runpod, false);
    assert.equal(body.startsRunPod, false);
    assert.equal(body.source, "fixture");
    assert.ok(Array.isArray(body.findings) && body.findings.length >= 1);
    assert.ok(typeof body.markdown === "string" && body.markdown.includes("Localization"));
    assert.ok(body.disclaimers.some((d) => /exploitability/i.test(d)));
  });

  it("POST {} uses fixture and matches runReport findings", async () => {
    const req = new Request("http://localhost/api/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const res = await reportPost(req);
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      ok: boolean;
      schemaVersion: string;
      runpod: boolean;
      findings: Array<{ path: string }>;
    };
    const direct = runReport({ from: FIXTURE_PROVE, cwd: root });
    assert.equal(body.schemaVersion, REPORT_SCHEMA);
    assert.equal(body.ok, true);
    assert.equal(body.runpod, false);
    assert.equal(body.findings.length, direct.findings.length);
    assert.deepEqual(
      body.findings.map((f) => f.path),
      direct.findings.map((f) => f.path),
    );
  });

  it("POST from=prove-doors alias uses fixture", async () => {
    const req = new Request("http://localhost/api/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from: "prove-doors" }),
    });
    const res = await reportPost(req);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { source?: string; runpod: boolean };
    assert.equal(body.source, "fixture");
    assert.equal(body.runpod, false);
  });

  it("POST accepts inline proveDoors (last Run-all shape)", async () => {
    const prove = JSON.parse(fs.readFileSync(FIXTURE_PROVE, "utf8"));
    const req = new Request("http://localhost/api/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proveDoors: prove }),
    });
    const res = await reportPost(req);
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      ok: boolean;
      source?: string;
      findings: Array<{ path: string }>;
      runpod: boolean;
    };
    assert.equal(body.ok, true);
    assert.equal(body.source, "inline-prove-doors");
    assert.equal(body.runpod, false);
    assert.ok(body.findings.some((f) => f.path === "src/search.js"));
  });

  it("POST sarif-only builds from existing SARIF (no invented prove-doors)", async () => {
    const req = new Request("http://localhost/api/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sarif: "fixtures/locate/ingest-sample/sample.sarif",
      }),
    });
    const res = await reportPost(req);
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      ok: boolean;
      source?: string;
      sources: Array<{ kind: string }>;
      runpod: boolean;
    };
    assert.equal(body.ok, true);
    assert.equal(body.source, "sarif");
    assert.equal(body.runpod, false);
    assert.ok(body.sources.every((s) => s.kind === "sarif"));
    assert.ok(fs.existsSync(FIXTURE_SARIF));
  });

  it("POST refuses secret / provision fields", async () => {
    const req = new Request("http://localhost/api/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runpodApiKey: "x" }),
    });
    const res = await reportPost(req);
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
    const req = new Request("http://localhost/api/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not-json",
    });
    const res = await reportPost(req);
    assert.equal(res.status, 400);
    const body = (await res.json()) as {
      ok: boolean;
      code?: string;
      runpod: boolean;
    };
    assert.equal(body.ok, false);
    assert.equal(body.code, "BAD_JSON");
    assert.equal(body.runpod, false);
  });

  it("POST fail-closed on missing path", async () => {
    const req = new Request("http://localhost/api/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from: "does-not-exist-report.json" }),
    });
    const res = await reportPost(req);
    assert.ok(res.status === 404 || res.status === 400);
    const body = (await res.json()) as { ok: boolean; runpod: boolean };
    assert.equal(body.ok, false);
    assert.equal(body.runpod, false);
  });

  it("POST fail-closed on bad inline proveDoors schema", async () => {
    const req = new Request("http://localhost/api/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        proveDoors: { schemaVersion: "nope", ok: true },
      }),
    });
    const res = await reportPost(req);
    assert.equal(res.status, 400);
    const body = (await res.json()) as { ok: boolean; code?: string };
    assert.equal(body.ok, false);
    assert.equal(body.code, "INPUT_SCHEMA");
  });

  it("POST omit top → full findings list (no top/truncated fields)", async () => {
    const req = new Request("http://localhost/api/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sarif: "fixtures/locate/ingest-sample/sample.sarif",
      }),
    });
    const res = await reportPost(req);
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      ok: boolean;
      findings: unknown[];
      top?: number;
      truncated?: boolean;
      runpod: boolean;
    };
    const direct = runReport({ sarif: FIXTURE_SARIF, cwd: root });
    assert.equal(body.ok, true);
    assert.equal(body.runpod, false);
    assert.equal(body.findings.length, direct.findings.length);
    assert.equal(body.top, undefined);
    assert.equal(body.truncated, undefined);
  });

  it("POST top=1 truncates ranked findings (same as CLI --top)", async () => {
    const full = runReport({ sarif: FIXTURE_SARIF, cwd: root });
    assert.ok(full.findings.length > 1, "fixture SARIF needs >1 findings");
    const req = new Request("http://localhost/api/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sarif: "fixtures/locate/ingest-sample/sample.sarif",
        top: 1,
      }),
    });
    const res = await reportPost(req);
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      ok: boolean;
      findings: Array<{ path: string }>;
      top?: number;
      truncated?: boolean;
      runpod: boolean;
      markdown?: string;
    };
    const direct = runReport({ sarif: FIXTURE_SARIF, cwd: root, top: 1 });
    assert.equal(body.ok, true);
    assert.equal(body.runpod, false);
    assert.equal(body.top, 1);
    assert.equal(body.truncated, true);
    assert.equal(body.findings.length, 1);
    assert.deepEqual(
      body.findings.map((f) => f.path),
      direct.findings.map((f) => f.path),
    );
    assert.ok(
      typeof body.markdown === "string" && /top 1/i.test(body.markdown),
    );
  });

  it("POST invalid top fail-closed 400 INPUT_INVALID", async () => {
    for (const bad of [0, -1, 1.5, "abc", "", "1e2"]) {
      const req = new Request("http://localhost/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: "prove-doors", top: bad }),
      });
      const res = await reportPost(req);
      assert.equal(res.status, 400, `expected 400 for top=${JSON.stringify(bad)}`);
      const body = (await res.json()) as {
        ok: boolean;
        code?: string;
        error?: string;
        runpod: boolean;
      };
      assert.equal(body.ok, false);
      assert.equal(body.code, "INPUT_INVALID");
      assert.equal(body.runpod, false);
      assert.match(String(body.error), /top/i);
    }
  });

  it("GET ?top=1 truncates; invalid ?top=0 → 400", async () => {
    const okReq = new Request(
      "http://localhost/api/report?sarif=fixtures/locate/ingest-sample/sample.sarif&top=1&markdown=0",
    );
    const okRes = await reportGet(okReq);
    assert.equal(okRes.status, 200);
    const okBody = (await okRes.json()) as {
      findings: unknown[];
      top?: number;
      truncated?: boolean;
    };
    assert.equal(okBody.top, 1);
    assert.equal(okBody.truncated, true);
    assert.equal(okBody.findings.length, 1);

    const badReq = new Request("http://localhost/api/report?top=0");
    const badRes = await reportGet(badReq);
    assert.equal(badRes.status, 400);
    const badBody = (await badRes.json()) as { ok: boolean; code?: string };
    assert.equal(badBody.ok, false);
    assert.equal(badBody.code, "INPUT_INVALID");
  });
});

describe("Prove doors report wiring", () => {
  it("panel + route call runReport (no RunPod / no reimplement)", () => {
    const prove = fs.readFileSync(
      path.join(root, "src/components/operator/prove-doors-panel.tsx"),
      "utf8",
    );
    const route = fs.readFileSync(
      path.join(root, "src/app/api/report/route.ts"),
      "utf8",
    );
    assert.match(prove, /data-testid="prove-doors-report-card"/);
    assert.match(prove, /data-testid="prove-doors-report-run"/);
    assert.match(prove, /data-testid="prove-doors-report-top"/);
    assert.match(prove, /data-testid="prove-doors-report-download-json"/);
    assert.match(prove, /prove-doors-report-copy/);
    assert.match(prove, /ReportFindingsPanel/);
    assert.match(prove, /\/api\/report/);
    assert.match(prove, /downloadReportFiles|downloadReportJson/);
    assert.match(prove, /REPORT_JSON_DOWNLOAD_FILENAME/);
    assert.match(prove, /does not start RunPod/i);
    assert.match(prove, /runReport/);
    assert.match(prove, /body\.top|topRaw/);
    assert.doesNotMatch(prove, /create-pod|auto-provision|AUROC\s*=/i);
    assert.match(route, /runReport/);
    assert.match(route, /parseReportTop/);
    assert.match(route, /formatReportMarkdown/);
    assert.match(route, /reportCatalog/);
    assert.match(route, /startsRunPod:\s*false/);
    assert.match(route, /SECRET_FIELD_REFUSED/);
    assert.match(route, /INPUT_INVALID/);
    assert.doesNotMatch(route, /create-pod|runpod\.com|auto-provision/i);
    // Must call existing module — not reimplement ranking inline.
    assert.doesNotMatch(route, /findingsFromProveDoors|findingsFromSarif/);
    // Must reuse CLI truncate helper — not fork ranking.
    assert.doesNotMatch(route, /findings\.slice\(/);
  });
});
