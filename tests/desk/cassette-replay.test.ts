/**
 * Desk cassette:replay — in-process prove door + API fail-closed.
 * Real fixture cassette; no GPU / RunPod.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  cassetteReplayCatalog,
  runCassetteReplay,
  CassetteReplayError,
  CASSETTE_REPLAY_SCHEMA,
  CASSETTE_REPLAY_REPO_ROOT,
} from "../../src/desk/cassette-replay.ts";
import {
  GET as cassetteReplayGet,
  POST as cassetteReplayPost,
} from "../../src/app/api/cassette-replay/route.ts";
import { RULES_CWE_89_CASSETTE } from "../../src/locate/index.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("Desk cassette:replay (in-process)", () => {
  it("catalog documents POST /api/cassette-replay + honesty", () => {
    const c = cassetteReplayCatalog();
    assert.equal(c.kind, "cassette-replay-catalog");
    assert.equal(c.schemaVersion, CASSETTE_REPLAY_SCHEMA);
    assert.match(c.endpoint, /\/api\/cassette-replay/);
    assert.match(c.command, /cassette:replay/);
    assert.equal(c.defaults.rankedFile, RULES_CWE_89_CASSETTE.rankedFile);
    assert.equal(c.defaults.findingCount, 1);
    assert.ok(c.honesty.some((h) => /fail-closed|assert mismatch/i.test(h)));
    assert.ok(c.honesty.some((h) => /no GPU|RunPod/i.test(h)));
  });

  it("runCassetteReplay returns pinned prove JSON (real fixture cassette)", async () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "zd-cr-ok-"));
    const payload = await runCassetteReplay({
      cwd: root,
      outputDir: out,
    });
    assert.equal(payload.schemaVersion, CASSETTE_REPLAY_SCHEMA);
    assert.equal(payload.ok, true);
    assert.equal(payload.exit, 0);
    assert.equal(payload.mode, "recording");
    assert.equal(payload.findingCount, 1);
    assert.equal(payload.rankedFile, "src/search.js");
    assert.equal(payload.cweId, "CWE-89");
    assert.equal(payload.sarifResultCount, 1);
    assert.match(payload.recording, /rules-cwe-89\.cassette\.json/);
    assert.equal(payload.nonClaims.needsHuman, true);
    assert.equal(payload.nonClaims.noGpuNoRunPod, true);
    assert.equal(payload.nonClaims.replayOnlyNoRecord, true);
    assert.ok(fs.existsSync(payload.reportPath));
    assert.ok(fs.existsSync(payload.sarifPath));
    assert.doesNotMatch(
      JSON.stringify(payload),
      /create-pod|RunPod create|AUROC\s*=/i,
    );
  });

  it("fail-closed on rankedFile assert mismatch (exit 2)", async () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "zd-cr-bad-"));
    await assert.rejects(
      () =>
        runCassetteReplay({
          cwd: root,
          outputDir: out,
          expectFile: "src/definitely-not-this.js",
        }),
      (e: unknown) => {
        assert.ok(e instanceof CassetteReplayError);
        assert.equal((e as CassetteReplayError).code, "ASSERT_MISMATCH");
        assert.equal((e as CassetteReplayError).exit, 2);
        assert.match((e as Error).message, /rankedFile|assert/i);
        return true;
      },
    );
  });

  it("fail-closed on findingCount mismatch", async () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "zd-cr-count-"));
    await assert.rejects(
      () =>
        runCassetteReplay({
          cwd: CASSETTE_REPLAY_REPO_ROOT,
          outputDir: out,
          expectFindings: 99,
        }),
      (e: unknown) =>
        e instanceof CassetteReplayError && e.code === "ASSERT_MISMATCH",
    );
  });
});

describe("POST /api/cassette-replay", () => {
  it("GET returns catalog", async () => {
    const res = await cassetteReplayGet();
    assert.equal(res.status, 200);
    const json = (await res.json()) as {
      kind: string;
      endpoint: string;
      command: string;
    };
    assert.equal(json.kind, "cassette-replay-catalog");
    assert.match(json.endpoint, /cassette-replay/);
    assert.match(json.command, /cassette:replay/);
  });

  it("POST returns pinned prove JSON (mode/findings/ranked/SARIF/exit)", async () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "zd-cr-api-"));
    const req = new Request("http://localhost/api/cassette-replay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outputDir: out }),
    });
    const res = await cassetteReplayPost(req);
    assert.equal(res.status, 200);
    const payload = (await res.json()) as {
      schemaVersion: string;
      ok: boolean;
      exit: number;
      mode: string;
      findingCount: number;
      rankedFile: string;
      sarifResultCount: number;
      cweId: string;
    };
    assert.equal(payload.schemaVersion, CASSETTE_REPLAY_SCHEMA);
    assert.equal(payload.ok, true);
    assert.equal(payload.exit, 0);
    assert.equal(payload.mode, "recording");
    assert.equal(payload.findingCount, 1);
    assert.equal(payload.rankedFile, "src/search.js");
    assert.equal(payload.sarifResultCount, 1);
    assert.equal(payload.cweId, "CWE-89");
  });

  it("POST fail-closed on expectFile mismatch (HTTP 422 · exit 2)", async () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "zd-cr-api-bad-"));
    const req = new Request("http://localhost/api/cassette-replay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        outputDir: out,
        expectFile: "src/wrong.js",
      }),
    });
    const res = await cassetteReplayPost(req);
    assert.equal(res.status, 422);
    const json = (await res.json()) as {
      ok: boolean;
      exit: number;
      code?: string;
      error: string;
    };
    assert.equal(json.ok, false);
    assert.equal(json.exit, 2);
    assert.equal(json.code, "ASSERT_MISMATCH");
    assert.match(json.error, /rankedFile|assert/i);
  });

  it("POST refuses secret/provision fields", async () => {
    const req = new Request("http://localhost/api/cassette-replay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ HF_TOKEN: "x", recording: "noop" }),
    });
    const res = await cassetteReplayPost(req);
    assert.equal(res.status, 403);
    const json = (await res.json()) as { code?: string; exit?: number };
    assert.equal(json.code, "SECRET_FIELD_REFUSED");
    assert.equal(json.exit, 2);
  });
});
