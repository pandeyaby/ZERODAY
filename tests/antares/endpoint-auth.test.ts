import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createPod, waitReady, writeState, type PodState } from "../../src/antares/runpod.ts";
import { antaresCliEnv, endpointApiKey, endpointAuthHeaders } from "../../src/locate/endpoint-auth.ts";
import { discoverLiveEndpoint } from "../../src/locate/discover.ts";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

const POD_ENDPOINT = "https://abc123-8000.proxy.runpod.net/v1";

function podDir(extra: Partial<PodState> = {}): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zd-pod-auth-"));
  writeState(
    {
      podId: "abc123",
      gpu: null,
      model: "fdtn-ai/antares-1b",
      endpoint: POD_ENDPOINT,
      apiKey: "zd-test-key",
      createdAt: new Date().toISOString(),
      deadline: new Date(Date.now() + 60_000).toISOString(),
      maxMinutes: 1,
      costPerHr: null,
      ...extra,
    },
    dir,
  );
  return dir;
}

describe("antares up: the pod's vLLM requires an API key", () => {
  it("createPod starts vLLM with a random --api-key and keeps it in the pod state", async () => {
    let body: { dockerStartCmd?: string[]; env?: Record<string, string> } = {};
    globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
      body = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ id: "abc123", costPerHr: 0.4 }), { status: 201 });
    }) as typeof fetch;
    const state = await createPod({ env: { RUNPOD_API_KEY: "rp", HF_TOKEN: "hf" } as unknown as NodeJS.ProcessEnv });
    const cmd = body.dockerStartCmd ?? [];
    const i = cmd.indexOf("--api-key");
    assert.ok(i >= 0, "vLLM gets --api-key");
    assert.equal(cmd[i + 1], state.apiKey);
    assert.match(state.apiKey ?? "", /^zd-[A-Za-z0-9_-]{32}$/);
    assert.ok(!Object.values(body.env ?? {}).includes(state.apiKey!), "key is not an env var on the pod");

    const second = await createPod({ env: { RUNPOD_API_KEY: "rp", HF_TOKEN: "hf" } as unknown as NodeJS.ProcessEnv });
    assert.notEqual(second.apiKey, state.apiKey, "a new key per pod");
  });

  it("the pod state file is readable by the owner only", { skip: process.platform === "win32" }, () => {
    const dir = podDir();
    const mode = fs.statSync(path.join(dir, ".zeroday", "antares-pod.json")).mode & 0o777;
    assert.equal(mode, 0o600);
  });

  it("waitReady sends the key", async () => {
    const seen: Array<string | null> = [];
    globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
      seen.push(new Headers(init?.headers).get("authorization"));
      return new Response(JSON.stringify({ data: [{ id: "fdtn-ai/antares-1b" }] }), { status: 200 });
    }) as typeof fetch;
    const ok = await waitReady({ endpoint: POD_ENDPOINT, model: "fdtn-ai/antares-1b", apiKey: "zd-k" } as PodState, { timeoutMs: 5000 });
    assert.equal(ok, true);
    assert.deepEqual(seen, ["Bearer zd-k"]);
  });
});

describe("endpoint API key lookup", () => {
  it("uses the pod's key only for the pod's endpoint", () => {
    const cwd = podDir();
    assert.equal(endpointApiKey(POD_ENDPOINT, { env: {}, cwd }), "zd-test-key");
    assert.equal(endpointApiKey("https://abc123-8000.proxy.runpod.net/v1/completions", { env: {}, cwd }), "zd-test-key");
    assert.equal(endpointApiKey("http://127.0.0.1:8000/v1", { env: {}, cwd }), undefined);
    assert.deepEqual(endpointAuthHeaders("http://127.0.0.1:8000/v1", { env: {}, cwd }), {});
  });

  it("ignores a deleted pod", () => {
    const cwd = podDir({ deletedAt: new Date().toISOString() });
    assert.equal(endpointApiKey(POD_ENDPOINT, { env: {}, cwd }), undefined);
  });

  it("ZERODAY_ENDPOINT_API_KEY / ANTARES_API_KEY win for any endpoint", () => {
    const cwd = podDir();
    assert.equal(endpointApiKey("http://127.0.0.1:8000/v1", { env: { ANTARES_API_KEY: "a" }, cwd }), "a");
    assert.equal(endpointApiKey(POD_ENDPOINT, { env: { ZERODAY_ENDPOINT_API_KEY: "z", ANTARES_API_KEY: "a" }, cwd }), "z");
  });

  it("passes the key to the Antares CLI as ANTARES_API_KEY", () => {
    const env = antaresCliEnv("http://127.0.0.1:8000/v1", { ANTARES_MODEL: "m" }, { ZERODAY_ENDPOINT_API_KEY: "z" });
    assert.equal(env.ANTARES_API_KEY, "z");
    assert.equal(env.ANTARES_MODEL, "m");
    const none = antaresCliEnv("http://127.0.0.1:8000/v1", {}, { PATH: "/bin" });
    assert.equal(none.ANTARES_API_KEY, undefined);
  });

  it("discovery lists the saved pod's models with its key", async () => {
    const cwd = podDir();
    fs.writeFileSync(
      path.join(cwd, ".zeroday", "desk-endpoint.json"),
      JSON.stringify({ lastGoodAntares: { endpoint: POD_ENDPOINT, model: "fdtn-ai/antares-1b", remoteInference: true } }),
    );
    const found = await discoverLiveEndpoint({
      cwd,
      env: {},
      fetchImpl: (async (url: unknown, init?: RequestInit) => {
        const auth = new Headers(init?.headers).get("authorization");
        if (String(url).startsWith("https://abc123") && auth === "Bearer zd-test-key") {
          return new Response(JSON.stringify({ data: [{ id: "fdtn-ai/antares-1b" }] }), { status: 200 });
        }
        return new Response("unauthorized", { status: 401 });
      }) as typeof fetch,
    });
    assert.equal(found.endpoint, POD_ENDPOINT);
    assert.equal(found.source, "saved");
  });
});
