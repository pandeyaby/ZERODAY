/**
 * Desk Prove Run-all-doors orchestrator — mock/in-process paths.
 * all-pass · cassette fail-closed · B skipped without URL · B fail on bad URL.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  PROVE_DOORS_SCHEMA,
  proveDoorsCatalog,
  runProveDoors,
} from "../../src/desk/prove-doors.ts";
import {
  GET as proveDoorsGet,
  POST as proveDoorsPost,
} from "../../src/app/api/prove-doors/route.ts";
import { STRANGER_VERIFY_SCHEMA } from "../../src/desk/stranger-verify.ts";
import { CASSETTE_REPLAY_SCHEMA } from "../../src/desk/cassette-replay.ts";
import { LIVE_URL_PROBE_SCHEMA } from "../../src/desk/live-url-probe.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

async function withMockModelsServer(
  handler: (
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ) => void,
  fn: (liveUrl: string) => Promise<void>,
): Promise<void> {
  const server = http.createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  assert.ok(addr && typeof addr === "object");
  const liveUrl = `http://127.0.0.1:${addr.port}/v1`;
  try {
    await fn(liveUrl);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

describe("Desk prove-doors Run-all-doors orchestrator", () => {
  it("catalog documents POST /api/prove-doors + door labels + skipped B", () => {
    const c = proveDoorsCatalog();
    assert.equal(c.kind, "prove-doors-catalog");
    assert.equal(c.schemaVersion, PROVE_DOORS_SCHEMA);
    assert.match(c.endpoint, /\/api\/prove-doors/);
    assert.match(c.cli, /prove-doors/);
    assert.equal(c.doors.a.label, "Door A — stranger:verify");
    assert.equal(c.doors.cassette.label, "cassette:replay");
    assert.equal(c.doors.b.label, "Door B — live-url probe");
    assert.equal(c.doors.b.skippedWhen, "liveUrl omitted");
    assert.ok(c.honesty.some((h) => /fail-closed/i.test(h)));
    assert.ok(c.honesty.some((h) => /skipped/i.test(h)));
    assert.ok(c.honesty.some((h) => /no RunPod|spend/i.test(h)));
  });

  it("all-pass: Door A + cassette + Door B (mock /v1/models)", async () => {
    await withMockModelsServer(
      (req, res) => {
        if (req.method === "GET" && req.url === "/v1/models") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ data: [{ id: "mock-all" }] }));
          return;
        }
        res.writeHead(404);
        res.end();
      },
      async (liveUrl) => {
        const strangerOut = fs.mkdtempSync(
          path.join(os.tmpdir(), "zd-prove-a-"),
        );
        const cassetteOut = fs.mkdtempSync(
          path.join(os.tmpdir(), "zd-prove-c-"),
        );
        const payload = await runProveDoors({
          cwd: root,
          liveUrl,
          strangerOutputDir: strangerOut,
          cassetteOutputDir: cassetteOut,
        });
        assert.equal(payload.schemaVersion, PROVE_DOORS_SCHEMA);
        assert.equal(payload.ok, true);
        assert.ok(payload.generatedAt);
        assert.equal(payload.doors.a.status, "ok");
        assert.equal(payload.doors.a.schemaVersion, STRANGER_VERIFY_SCHEMA);
        assert.equal(payload.doors.a.result?.doorA.status, "pass");
        assert.equal(payload.doors.cassette.status, "ok");
        assert.equal(
          payload.doors.cassette.schemaVersion,
          CASSETTE_REPLAY_SCHEMA,
        );
        assert.equal(payload.doors.cassette.result?.findingCount, 1);
        assert.equal(payload.doors.b.status, "ok");
        assert.equal(payload.doors.b.schemaVersion, LIVE_URL_PROBE_SCHEMA);
        if (payload.doors.b.status === "ok") {
          assert.equal(payload.doors.b.result.ok, true);
          assert.equal(payload.doors.b.result.provisioned, false);
          assert.equal(payload.doors.b.result.spendUsd, null);
          assert.equal(payload.doors.b.result.probe.httpStatus, 200);
        }
        assert.equal(payload.nonClaims.needsHuman, true);
        assert.equal(payload.nonClaims.failClosedPerDoor, true);
        assert.equal(payload.nonClaims.noSpendClaimsInvented, true);
        assert.doesNotMatch(
          JSON.stringify(payload),
          /create-pod|auto-provision|"provisioned"\s*:\s*true/i,
        );
        assert.doesNotMatch(JSON.stringify(payload), /"spendUsd"\s*:\s*[1-9]/);
      },
    );
  });

  it("cassette fail-closed: overall ok false · a may still pass · b skipped", async () => {
    const strangerOut = fs.mkdtempSync(path.join(os.tmpdir(), "zd-prove-fail-a-"));
    const cassetteOut = fs.mkdtempSync(
      path.join(os.tmpdir(), "zd-prove-fail-c-"),
    );
    const payload = await runProveDoors({
      cwd: root,
      strangerOutputDir: strangerOut,
      cassetteOutputDir: cassetteOut,
      expectFile: "src/definitely-not-this.js",
    });
    assert.equal(payload.ok, false);
    assert.equal(payload.doors.a.status, "ok");
    assert.equal(payload.doors.cassette.status, "failed");
    assert.equal(payload.doors.cassette.code, "ASSERT_MISMATCH");
    assert.equal(payload.doors.cassette.exit, 2);
    assert.ok(payload.doors.cassette.error);
    assert.equal(payload.doors.b.status, "skipped");
    if (payload.doors.b.status === "skipped") {
      assert.equal(payload.doors.b.reason, "liveUrl omitted");
      assert.equal(payload.doors.b.provisioned, false);
      assert.equal(payload.doors.b.spendUsd, null);
    }
  });

  it("Door B skipped (not failed) when liveUrl omitted", async () => {
    const strangerOut = fs.mkdtempSync(
      path.join(os.tmpdir(), "zd-prove-skip-a-"),
    );
    const cassetteOut = fs.mkdtempSync(
      path.join(os.tmpdir(), "zd-prove-skip-c-"),
    );
    const payload = await runProveDoors({
      cwd: root,
      strangerOutputDir: strangerOut,
      cassetteOutputDir: cassetteOut,
    });
    assert.equal(payload.ok, true);
    assert.equal(payload.doors.a.status, "ok");
    assert.equal(payload.doors.cassette.status, "ok");
    assert.equal(payload.doors.b.status, "skipped");
    if (payload.doors.b.status === "skipped") {
      assert.equal(payload.doors.b.reason, "liveUrl omitted");
      assert.match(payload.doors.b.note, /skipped/i);
      assert.equal(payload.doors.b.provisioned, false);
      assert.equal(payload.doors.b.spendUsd, null);
    }
    assert.doesNotMatch(JSON.stringify(payload.doors.b), /"status"\s*:\s*"failed"/);
  });

  it("Door B fail when bad URL (mock HTTP non-200) · overall ok false", async () => {
    await withMockModelsServer(
      (req, res) => {
        if (req.method === "GET" && req.url === "/v1/models") {
          res.writeHead(503, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "down" }));
          return;
        }
        res.writeHead(404);
        res.end();
      },
      async (liveUrl) => {
        const strangerOut = fs.mkdtempSync(
          path.join(os.tmpdir(), "zd-prove-bfail-a-"),
        );
        const cassetteOut = fs.mkdtempSync(
          path.join(os.tmpdir(), "zd-prove-bfail-c-"),
        );
        const payload = await runProveDoors({
          cwd: root,
          liveUrl,
          strangerOutputDir: strangerOut,
          cassetteOutputDir: cassetteOut,
        });
        assert.equal(payload.ok, false);
        assert.equal(payload.doors.a.status, "ok");
        assert.equal(payload.doors.cassette.status, "ok");
        assert.equal(payload.doors.b.status, "failed");
        if (payload.doors.b.status === "failed") {
          assert.equal(payload.doors.b.code, "PROBE_HTTP_FAILED");
          assert.equal(payload.doors.b.provisioned, false);
          assert.equal(payload.doors.b.spendUsd, null);
          assert.equal(payload.doors.b.probe?.httpStatus, 503);
          assert.equal(payload.doors.b.probe?.ok, false);
        }
      },
    );
  });

  it("GET /api/prove-doors returns catalog", async () => {
    const res = await proveDoorsGet();
    assert.equal(res.status, 200);
    const json = (await res.json()) as ReturnType<typeof proveDoorsCatalog>;
    assert.equal(json.kind, "prove-doors-catalog");
    assert.equal(json.schemaVersion, PROVE_DOORS_SCHEMA);
  });

  it("POST /api/prove-doors skips Door B without liveUrl", async () => {
    const strangerOut = fs.mkdtempSync(
      path.join(os.tmpdir(), "zd-prove-api-a-"),
    );
    const cassetteOut = fs.mkdtempSync(
      path.join(os.tmpdir(), "zd-prove-api-c-"),
    );
    const req = new Request("http://localhost/api/prove-doors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        strangerOutputDir: strangerOut,
        cassetteOutputDir: cassetteOut,
      }),
    });
    const res = await proveDoorsPost(req);
    assert.equal(res.status, 200);
    const json = (await res.json()) as Awaited<
      ReturnType<typeof runProveDoors>
    >;
    assert.equal(json.schemaVersion, PROVE_DOORS_SCHEMA);
    assert.equal(json.ok, true);
    assert.equal(json.doors.b.status, "skipped");
    assert.ok(json.doors.a.status === "ok" || json.doors.a.status === "failed");
  });

  it("POST refuses secret fields", async () => {
    const req = new Request("http://localhost/api/prove-doors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ liveUrl: "http://127.0.0.1:1/v1", hfToken: "x" }),
    });
    const res = await proveDoorsPost(req);
    assert.equal(res.status, 403);
    const json = (await res.json()) as { code?: string; ok?: boolean };
    assert.equal(json.code, "SECRET_FIELD_REFUSED");
    assert.equal(json.ok, false);
  });
});
