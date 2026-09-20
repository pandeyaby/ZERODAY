/**
 * Executable Antares / OpenAI-compatible locate path under mock completions.
 *
 * Spins a real loopback POST /v1/completions server that returns Antares-shaped
 * <tool_call> text, runs locate({ mockAntares: true, endpoint }), and asserts
 * tool-calls → submit → ranked files. No RunPod, no GPU, no invented F1/AUROC.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  locate,
  defaultFixtureRepo,
  parseAntaresToolCalls,
  formatAntaresToolCall,
  extractSubmittedFiles,
  startMockCompletionsServer,
  runMockAntaresQuery,
} from "../../src/locate/index.ts";
import { postCompletions } from "../../src/locate/completions.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("Antares tool_call parse (contract)", () => {
  it("parses terminal + submit_vulnerable_files blocks", () => {
    const text =
      formatAntaresToolCall("terminal", { command: "find . -type f" }) +
      "\n" +
      formatAntaresToolCall("submit_vulnerable_files", {
        files: ["src/users.js", "src/app.js"],
      });
    const calls = parseAntaresToolCalls(text);
    assert.equal(calls.length, 2);
    assert.equal(calls[0]!.name, "terminal");
    assert.equal(calls[0]!.arguments.command, "find . -type f");
    assert.equal(calls[1]!.name, "submit_vulnerable_files");
    assert.deepEqual(extractSubmittedFiles(calls[1]!), [
      "src/users.js",
      "src/app.js",
    ]);
  });

  it("does not soft-rewrite malformed tool JSON", () => {
    const text = `<tool_call>{"run":"termina","args":{}}</tool_call>`;
    const calls = parseAntaresToolCalls(text);
    // Missing name → skipped (no rewrite into terminal)
    assert.equal(calls.length, 0);
  });
});

describe("live locate against mock /v1/completions (tool-calls)", () => {
  it("POST completions returns tool_calls; locate yields ranked files + submit", async () => {
    const server = await startMockCompletionsServer({
      modelId: "mock/antares-tool-calls",
    });
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-live-tc-"));
    try {
      // Honest HTTP smoke: completions text must contain tool_call
      const smoke = await postCompletions({
        endpoint: server.endpoint,
        model: "mock/antares-tool-calls",
        prompt: "ping",
        maxTokens: 64,
      });
      assert.equal(smoke.ok, true);
      assert.match(smoke.text, /<tool_call>/);
      assert.ok(parseAntaresToolCalls(smoke.text).length >= 1);

      const artifacts = await locate({
        repo: defaultFixtureRepo(),
        advisory: "CWE-89",
        endpoint: server.endpoint,
        mockAntares: true,
        model: "mock/antares-tool-calls",
        outputDir: out,
        liveRecovery: false,
        failOnIncomplete: false,
      });

      assert.equal(artifacts.result.mode, "live");
      assert.ok(
        artifacts.result.rankedFiles.length >= 2,
        "expected ranked files from submit_vulnerable_files",
      );
      assert.ok(
        artifacts.result.rankedFiles.some((f) => f.filePath === "src/users.js"),
      );
      assert.ok(
        artifacts.result.rankedFiles.some((f) => f.filePath === "src/app.js"),
      );
      assert.equal(artifacts.result.summary.incompleteReason, null);
      assert.ok(
        artifacts.result.explorationTrace.some((t) => t.tool === "submit"),
        "explorationTrace must include submit tool",
      );
      assert.ok(
        artifacts.result.explorationTrace.some((t) =>
          /submit_vulnerable_files/i.test(t.command),
        ),
      );
      assert.ok(
        artifacts.result.warnings.some((w) => /mock Antares/i.test(w)),
      );
      assert.ok(server.modelsHits >= 1, "live probe must hit GET /v1/models");
      assert.ok(
        server.completionHits >= 2,
        `expected multi-turn completions, got ${server.completionHits}`,
      );
      assert.ok(
        server.posts.every((p) => p.stream !== true || p.stream === false),
      );

      const report = JSON.parse(
        fs.readFileSync(artifacts.jsonPath, "utf8"),
      ) as { mode: string; rankedFiles: unknown[] };
      assert.equal(report.mode, "live");
      assert.ok(report.rankedFiles.length >= 2);

      // Non-claims: no invented metrics / no provision language
      const blob = fs.readFileSync(artifacts.reportPath, "utf8");
      assert.doesNotMatch(blob, /\bAUROC\b/);
      assert.doesNotMatch(blob, /File F1\s*=\s*0\.\d+/);
      assert.doesNotMatch(blob, /create-pod|auto-provision/i);
    } finally {
      await server.close();
      fs.rmSync(out, { recursive: true, force: true });
    }
  });

  it("LOCATE_BASE_URL env drives endpoint for mock live path", async () => {
    const server = await startMockCompletionsServer();
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-live-env-"));
    const prev = process.env.LOCATE_BASE_URL;
    process.env.LOCATE_BASE_URL = server.endpoint;
    try {
      const artifacts = await locate({
        repo: path.join(root, "fixtures/locate/demo-app"),
        advisory: "CWE-89",
        mockAntares: true,
        model: "mock/antares-tool-calls",
        outputDir: out,
        liveRecovery: false,
      });
      assert.equal(artifacts.result.mode, "live");
      assert.ok(artifacts.result.rankedFiles.length >= 1);
      assert.ok(server.completionHits >= 1);
    } finally {
      if (prev === undefined) delete process.env.LOCATE_BASE_URL;
      else process.env.LOCATE_BASE_URL = prev;
      await server.close();
      fs.rmSync(out, { recursive: true, force: true });
    }
  });

  it("runMockAntaresQuery alone records tool_calls from mock server", async () => {
    const server = await startMockCompletionsServer();
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-mock-q-"));
    try {
      const result = await runMockAntaresQuery({
        snapshotPath: path.join(root, "fixtures/locate/demo-app"),
        outputDir: out,
        cweId: "CWE-89",
        endpoint: server.endpoint,
        model: "mock/antares-tool-calls",
      });
      assert.ok(result.toolCalls.length >= 3);
      assert.ok(result.toolCalls.some((c) => c.name === "terminal"));
      assert.ok(
        result.toolCalls.some((c) => c.name === "submit_vulnerable_files"),
      );
      assert.equal(result.submitted, true);
      assert.deepEqual(result.rankedFiles, ["src/users.js", "src/app.js"]);
      assert.ok(fs.existsSync(result.reportPath));
    } finally {
      await server.close();
      fs.rmSync(out, { recursive: true, force: true });
    }
  });

  it("chat completions URL is refused by live guard (not mock fallback)", async () => {
    await assert.rejects(
      () =>
        locate({
          repo: defaultFixtureRepo(),
          advisory: "CWE-89",
          endpoint: "http://127.0.0.1:8000/v1/chat/completions",
          mockAntares: true,
        }),
      /\/v1\/completions|chat/,
    );
  });
});
