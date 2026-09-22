/**
 * Door F — fail-closed live-locate against local OpenAI-compatible /v1.
 *
 * Contract: missing/bad URL → clear failure; healthy mock → tool-calls + SARIF.
 * No GPU / HF weights / RunPod. No invented AUROC.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  LIVE_LOCATE_DOOR_SCHEMA,
  LiveLocateDoorError,
  liveLocateDoorCatalog,
  runLiveLocateDoor,
} from "../../src/desk/live-locate-door.ts";
import { runProveDoors } from "../../src/desk/prove-doors.ts";
import { startMockCompletionsServer } from "../../src/locate/index.ts";
import {
  GET as liveLocateGet,
  POST as liveLocatePost,
} from "../../src/app/api/live-locate-door/route.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("Door F live-locate-door (fail-closed contract)", () => {
  it("catalog documents endpoint + honesty + fail-closed", () => {
    const c = liveLocateDoorCatalog();
    assert.equal(c.kind, "live-locate-door-catalog");
    assert.equal(c.schemaVersion, LIVE_LOCATE_DOOR_SCHEMA);
    assert.match(c.endpoint, /\/api\/live-locate-door/);
    assert.match(c.cli, /live-locate-door/);
    assert.ok(c.honesty.some((h) => /fail-closed/i.test(h)));
    assert.ok(c.honesty.some((h) => /no RunPod|AUROC/i.test(h)));
    assert.ok(c.honesty.some((h) => /Door F skipped/i.test(h)));
  });

  it("fail-closed: missing endpoint throws LIVE_URL_REQUIRED", async () => {
    await assert.rejects(
      () =>
        runLiveLocateDoor({
          endpoint: "",
        }),
      (e: unknown) => {
        assert.ok(e instanceof LiveLocateDoorError);
        assert.equal((e as LiveLocateDoorError).code, "LIVE_URL_REQUIRED");
        assert.match((e as Error).message, /required|missing/i);
        assert.doesNotMatch((e as Error).message, /AUROC|File F1/);
        return true;
      },
    );
  });

  it("fail-closed: chat completions URL refused", async () => {
    await assert.rejects(
      () =>
        runLiveLocateDoor({
          endpoint: "http://127.0.0.1:8000/v1/chat/completions",
          mockAntares: true,
        }),
      (e: unknown) => {
        assert.ok(e instanceof LiveLocateDoorError);
        assert.equal((e as LiveLocateDoorError).code, "ENDPOINT_SHAPE");
        assert.match((e as Error).message, /chat|completions/i);
        return true;
      },
    );
  });

  it("fail-closed: unreachable endpoint", async () => {
    await assert.rejects(
      () =>
        runLiveLocateDoor({
          endpoint: "http://127.0.0.1:1/v1",
          mockAntares: true,
          outputDir: fs.mkdtempSync(path.join(os.tmpdir(), "zd-lld-bad-")),
        }),
      (e: unknown) => {
        assert.ok(e instanceof LiveLocateDoorError);
        assert.ok(
          (e as LiveLocateDoorError).code === "ENDPOINT_UNREACHABLE" ||
            (e as LiveLocateDoorError).code === "LOCATE_FAILED",
        );
        return true;
      },
    );
  });

  it("success: mock /v1 → tool-calls + SARIF (no GPU)", async () => {
    const server = await startMockCompletionsServer({
      modelId: "mock/antares-tool-calls",
    });
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "zd-lld-ok-"));
    try {
      const result = await runLiveLocateDoor({
        endpoint: server.endpoint,
        mockAntares: true,
        model: "mock/antares-tool-calls",
        outputDir: out,
        cwd: root,
      });
      assert.equal(result.schemaVersion, LIVE_LOCATE_DOOR_SCHEMA);
      assert.equal(result.ok, true);
      assert.equal(result.mode, "live");
      assert.equal(result.provisioned, false);
      assert.equal(result.spendUsd, null);
      assert.equal(result.mockAntares, true);
      assert.equal(result.toolCallsExercised, true);
      assert.ok(result.rankedFileCount >= 2);
      assert.ok(result.rankedFiles.includes("src/users.js"));
      assert.ok(fs.existsSync(result.sarifPath));
      assert.ok(result.sarifResultCount >= 1);
      assert.ok(fs.existsSync(result.reportPath));
      assert.ok(result.nonClaims.failClosedOnMissingOrBadUrl);
      assert.ok(result.nonClaims.noRunPodCreateFromLiveLocateDoor);
      assert.ok(result.nonClaims.notMeasuredA40ReProof);
      assert.doesNotMatch(JSON.stringify(result), /\bAUROC\b/);
      assert.ok(server.completionHits >= 2);
      assert.ok(server.modelsHits >= 1);
    } finally {
      await server.close();
      fs.rmSync(out, { recursive: true, force: true });
    }
  });

  it("prove-doors: Door F skipped without liveLocateUrl (keyless)", async () => {
    const result = await runProveDoors({
      cwd: root,
      strangerOutputDir: fs.mkdtempSync(path.join(os.tmpdir(), "zd-pf-a-")),
      cassetteOutputDir: fs.mkdtempSync(path.join(os.tmpdir(), "zd-pf-c-")),
    });
    assert.equal(result.ok, true);
    assert.equal(result.doors.f.status, "skipped");
    if (result.doors.f.status === "skipped") {
      assert.equal(result.doors.f.reason, "liveLocateUrl omitted");
      assert.equal(result.doors.f.provisioned, false);
      assert.equal(result.doors.f.spendUsd, null);
    }
    assert.equal(result.nonClaims.doorFLiveLocateOptInOnly, true);
  });

  it("prove-doors: Door F ok against mock completions", async () => {
    const server = await startMockCompletionsServer();
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "zd-pf-f-"));
    try {
      const result = await runProveDoors({
        cwd: root,
        liveLocateUrl: server.endpoint,
        liveLocateMockAntares: true,
        liveLocateOutputDir: out,
        strangerOutputDir: fs.mkdtempSync(path.join(os.tmpdir(), "zd-pf-a2-")),
        cassetteOutputDir: fs.mkdtempSync(path.join(os.tmpdir(), "zd-pf-c2-")),
      });
      assert.equal(result.ok, true);
      assert.equal(result.doors.f.status, "ok");
      if (result.doors.f.status === "ok") {
        assert.equal(result.doors.f.result.toolCallsExercised, true);
        assert.ok(result.doors.f.result.sarifResultCount >= 1);
        assert.equal(result.doors.f.result.provisioned, false);
      }
    } finally {
      await server.close();
      fs.rmSync(out, { recursive: true, force: true });
    }
  });

  it("prove-doors: Door F fail-closed on unreachable URL", async () => {
    const result = await runProveDoors({
      cwd: root,
      liveLocateUrl: "http://127.0.0.1:1/v1",
      liveLocateMockAntares: true,
      liveLocateOutputDir: fs.mkdtempSync(path.join(os.tmpdir(), "zd-pf-bad-")),
      strangerOutputDir: fs.mkdtempSync(path.join(os.tmpdir(), "zd-pf-a3-")),
      cassetteOutputDir: fs.mkdtempSync(path.join(os.tmpdir(), "zd-pf-c3-")),
    });
    assert.equal(result.ok, false);
    assert.equal(result.doors.f.status, "failed");
    if (result.doors.f.status === "failed") {
      assert.equal(result.doors.f.provisioned, false);
      assert.equal(result.doors.f.spendUsd, null);
      assert.ok(result.doors.f.error);
    }
  });

  it("API GET catalog + POST missing endpoint → 400 LIVE_URL_REQUIRED", async () => {
    const getRes = await liveLocateGet();
    assert.equal(getRes.status, 200);
    const catalog = await getRes.json();
    assert.equal(catalog.schemaVersion, LIVE_LOCATE_DOOR_SCHEMA);

    const miss = await liveLocatePost(
      new Request("http://localhost/api/live-locate-door", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
    );
    assert.equal(miss.status, 400);
    const body = await miss.json();
    assert.equal(body.ok, false);
    assert.equal(body.code, "LIVE_URL_REQUIRED");
    assert.equal(body.provisioned, false);
  });

  it("API POST healthy mock → tool-calls + SARIF JSON", async () => {
    const server = await startMockCompletionsServer();
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "zd-lld-api-"));
    try {
      const res = await liveLocatePost(
        new Request("http://localhost/api/live-locate-door", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoint: server.endpoint,
            mockAntares: true,
            outputDir: out,
          }),
        }),
      );
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.ok, true);
      assert.equal(body.schemaVersion, LIVE_LOCATE_DOOR_SCHEMA);
      assert.equal(body.toolCallsExercised, true);
      assert.ok(body.sarifResultCount >= 1);
      assert.equal(body.provisioned, false);
      assert.equal(body.spendUsd, null);
    } finally {
      await server.close();
      fs.rmSync(out, { recursive: true, force: true });
    }
  });

  it("CLI: missing --endpoint exits non-zero (commander required)", () => {
    const r = spawnSync(
      "npx",
      ["tsx", "cli/index.ts", "live-locate-door", "--json"],
      { cwd: root, encoding: "utf8", env: process.env },
    );
    assert.notEqual(r.status, 0);
  });

  it("CLI: healthy mock → JSON ok + SARIF path", async () => {
    const server = await startMockCompletionsServer();
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "zd-lld-cli-"));
    try {
      const r = spawnSync(
        "npx",
        [
          "tsx",
          "cli/index.ts",
          "live-locate-door",
          "--json",
          "--endpoint",
          server.endpoint,
          "--out",
          out,
          "--mock-antares",
        ],
        { cwd: root, encoding: "utf8", env: process.env },
      );
      assert.equal(r.status, 0, `stderr=${r.stderr}\nstdout=${r.stdout}`);
      const json = JSON.parse(r.stdout) as {
        ok: boolean;
        schemaVersion: string;
        toolCallsExercised: boolean;
        sarifPath: string;
        sarifResultCount: number;
        provisioned: boolean;
        spendUsd: null;
      };
      assert.equal(json.ok, true);
      assert.equal(json.schemaVersion, LIVE_LOCATE_DOOR_SCHEMA);
      assert.equal(json.toolCallsExercised, true);
      assert.ok(json.sarifResultCount >= 1);
      assert.ok(fs.existsSync(json.sarifPath));
      assert.equal(json.provisioned, false);
      assert.equal(json.spendUsd, null);
    } finally {
      await server.close();
      fs.rmSync(out, { recursive: true, force: true });
    }
  });

  it("CLI: unreachable endpoint exits non-zero with fail code", () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "zd-lld-cli-bad-"));
    try {
      const r = spawnSync(
        "npx",
        [
          "tsx",
          "cli/index.ts",
          "live-locate-door",
          "--json",
          "--endpoint",
          "http://127.0.0.1:1/v1",
          "--out",
          out,
        ],
        { cwd: root, encoding: "utf8", env: process.env },
      );
      assert.notEqual(r.status, 0);
      const json = JSON.parse(r.stdout) as {
        ok: boolean;
        code?: string;
        provisioned: false;
      };
      assert.equal(json.ok, false);
      assert.equal(json.provisioned, false);
      assert.ok(json.code);
    } finally {
      fs.rmSync(out, { recursive: true, force: true });
    }
  });
});
