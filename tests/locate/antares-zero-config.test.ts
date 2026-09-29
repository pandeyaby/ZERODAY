/**
 * Zero-config Antares: endpoint discovery for `--live`, and hybrid runs where
 * ZERODAY's static pass is Antares' starting context (`antares query --query`).
 * No GPU, no weights: a loopback completions mock and a fake `antares` binary.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { discoverLiveEndpoint, DiscoveryError } from "../../src/locate/discover.ts";
import { contextQuery } from "../../src/locate/hybrid.ts";
import { locate } from "../../src/locate/index.ts";
import { startMockCompletionsServer } from "../../src/locate/mock-completions.ts";
import type { LocalizationResult } from "../../src/locate/types.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const demoApp = path.join(root, "fixtures/locate/demo-app");

/** fetch stub: GET <base>/v1/models → the listed models; everything else refused. */
function modelsFetch(servers: Record<string, string[]>): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = String(input instanceof Request ? input.url : input);
    for (const [base, models] of Object.entries(servers)) {
      if (url === `${base}/v1/models`) {
        return new Response(JSON.stringify({ object: "list", data: models.map((id) => ({ id })) }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
    }
    throw new TypeError("fetch failed");
  }) as typeof fetch;
}

const emptyDir = () => fs.mkdtempSync(path.join(os.tmpdir(), "zd-discover-"));

describe("Antares endpoint discovery", () => {
  it("finds a local server that serves an Antares model", async () => {
    const d = await discoverLiveEndpoint({
      cwd: emptyDir(),
      env: {},
      fetchImpl: modelsFetch({ "http://127.0.0.1:11434": ["llama3.2", "antares-1b:q8_0"] }),
    });
    assert.equal(d.endpoint, "http://127.0.0.1:11434/v1");
    assert.equal(d.model, "antares-1b:q8_0");
    assert.equal(d.source, "local-probe");
    assert.match(d.detail, /Ollama/);
  });

  it("prefers vLLM on :8000 and honors --model", async () => {
    const f = modelsFetch({
      "http://127.0.0.1:8000": ["fdtn-ai/antares-1b"],
      "http://127.0.0.1:11434": ["antares-350m"],
    });
    assert.equal((await discoverLiveEndpoint({ cwd: emptyDir(), env: {}, fetchImpl: f })).model, "fdtn-ai/antares-1b");
    const d = await discoverLiveEndpoint({ cwd: emptyDir(), env: {}, fetchImpl: f, model: "antares-350m" });
    assert.equal(d.endpoint, "http://127.0.0.1:11434/v1");
  });

  it("uses the Desk's saved last-good Antares endpoint, with its remote ACK", async () => {
    const cwd = emptyDir();
    fs.mkdirSync(path.join(cwd, ".zeroday"));
    fs.writeFileSync(
      path.join(cwd, ".zeroday", "desk-endpoint.json"),
      JSON.stringify({
        endpoint: "http://127.0.0.1:11434/v1",
        model: "llama3.2",
        lastGoodAntares: { endpoint: "https://pod-8000.proxy.runpod.net/v1", model: "fdtn-ai/antares-1b", remoteInference: true },
      }),
    );
    const d = await discoverLiveEndpoint({
      cwd,
      env: {},
      fetchImpl: modelsFetch({ "https://pod-8000.proxy.runpod.net": ["fdtn-ai/antares-1b"] }),
    });
    assert.equal(d.source, "saved");
    assert.equal(d.endpoint, "https://pod-8000.proxy.runpod.net/v1");
    assert.equal(d.remoteInference, true);
    assert.match(d.detail, /remote-inference ACK from saved Desk config/);
  });

  it("never picks a non-Antares model on its own, and says what it saw", async () => {
    await assert.rejects(
      discoverLiveEndpoint({ cwd: emptyDir(), env: {}, fetchImpl: modelsFetch({ "http://127.0.0.1:11434": ["llama3.2"] }) }),
      (e: unknown) => {
        assert.ok(e instanceof DiscoveryError);
        assert.match(e.message, /Ollama at http:\/\/127\.0\.0\.1:11434\/v1 \(models: llama3\.2\)/);
        assert.match(e.message, /--rules/);
        return true;
      },
    );
    await assert.rejects(discoverLiveEndpoint({ cwd: emptyDir(), env: {}, fetchImpl: modelsFetch({}) }), /No local completions server is running/);
  });

  it("probes loopback only", async () => {
    const seen: string[] = [];
    const f = (async (input: string | URL | Request) => {
      seen.push(String(input));
      throw new TypeError("fetch failed");
    }) as typeof fetch;
    await assert.rejects(discoverLiveEndpoint({ cwd: emptyDir(), env: {}, fetchImpl: f }));
    assert.ok(seen.length > 0);
    for (const u of seen) assert.match(u, /^http:\/\/127\.0\.0\.1:\d+\/v1\/models$/);
  });
});

describe("hybrid context (ZERODAY static pass → Antares)", () => {
  it("summarizes dependency exposure and candidates in a bounded instruction", () => {
    const rules = {
      rankedFiles: Array.from({ length: 12 }, (_, i) => ({
        filePath: `src/f${i}.js`,
        rank: i + 1,
        cweIds: ["CWE-94"],
        title: "Calls `template` from lodash@4.17.15",
        evidence: [{ filePath: `src/f${i}.js`, startLine: i + 1, note: "n" }],
      })),
      summary: {
        advisoryMatch: {
          verdict: "affected",
          advisoryIds: ["GHSA-35jh-r3h4-6jhm"],
          packages: [{ ecosystem: "npm", name: "lodash", installed: "4.17.15", file: "package-lock.json", affected: true, fixed: "4.17.21" }],
          symbols: ["template"],
        },
      },
    } as unknown as LocalizationResult;
    const q = contextQuery({ kind: "cve", id: "CVE-2021-23337", cweId: "CWE-94" }, rules);
    assert.match(q, /Dependency check for CVE-2021-23337: affected — lodash@4\.17\.15 \(package-lock\.json\)/);
    assert.match(q, /Vulnerable functions named by the advisory: template/);
    assert.match(q, /1\. src\/f0\.js:1/);
    assert.doesNotMatch(q, /src\/f8\.js/, "at most 8 candidates");
    assert.match(q, /submit only files you confirm/);
    assert.ok(q.length <= 1500);
    assert.equal(contextQuery({ kind: "cwe", id: "CWE-89", cweId: "CWE-89" }, { rankedFiles: [], summary: {} } as unknown as LocalizationResult), "");
  });

  it("sends the static pass to Antares and marks agreement (mock Antares)", async () => {
    const server = await startMockCompletionsServer();
    try {
      const out = fs.mkdtempSync(path.join(os.tmpdir(), "zd-hybrid-"));
      const { result } = await locate({
        repo: demoApp,
        advisory: "CWE-89",
        endpoint: server.endpoint,
        mockAntares: true,
        model: "mock/antares-tool-calls",
        outputDir: out,
        liveRecovery: false,
        failOnIncomplete: false,
      });
      assert.match(server.posts[0]!.prompt ?? "", /ZERODAY pre-analysis for CWE-89/);
      assert.match(server.posts[0]!.prompt ?? "", /src\/users\.js:\d+/);
      assert.equal(result.mode, "live");
      assert.deepEqual(result.summary.hybrid?.agreed, ["src/users.js"]);
      assert.deepEqual(result.summary.hybrid?.antaresOnly, ["src/app.js"]);
      assert.deepEqual(result.rankedFiles.find((f) => f.filePath === "src/users.js")?.sources, ["antares", "rules"]);
      assert.deepEqual(result.rankedFiles.find((f) => f.filePath === "src/app.js")?.sources, ["antares"]);
      assert.ok(result.warnings.some((w) => /ZERODAY context sent to Antares/.test(w)));
    } finally {
      await server.close();
    }
  });

  it("--no-context runs Antares alone", async () => {
    const server = await startMockCompletionsServer();
    try {
      const { result } = await locate({
        repo: demoApp,
        advisory: "CWE-89",
        endpoint: server.endpoint,
        mockAntares: true,
        model: "mock/antares-tool-calls",
        outputDir: fs.mkdtempSync(path.join(os.tmpdir(), "zd-hybrid-")),
        liveRecovery: false,
        failOnIncomplete: false,
        context: false,
      });
      assert.doesNotMatch(server.posts[0]!.prompt ?? "", /ZERODAY pre-analysis/);
      assert.equal(result.summary.hybrid, undefined);
    } finally {
      await server.close();
    }
  });
});

describe("official Antares CLI wiring (fake binary)", () => {
  /** Stand-in for `antares`: records argv, writes an Antares-shaped report.json. */
  function fakeAntares(): { bin: string; argvFile: string } {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zd-fake-antares-"));
    const argvFile = path.join(dir, "argv.json");
    const bin = path.join(dir, "antares");
    fs.writeFileSync(
      bin,
      `#!/usr/bin/env node
const fs = require("fs"), path = require("path");
const a = process.argv.slice(2);
fs.writeFileSync(${JSON.stringify(argvFile)}, JSON.stringify(a));
const out = a[a.indexOf("--output") + 1];
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, "report.json"), JSON.stringify({
  findings: [{ file_path: "src/users.js", submission_rank: 1, cwe_ids: ["CWE-89"], title: "SQL built from request input", rationale: "name reaches db.query" }],
  summary: { total_findings: 1, tool_call_count: 13, failed_tool_calls: 1, duration_seconds: 15.1 },
  exploration_trace: [{ step: 1, tool: "grep", command: "grep -rn query src" }, { step: 2, tool: "submit_vulnerable_files", command: "submit" }],
}));
`,
    );
    fs.chmodSync(bin, 0o755);
    return { bin, argvFile };
  }

  it("--live with no endpoint: discovers the server, passes --query to antares", async () => {
    const { bin, argvFile } = fakeAntares();
    const artifacts = await locate({
      repo: demoApp,
      advisory: "CWE-89",
      live: true,
      antaresCliSource: bin,
      probeFetch: modelsFetch({ "http://127.0.0.1:8000": ["fdtn-ai/antares-1b"] }),
      outputDir: fs.mkdtempSync(path.join(os.tmpdir(), "zd-live-")),
      liveRecovery: false,
      failOnIncomplete: false,
    });
    const argv = JSON.parse(fs.readFileSync(argvFile, "utf8")) as string[];
    assert.equal(argv[argv.indexOf("--endpoint") + 1], "http://127.0.0.1:8000/v1/completions");
    assert.equal(argv[argv.indexOf("--model") + 1], "fdtn-ai/antares-1b");
    assert.match(argv[argv.indexOf("--query") + 1]!, /ZERODAY pre-analysis for CWE-89[\s\S]*src\/users\.js/);
    const r = artifacts.result;
    assert.equal(r.mode, "live");
    assert.ok(r.warnings.some((w) => /Endpoint discovered: Found vLLM at http:\/\/127\.0\.0\.1:8000\/v1/.test(w)));
    assert.deepEqual(r.summary.hybrid?.agreed, ["src/users.js"]);
    assert.equal(r.rankedFiles[0]!.evidence.some((e) => /^Rules agree:/.test(e.note)), true);
    assert.equal(r.summary.terminalCallsUsed, 13, "Antares' own tool_call_count, not the trace length");
  });
});
