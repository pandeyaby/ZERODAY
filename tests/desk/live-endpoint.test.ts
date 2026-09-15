/**
 * UI-3 Live brain wizard — save/load sandbox, doctor ping, spend/remote ACK,
 * chat-only refuse, token hygiene (never persist/return secrets).
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, beforeEach, afterEach } from "node:test";
import { fileURLToPath } from "node:url";
import { PathPolicyError } from "../../src/lib/path-policy.ts";
import {
  applyPreset,
  liveCatalog,
  loadLiveEndpointConfig,
  saveLiveEndpointConfig,
  runLiveAction,
  runLiveDoctor,
  runLiveLocate,
  LiveEndpointError,
  DESK_ENDPOINT_REL,
  DESK_ENDPOINT_SCHEMA,
} from "../../src/desk/live-endpoint.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function mkSandbox(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zd-live-"));
  // Mirror minimal fixtures so locate path checks can resolve relative samples
  fs.mkdirSync(path.join(dir, "fixtures", "locate", "rules-sample"), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(dir, "fixtures", "locate", "rules-sample", "app.js"),
    "const q = req.query.id; db.query('select ' + q);\n",
  );
  return dir;
}

describe("live endpoint wizard (UI-3)", () => {
  let cwd: string;

  beforeEach(() => {
    cwd = mkSandbox();
  });

  afterEach(() => {
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  it("catalog lists presets + spend banner + honesty (UI-2 clarify)", () => {
    const c = liveCatalog({ cwd });
    assert.equal(c.kind, "live-catalog");
    assert.equal(c.schema, DESK_ENDPOINT_SCHEMA);
    assert.ok(c.presets.some((p) => p.id === "antares-1b"));
    assert.ok(c.presets.some((p) => p.id === "local-openai"));
    assert.ok(c.presets.find((p) => p.id === "antares-1b")?.hfGated);
    assert.match(c.spendBanner, /spend|confirm|GPU/i);
    assert.ok(c.honesty.some((h) => /UI-2/i.test(h)));
    assert.ok(c.configPath.endsWith(DESK_ENDPOINT_REL));
    assert.ok(c.configPath.startsWith(cwd));
  });

  it("save/load under sandboxed .zeroday/desk-endpoint.json", () => {
    const saved = saveLiveEndpointConfig(
      {
        preset: "antares-1b",
        endpoint: "http://127.0.0.1:8000/v1",
        model: "fdtn-ai/antares-1b",
        remoteInference: false,
        tokenEnvVar: "HF_TOKEN",
      },
      { cwd },
    );
    assert.equal(saved.kind, "live-save");
    assert.ok(fs.existsSync(saved.configPath));
    assert.ok(saved.configPath.includes(".zeroday"));
    assert.equal(saved.config.tokenEnvVar, "HF_TOKEN");
    assert.equal(saved.config.schema, DESK_ENDPOINT_SCHEMA);

    const raw = fs.readFileSync(saved.configPath, "utf8");
    assert.doesNotMatch(raw, /hf_[A-Za-z0-9]{10,}/);
    assert.match(raw, /"tokenEnvVar": "HF_TOKEN"/);

    const loaded = loadLiveEndpointConfig({ cwd });
    assert.equal(loaded.exists, true);
    assert.equal(loaded.config?.endpoint, "http://127.0.0.1:8000/v1");
    assert.equal(loaded.config?.model, "fdtn-ai/antares-1b");
  });

  it("applyPreset fills Antares + local OpenAI defaults", () => {
    const a = applyPreset("antares-1b");
    assert.equal(a.model, "fdtn-ai/antares-1b");
    assert.equal(a.tokenEnvVar, "HF_TOKEN");
    const l = applyPreset("local-openai");
    assert.match(l.endpoint, /11434|127\.0\.0\.1/);
    assert.equal(l.preset, "local-openai");
  });

  it("refuses chat-only endpoint shapes on save", () => {
    assert.throws(
      () =>
        saveLiveEndpointConfig(
          {
            endpoint: "http://127.0.0.1:8000/v1/chat/completions",
            model: "x",
          },
          { cwd },
        ),
      (e: Error) =>
        e instanceof LiveEndpointError || /chat/i.test(e.message),
    );
  });

  it("refuses storing secret-looking tokenEnvVar values", () => {
    assert.throws(
      () =>
        saveLiveEndpointConfig(
          {
            endpoint: "http://127.0.0.1:8000/v1",
            model: "x",
            tokenEnvVar: "hf_AbCdEfGhIjKlMnOpQrStUvWx",
          },
          { cwd },
        ),
      (e: Error) =>
        e instanceof LiveEndpointError && e.code === "TOKEN_ENV_REFUSED",
    );
  });

  it("doctor ping uses shape + mocked probe (pass checklist)", async () => {
    const r = await runLiveDoctor({
      action: "doctor",
      endpoint: "http://127.0.0.1:8000/v1",
      model: "fdtn-ai/antares-1b",
      remoteInference: false,
      cwd,
      probeResult: {
        ok: true,
        endpoint: "http://127.0.0.1:8000/v1/completions",
        modelsUrl: "http://127.0.0.1:8000/v1/models",
        detail: "GET mocked → 200 (1 model(s))",
        modelIds: ["fdtn-ai/antares-1b"],
      },
    });
    assert.equal(r.kind, "live-doctor");
    assert.equal(r.ok, true);
    assert.ok(r.checks.every((c) => c.ok));
    assert.ok(r.checks.some((c) => c.id === "endpoint-ping"));
  });

  it("doctor fails chat-only without network", async () => {
    const r = await runLiveDoctor({
      action: "doctor",
      endpoint: "http://127.0.0.1:11434/v1/chat/completions",
      cwd,
    });
    assert.equal(r.ok, false);
    assert.ok(r.checks.some((c) => c.id === "completions-shape" && !c.ok));
  });

  it("doctor flags missing remote ACK on non-loopback", async () => {
    const r = await runLiveDoctor({
      action: "doctor",
      endpoint: "https://gpu.example.com:8000/v1",
      remoteInference: false,
      cwd,
      probeResult: {
        ok: true,
        endpoint: "https://gpu.example.com:8000/v1/completions",
        modelsUrl: "https://gpu.example.com:8000/v1/models",
        detail: "ok",
      },
    });
    assert.equal(r.ok, false);
    const ack = r.checks.find((c) => c.id === "loopback-or-ack");
    assert.ok(ack && !ack.ok);
    assert.match(ack.detail, /remote/i);
  });

  it("locate refuses without spendAcknowledged", async () => {
    await assert.rejects(
      () =>
        runLiveLocate({
          action: "locate",
          endpoint: "http://127.0.0.1:8000/v1",
          model: "fdtn-ai/antares-1b",
          repo: "fixtures/locate/rules-sample",
          spendAcknowledged: false,
          cwd,
        }),
      (e: Error) =>
        e instanceof LiveEndpointError && e.code === "SPEND_ACK_REQUIRED",
    );
  });

  it("locate refuses non-loopback without remote-inference ACK", async () => {
    await assert.rejects(
      () =>
        runLiveLocate({
          action: "locate",
          endpoint: "https://gpu.example.com:8000/v1",
          model: "fdtn-ai/antares-1b",
          repo: "fixtures/locate/rules-sample",
          remoteInference: false,
          spendAcknowledged: true,
          cwd,
        }),
      (e: Error) => /remote-inference|REMOTE_INFERENCE/i.test(e.message),
    );
  });

  it("locate refuses chat-only URL", async () => {
    await assert.rejects(
      () =>
        runLiveLocate({
          action: "locate",
          endpoint: "http://127.0.0.1:8000/v1/chat/completions",
          model: "x",
          repo: "fixtures/locate/rules-sample",
          spendAcknowledged: true,
          cwd,
        }),
      (e: Error) => /chat/i.test(e.message),
    );
  });

  it("save refuses writing env secret value into config file", () => {
    const prev = process.env.HF_TOKEN;
    process.env.HF_TOKEN = "hf_SECRETVALUE_DO_NOT_WRITE_12345";
    try {
      // Config only stores env var name — file must not contain the secret
      const saved = saveLiveEndpointConfig(
        {
          endpoint: "http://127.0.0.1:8000/v1",
          model: "fdtn-ai/antares-1b",
          tokenEnvVar: "HF_TOKEN",
        },
        { cwd },
      );
      const text = fs.readFileSync(saved.configPath, "utf8");
      assert.equal(text.includes(process.env.HF_TOKEN!), false);
      assert.match(text, /HF_TOKEN/);
    } finally {
      if (prev === undefined) delete process.env.HF_TOKEN;
      else process.env.HF_TOKEN = prev;
    }
  });

  it("runLiveAction save+load round-trip via action API", async () => {
    const saved = await runLiveAction({
      action: "save",
      preset: "local-openai",
      cwd,
    });
    assert.equal(saved.kind, "live-save");
    const loaded = await runLiveAction({ action: "load", cwd });
    assert.equal(loaded.kind, "live-load");
    assert.equal(
      (loaded as { exists: boolean }).exists,
      true,
    );
  });

  it("config path stays under sandbox cwd (no escape)", () => {
    const c = liveCatalog({ cwd });
    assert.ok(c.configPath.startsWith(cwd));
    assert.ok(!c.configPath.includes(".."));
  });

  it("repo path escape refused on locate before spend work", async () => {
    await assert.rejects(
      () =>
        runLiveLocate({
          action: "locate",
          endpoint: "http://127.0.0.1:8000/v1",
          model: "x",
          repo: "/tmp",
          spendAcknowledged: true,
          cwd,
          locateProbeResult: {
            ok: true,
            endpoint: "http://127.0.0.1:8000/v1/completions",
            modelsUrl: "http://127.0.0.1:8000/v1/models",
            detail: "ok",
          },
        }),
      (e: Error) =>
        e instanceof PathPolicyError || /escapes sandbox/i.test(e.message),
    );
  });
});
