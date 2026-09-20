/**
 * Desk stranger-verify — in-process prove-doors + API honesty.
 * Mock live URL HTTP; assert JSON shape; assert no provision.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  modelsUrlFromLiveUrl,
  probeOperatorEndpoint,
  runStrangerVerify,
  strangerVerifyCatalog,
  STRANGER_VERIFY_SCHEMA,
  StrangerVerifyError,
} from "../../src/desk/stranger-verify.ts";
import { POST as strangerVerifyPost, GET as strangerVerifyGet } from "../../src/app/api/stranger-verify/route.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("Desk stranger-verify (in-process)", () => {
  it("catalog documents POST /api/stranger-verify + honesty", () => {
    const c = strangerVerifyCatalog();
    assert.equal(c.kind, "stranger-verify-catalog");
    assert.equal(c.schemaVersion, STRANGER_VERIFY_SCHEMA);
    assert.match(c.endpoint, /\/api\/stranger-verify/);
    assert.ok(c.honesty.some((h) => /provisioned:\s*false/i.test(h)));
    assert.ok(c.honesty.some((h) => /no AUROC|AUROC/i.test(h)));
  });

  it("modelsUrlFromLiveUrl normalizes /v1 and rejects bad schemes", () => {
    const a = modelsUrlFromLiveUrl("http://127.0.0.1:8000/v1");
    assert.equal(a.modelsUrl, "http://127.0.0.1:8000/v1/models");
    const b = modelsUrlFromLiveUrl("http://127.0.0.1:8000/v1/completions");
    assert.equal(b.modelsUrl, "http://127.0.0.1:8000/v1/models");
    assert.throws(
      () => modelsUrlFromLiveUrl("ftp://evil.example/v1"),
      (e: Error) =>
        e instanceof StrangerVerifyError && e.code === "LIVE_URL_SCHEME",
    );
    assert.throws(
      () => modelsUrlFromLiveUrl("   "),
      (e: Error) =>
        e instanceof StrangerVerifyError && e.code === "LIVE_URL_EMPTY",
    );
  });

  it("without liveUrl Door B stays citation-only (no probe / no provision)", async () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "zd-sv-cite-"));
    const payload = await runStrangerVerify({
      cwd: root,
      outputDir: out,
    });
    assert.equal(payload.schemaVersion, STRANGER_VERIFY_SCHEMA);
    assert.equal(payload.doorA.status, "pass");
    assert.equal(payload.doorA.ran, true);
    assert.ok(payload.doorA.artifacts.matrix);
    assert.equal(payload.doorB.mode, "citation");
    assert.equal(payload.doorB.ran, false);
    assert.equal(
      "probe" in payload.doorB ? payload.doorB.probe : undefined,
      undefined,
    );
    assert.equal(payload.nonClaims.needsHuman, true);
    assert.equal(payload.nonClaims.noRunPodCreateFromStrangerVerify, true);
    assert.doesNotMatch(
      JSON.stringify(payload),
      /create-pod|auto-provision|"provisioned"\s*:\s*true/i,
    );
    assert.doesNotMatch(JSON.stringify(payload), /\bAUROC\s*[:=]\s*0?\.\d+/i);
  });

  it("liveUrl probes mocked /v1/models (operator_endpoint · provisioned false)", async () => {
    let hitModels = 0;
    const server = http.createServer((req, res) => {
      if (req.method === "GET" && req.url === "/v1/models") {
        hitModels += 1;
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ data: [{ id: "mock-model" }] }));
        return;
      }
      res.writeHead(404);
      res.end("nope");
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const addr = server.address();
    assert.ok(addr && typeof addr === "object");
    const liveUrl = `http://127.0.0.1:${addr.port}/v1`;
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "zd-sv-probe-"));

    try {
      const payload = await runStrangerVerify({
        cwd: root,
        outputDir: out,
        liveUrl,
        // Red herrings in env must not affect provision (we never create pods)
      });

      assert.equal(payload.schemaVersion, STRANGER_VERIFY_SCHEMA);
      assert.equal(payload.doorA.ran, true);
      assert.equal(payload.doorB.mode, "operator_endpoint");
      assert.equal(payload.doorB.ran, true);
      assert.ok(payload.doorB.mode === "operator_endpoint");
      if (payload.doorB.mode !== "operator_endpoint") {
        assert.fail("expected operator_endpoint");
      }
      assert.equal(payload.doorB.provisioned, false);
      assert.equal(payload.doorB.spendUsd, null);
      assert.ok(payload.doorB.probe);
      assert.equal(payload.doorB.probe.ok, true);
      assert.equal(payload.doorB.probe.httpStatus, 200);
      assert.equal(typeof payload.doorB.probe.latencyMs, "number");
      assert.ok((payload.doorB.probe.latencyMs as number) >= 0);
      assert.equal(payload.doorB.probe.modelCount, 1);
      assert.match(payload.doorB.probe.modelsUrl, /\/v1\/models$/);
      assert.equal(payload.doorB.probe.provisioned, false);
      assert.equal(payload.doorB.probe.spendUsd, null);
      assert.equal(payload.nonClaims.probeNotMeasuredA40ReProof, true);
      assert.equal(payload.nonClaims.noRunPodCreateFromStrangerVerify, true);
      assert.doesNotMatch(
        JSON.stringify(payload),
        /create-pod|auto-provision|"provisioned"\s*:\s*true/i,
      );
      assert.doesNotMatch(JSON.stringify(payload), /"spendUsd"\s*:\s*[1-9]/);
      assert.ok(hitModels >= 1);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }
  });

  it("probeOperatorEndpoint uses injected fetch (unit · no real network create)", async () => {
    let called = 0;
    const fetchImpl: typeof fetch = async (input) => {
      called += 1;
      assert.match(String(input), /\/v1\/models$/);
      return new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };
    const probe = await probeOperatorEndpoint("http://127.0.0.1:9/v1", {
      fetchImpl,
    });
    assert.equal(called, 1);
    assert.equal(probe.ok, true);
    assert.equal(probe.provisioned, false);
    assert.equal(probe.spendUsd, null);
    assert.equal(probe.mode, "operator_endpoint");
    assert.equal(probe.modelCount, 0);
  });
});

describe("POST /api/stranger-verify", () => {
  it("GET returns catalog", async () => {
    const res = await strangerVerifyGet();
    assert.equal(res.status, 200);
    const json = (await res.json()) as { kind: string; endpoint: string };
    assert.equal(json.kind, "stranger-verify-catalog");
    assert.match(json.endpoint, /stranger-verify/);
  });

  it("POST without body returns parseable prove-doors JSON (citation Door B)", async () => {
    const req = new Request("http://localhost/api/stranger-verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const res = await strangerVerifyPost(req);
    assert.equal(res.status, 200);
    const payload = (await res.json()) as {
      schemaVersion: string;
      doorA: { ran: boolean };
      doorB: { mode: string; ran: boolean; provisioned?: boolean };
      nonClaims: Record<string, boolean>;
    };
    assert.equal(payload.schemaVersion, STRANGER_VERIFY_SCHEMA);
    assert.equal(payload.doorA.ran, true);
    assert.equal(payload.doorB.mode, "citation");
    assert.equal(payload.doorB.ran, false);
    assert.equal(payload.nonClaims.needsHuman, true);
    // No provision language
    assert.doesNotMatch(
      JSON.stringify(payload),
      /"provisioned"\s*:\s*true|create-pod/i,
    );
  });

  it("POST with liveUrl hits mock /v1/models · provisioned false", async () => {
    let hit = 0;
    const server = http.createServer((req, res) => {
      if (req.method === "GET" && req.url === "/v1/models") {
        hit += 1;
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ data: [{ id: "api-mock" }] }));
        return;
      }
      res.writeHead(404);
      res.end();
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const addr = server.address();
    assert.ok(addr && typeof addr === "object");
    const liveUrl = `http://127.0.0.1:${addr.port}/v1`;

    try {
      const req = new Request("http://localhost/api/stranger-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ liveUrl }),
      });
      const res = await strangerVerifyPost(req);
      assert.equal(res.status, 200);
      const payload = (await res.json()) as {
        doorB: {
          mode: string;
          provisioned?: boolean;
          spendUsd?: number | null;
          probe?: { ok: boolean; httpStatus: number | null };
        };
      };
      assert.equal(payload.doorB.mode, "operator_endpoint");
      assert.equal(payload.doorB.provisioned, false);
      assert.equal(payload.doorB.spendUsd, null);
      assert.ok(payload.doorB.probe?.ok);
      assert.equal(payload.doorB.probe?.httpStatus, 200);
      assert.ok(hit >= 1);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }
  });

  it("POST refuses secret/provision fields", async () => {
    const req = new Request("http://localhost/api/stranger-verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ liveUrl: "http://127.0.0.1:1/v1", hfToken: "x" }),
    });
    const res = await strangerVerifyPost(req);
    assert.equal(res.status, 403);
    const json = (await res.json()) as { code?: string };
    assert.equal(json.code, "SECRET_FIELD_REFUSED");
  });
});
