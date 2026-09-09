import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  resolveLocateMode,
  assertLiveEndpointHealthy,
  MIXED_MODE_REFUSED,
  LIVE_ENDPOINT_REQUIRED,
  liveEndpointUnhealthyMessage,
} from "../../src/locate/live-guard.ts";
import { locate, defaultFixtureRepo } from "../../src/locate/index.ts";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

describe("live path refuses silent fixture fallback", () => {
  it("resolveLocateMode: default and --fixture → fixture", () => {
    assert.equal(resolveLocateMode({}), "fixture");
    assert.equal(resolveLocateMode({ fixture: true }), "fixture");
  });

  it("resolveLocateMode: --endpoint or --live+endpoint → live", () => {
    assert.equal(
      resolveLocateMode({ endpoint: "http://127.0.0.1:8000/v1" }),
      "live",
    );
    assert.equal(
      resolveLocateMode({
        live: true,
        endpoint: "http://127.0.0.1:8000/v1",
      }),
      "live",
    );
  });

  it("refuses --fixture combined with --endpoint/--live", () => {
    assert.throws(
      () =>
        resolveLocateMode({
          fixture: true,
          endpoint: "http://127.0.0.1:8000/v1",
        }),
      (e: Error) => e.message.includes("mixed mode") || e.message === MIXED_MODE_REFUSED,
    );
    assert.throws(
      () => resolveLocateMode({ fixture: true, live: true }),
      /mixed mode|Refusing/,
    );
  });

  it("refuses --live without --endpoint (no silent fixture)", () => {
    assert.throws(
      () => resolveLocateMode({ live: true }),
      (e: Error) =>
        e.message.includes("requires --endpoint") ||
        e.message === LIVE_ENDPOINT_REQUIRED,
    );
  });

  it("assertLiveEndpointHealthy hard-fails when probe is down", async () => {
    await assert.rejects(
      () =>
        assertLiveEndpointHealthy({
          endpoint: "http://127.0.0.1:8000/v1",
          probeResult: {
            ok: false,
            endpoint: "http://127.0.0.1:8000/v1/completions",
            modelsUrl: "http://127.0.0.1:8000/v1/models",
            detail: "GET http://127.0.0.1:8000/v1/models failed: fetch failed",
          },
        }),
      (e: Error) =>
        e.message.includes("No fixture/mock fallback") &&
        e.message.includes("unhealthy"),
    );
  });

  it("locate(--endpoint) fails closed when endpoint is down — never writes fixture", async () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-live-down-"));
    await assert.rejects(
      () =>
        locate({
          repo: defaultFixtureRepo(),
          advisory: "CWE-89",
          endpoint: "http://127.0.0.1:9/v1",
          outputDir: out,
          probeResult: {
            ok: false,
            endpoint: "http://127.0.0.1:9/v1/completions",
            modelsUrl: "http://127.0.0.1:9/v1/models",
            detail: "GET http://127.0.0.1:9/v1/models failed: ECONNREFUSED",
          },
        }),
      /No fixture\/mock fallback|unhealthy|Live locate refused/,
    );
    // Must not have produced a fixture report pretending to be live
    const jsonPath = path.join(out, "report.json");
    if (fs.existsSync(jsonPath)) {
      const report = JSON.parse(fs.readFileSync(jsonPath, "utf8")) as {
        mode?: string;
      };
      assert.notEqual(report.mode, "fixture");
      assert.notEqual(report.mode, "live");
    }
  });

  it("locate refuses mixed --fixture + --endpoint", async () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-mixed-"));
    await assert.rejects(
      () =>
        locate({
          repo: defaultFixtureRepo(),
          advisory: "CWE-89",
          fixture: true,
          endpoint: "http://127.0.0.1:8000/v1",
          outputDir: out,
        }),
      /mixed mode|Refusing/,
    );
  });

  it("unhealthy message documents helper script", () => {
    const msg = liveEndpointUnhealthyMessage("down");
    assert.match(msg, /quickstart-live\.sh/);
    assert.match(msg, /No fixture\/mock fallback/);
  });
});
