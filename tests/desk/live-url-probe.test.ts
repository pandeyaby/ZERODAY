/**
 * Desk Door B live-url probe — mock HTTP server; fail-closed; no provision.
 */

import assert from "node:assert/strict";
import http from "node:http";
import { describe, it } from "node:test";
import {
  LIVE_URL_PROBE_SCHEMA,
  liveUrlProbeCatalog,
  LiveUrlProbeError,
  runLiveUrlProbe,
} from "../../src/desk/live-url-probe.ts";
import {
  POST as liveUrlProbePost,
  GET as liveUrlProbeGet,
} from "../../src/app/api/live-url-probe/route.ts";

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

describe("Desk live-url-probe (Door B)", () => {
  it("catalog documents POST /api/live-url-probe + honesty", () => {
    const c = liveUrlProbeCatalog();
    assert.equal(c.kind, "live-url-probe-catalog");
    assert.equal(c.schemaVersion, LIVE_URL_PROBE_SCHEMA);
    assert.match(c.endpoint, /\/api\/live-url-probe/);
    assert.ok(c.honesty.some((h) => /fail-closed/i.test(h)));
    assert.ok(c.honesty.some((h) => /not measured Secure A40|A40/i.test(h)));
    assert.ok(c.honesty.some((h) => /spendUsd|no spend/i.test(h)));
  });

  it("runLiveUrlProbe succeeds against mock /v1/models (structured fields)", async () => {
    let hit = 0;
    await withMockModelsServer(
      (req, res) => {
        if (req.method === "GET" && req.url === "/v1/models") {
          hit += 1;
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              data: [{ id: "mock-a" }, { id: "mock-b" }],
            }),
          );
          return;
        }
        res.writeHead(404);
        res.end();
      },
      async (liveUrl) => {
        const result = await runLiveUrlProbe({ liveUrl });
        assert.equal(result.schemaVersion, LIVE_URL_PROBE_SCHEMA);
        assert.equal(result.ok, true);
        assert.equal(result.mode, "operator_endpoint");
        assert.equal(result.provisioned, false);
        assert.equal(result.spendUsd, null);
        assert.equal(result.probe.ok, true);
        assert.equal(result.probe.httpStatus, 200);
        assert.equal(typeof result.probe.latencyMs, "number");
        assert.ok((result.probe.latencyMs as number) >= 0);
        assert.equal(result.probe.modelCount, 2);
        assert.match(result.probe.modelsUrl, /\/v1\/models$/);
        assert.equal(result.nonClaims.probeNotMeasuredA40ReProof, true);
        assert.equal(result.nonClaims.noSpendClaimsFromDoorBProbe, true);
        assert.equal(result.nonClaims.noRunPodCreateFromLiveUrlProbe, true);
        assert.doesNotMatch(
          JSON.stringify(result),
          /create-pod|auto-provision|"provisioned"\s*:\s*true/i,
        );
        assert.doesNotMatch(JSON.stringify(result), /"spendUsd"\s*:\s*[1-9]/);
        assert.ok(hit >= 1);
      },
    );
  });

  it("fail-closed on non-200", async () => {
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
        await assert.rejects(
          () => runLiveUrlProbe({ liveUrl }),
          (e: Error) =>
            e instanceof LiveUrlProbeError &&
            e.code === "PROBE_HTTP_FAILED" &&
            e.probe?.httpStatus === 503 &&
            e.probe.ok === false,
        );
      },
    );
  });

  it("fail-closed on unreachable", async () => {
    await assert.rejects(
      () =>
        runLiveUrlProbe({
          liveUrl: "http://127.0.0.1:9/v1",
          timeoutMs: 500,
        }),
      (e: Error) =>
        e instanceof LiveUrlProbeError &&
        e.code === "PROBE_UNREACHABLE" &&
        e.probe?.httpStatus === null &&
        e.probe.ok === false,
    );
  });

  it("requires liveUrl", async () => {
    await assert.rejects(
      () => runLiveUrlProbe({ liveUrl: "   " }),
      (e: Error) =>
        e instanceof LiveUrlProbeError && e.code === "LIVE_URL_REQUIRED",
    );
  });
});

describe("POST /api/live-url-probe", () => {
  it("GET returns catalog", async () => {
    const res = await liveUrlProbeGet();
    assert.equal(res.status, 200);
    const json = (await res.json()) as { kind: string; endpoint: string };
    assert.equal(json.kind, "live-url-probe-catalog");
    assert.match(json.endpoint, /live-url-probe/);
  });

  it("POST without liveUrl → 400", async () => {
    const req = new Request("http://localhost/api/live-url-probe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const res = await liveUrlProbePost(req);
    assert.equal(res.status, 400);
    const json = (await res.json()) as { code?: string; ok?: boolean };
    assert.equal(json.code, "LIVE_URL_REQUIRED");
    assert.equal(json.ok, false);
  });

  it("POST with liveUrl → real probe JSON (status · latency · modelCount)", async () => {
    await withMockModelsServer(
      (req, res) => {
        if (req.method === "GET" && req.url === "/v1/models") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ data: [{ id: "api-mock" }] }));
          return;
        }
        res.writeHead(404);
        res.end();
      },
      async (liveUrl) => {
        const req = new Request("http://localhost/api/live-url-probe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ liveUrl }),
        });
        const res = await liveUrlProbePost(req);
        assert.equal(res.status, 200);
        const payload = (await res.json()) as {
          schemaVersion: string;
          ok: boolean;
          provisioned: boolean;
          spendUsd: null;
          probe: {
            ok: boolean;
            httpStatus: number;
            latencyMs: number;
            modelCount: number;
          };
          nonClaims: Record<string, boolean>;
        };
        assert.equal(payload.schemaVersion, LIVE_URL_PROBE_SCHEMA);
        assert.equal(payload.ok, true);
        assert.equal(payload.provisioned, false);
        assert.equal(payload.spendUsd, null);
        assert.equal(payload.probe.ok, true);
        assert.equal(payload.probe.httpStatus, 200);
        assert.equal(typeof payload.probe.latencyMs, "number");
        assert.equal(payload.probe.modelCount, 1);
        assert.equal(payload.nonClaims.probeNotMeasuredA40ReProof, true);
        assert.doesNotMatch(
          JSON.stringify(payload),
          /"spendUsd"\s*:\s*[1-9]|create-pod/i,
        );
      },
    );
  });

  it("POST fail-closed on non-200 → 502 + probe fields", async () => {
    await withMockModelsServer(
      (req, res) => {
        if (req.method === "GET" && req.url === "/v1/models") {
          res.writeHead(500);
          res.end("boom");
          return;
        }
        res.writeHead(404);
        res.end();
      },
      async (liveUrl) => {
        const req = new Request("http://localhost/api/live-url-probe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ liveUrl }),
        });
        const res = await liveUrlProbePost(req);
        assert.equal(res.status, 502);
        const payload = (await res.json()) as {
          ok: boolean;
          code?: string;
          provisioned?: boolean;
          spendUsd?: null;
          probe?: { httpStatus: number | null; ok: boolean };
        };
        assert.equal(payload.ok, false);
        assert.equal(payload.code, "PROBE_HTTP_FAILED");
        assert.equal(payload.provisioned, false);
        assert.equal(payload.spendUsd, null);
        assert.equal(payload.probe?.ok, false);
        assert.equal(payload.probe?.httpStatus, 500);
      },
    );
  });

  it("POST refuses secret/provision fields", async () => {
    const req = new Request("http://localhost/api/live-url-probe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        liveUrl: "http://127.0.0.1:1/v1",
        RUNPOD_API_KEY: "x",
      }),
    });
    const res = await liveUrlProbePost(req);
    assert.equal(res.status, 403);
    const json = (await res.json()) as { code?: string };
    assert.equal(json.code, "SECRET_FIELD_REFUSED");
  });
});
