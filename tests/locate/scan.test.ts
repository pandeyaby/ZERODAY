/**
 * `zeroday scan`: every rules CWE on one snapshot, merged ranking, per-CWE
 * table, verifiable evidence. Antares is exercised live (bench / RunPod), not
 * here — these runs are rules-only on real fixture repositories.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scanContext, scanRepo } from "../../src/locate/scan.ts";
import type { RankedFile } from "../../src/locate/types.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const out = () => fs.mkdtempSync(path.join(os.tmpdir(), "zd-scan-"));

describe("zeroday scan", () => {
  it("runs every rules CWE on one repo and ranks files with their CWEs", async () => {
    const a = await scanRepo({ repo: path.join(root, "fixtures/locate/rules-sample"), outputDir: out(), antares: "off" });
    const s = a.result.summary.scan;
    assert.equal(s.cwesRules.length, 10);
    assert.equal(s.antares, null);
    assert.ok(a.result.rankedFiles.length >= 1);
    for (const f of a.result.rankedFiles) {
      assert.ok(f.cweIds.length >= 1);
      assert.deepEqual(f.sources, ["rules"]);
    }
    assert.equal(s.perCwe.find((r) => r.cwe === "CWE-89")!.rules >= 1, true);
    for (const p of [a.jsonPath, a.sarifPath, a.reportPath, a.manifestPath]) assert.ok(fs.existsSync(p), p);
    const md = fs.readFileSync(a.reportPath, "utf8");
    assert.match(md, /Human review required/);
    assert.match(md, /\| CWE-89 \| \d+ \| — \| — \|/);
    const sarif = JSON.parse(fs.readFileSync(a.sarifPath, "utf8")) as { runs: Array<{ results: unknown[] }> };
    assert.ok(sarif.runs[0]!.results.length >= 1);
  });

  it("says why Antares was not used instead of failing (auto), and fails when required", async () => {
    const repo = path.join(root, "fixtures/locate/rules-sample");
    const prev = { ...process.env };
    for (const k of ["ANTARES_ENDPOINT", "LOCATE_BASE_URL", "ZERODAY_ANTARES_BASE_URL"]) delete process.env[k];
    const cwd = process.cwd();
    process.chdir(out()); // no saved Desk endpoint here
    // Nothing listening on the usual local ports, even on a machine that runs
    // Antares in Ollama / vLLM / LM Studio.
    const realFetch = globalThis.fetch;
    globalThis.fetch = ((input: Parameters<typeof fetch>[0], init?: RequestInit) =>
      /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])[:/]/.test(String(input instanceof Request ? input.url : input))
        ? Promise.reject(new TypeError("fetch failed (test: no local server)"))
        : realFetch(input, init)) as typeof fetch;
    try {
      const a = await scanRepo({ repo, outputDir: out(), antares: "auto" });
      assert.equal(a.result.summary.scan.antares, null);
      assert.ok(a.result.summary.scan.antaresSkipped);
      assert.ok(a.result.warnings.some((w) => /Antares not used: .*zeroday antares up/.test(w)));
      await assert.rejects(scanRepo({ repo, outputDir: out(), antares: "require" }));
    } finally {
      globalThis.fetch = realFetch;
      process.chdir(cwd);
      Object.assign(process.env, prev);
    }
  });

  it("builds bounded Antares context from rules findings for the planned CWEs only", () => {
    const f = (p: string, line: number): RankedFile => ({
      filePath: p,
      rank: 1,
      cweIds: ["CWE-78"],
      title: "t",
      evidence: [{ filePath: p, startLine: line, note: "n" }],
    });
    const m = new Map([
      ["CWE-78", [f("a.py", 3), f("b.py", 9)]],
      ["CWE-89", [f("c.py", 1)]],
    ]);
    const q = scanContext(m, ["CWE-78", "CWE-409"]);
    assert.match(q, /- CWE-78: a\.py:3, b\.py:9/);
    assert.doesNotMatch(q, /CWE-89|c\.py/, "only CWEs Antares will investigate");
    assert.equal(scanContext(m, ["CWE-409"]), "");
  });
});
