/**
 * Kernel localization benchmark: manifest shape and the hit@k scorer.
 * Offline — no kernel checkout, no network, no GPU.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rankedFromReport, scoreEntry, summarize, normalizePath, type KernelEntry } from "../../bench/kernel/score.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "bench/kernel/manifest.json"), "utf8")) as {
  schema: string;
  entries: Array<KernelEntry & { cweSource: string; fixDate: string }>;
};

const SHA = /^[0-9a-f]{40}$/;

describe("bench/kernel/manifest.json", () => {
  it("has 15–30 entries with the required fields", () => {
    assert.equal(manifest.schema, "zeroday.kernel-bench.manifest/v1");
    assert.ok(manifest.entries.length >= 15 && manifest.entries.length <= 30, `${manifest.entries.length} entries`);
    for (const e of manifest.entries) {
      assert.match(e.cve, /^CVE-\d{4}-\d{4,}$/);
      assert.match(e.cwe, /^CWE-\d+$/);
      for (const sha of [e.fixCommit, e.fixesCommit, e.parentCommit]) assert.match(sha, SHA, e.cve);
      assert.notEqual(e.fixCommit, e.parentCommit);
      assert.ok(e.fixDate > "2025-04-10", `${e.cve}: fix must postdate the Antares-1B training cutoff`);
      assert.match(e.cweSource, /^(?:nvd|cve-adp)$/);
      assert.match(e.file, /\.c$/);
      assert.ok(e.functions.length >= 1 && e.functions.length <= 2, e.cve);
      assert.equal(e.scope, path.posix.dirname(e.file));
      assert.ok(e.description.length > 0 && e.description.length <= 160, e.cve);
      assert.ok(!/\n|^[+-]|@@/.test(e.description), `${e.cve}: description must be a one-liner, not diff text`);
    }
  });

  it("has unique CVEs and one entry per scope", () => {
    const cves = manifest.entries.map((e) => e.cve);
    assert.equal(new Set(cves).size, cves.length);
    const scopes = manifest.entries.map((e) => e.scope);
    assert.equal(new Set(scopes).size, scopes.length);
  });
});

const entry: KernelEntry = {
  cve: "CVE-2000-0001",
  cwe: "CWE-416",
  description: "demo: fix a use-after-free",
  fixCommit: "a".repeat(40),
  fixesCommit: "b".repeat(40),
  parentCommit: "c".repeat(40),
  file: "net/demo/core.c",
  functions: ["demo_free"],
  scope: "net/demo",
};

const SRC = "static void demo_alloc(void)\n{\n}\n\nstatic void demo_free(void)\n{\n\tkfree(x);\n}\n";

describe("rankedFromReport", () => {
  it("reads report.json rank order and evidence functions", () => {
    const r = rankedFromReport({
      rankedFiles: [
        { filePath: "net/demo/core.c", rank: 2, evidence: [{ startLine: 7, function: "demo_free" }] },
        { filePath: "./net/demo/util.c", rank: 1, evidence: [{ function: "demo_util" }] },
      ],
    });
    assert.deepEqual(r.files, ["net/demo/util.c", "net/demo/core.c"]);
    assert.deepEqual(r.functions, ["net/demo/util.c::demo_util", "net/demo/core.c::demo_free"]);
  });

  it("maps evidence lines to functions from the pre-fix source when no name is given", () => {
    const r = rankedFromReport(
      { rankedFiles: [{ filePath: "net/demo/core.c", rank: 1, evidence: [{ startLine: 2 }, { startLine: 7 }] }] },
      (p) => (p === "net/demo/core.c" ? SRC : null),
    );
    assert.deepEqual(r.functions, ["net/demo/core.c::demo_alloc", "net/demo/core.c::demo_free"]);
  });

  it("reads SARIF results by submission_rank with logical locations", () => {
    const sarif = {
      version: "2.1.0",
      runs: [
        {
          results: [
            {
              locations: [{ physicalLocation: { artifactLocation: { uri: "net/demo/core.c" }, region: { startLine: 7 } } }],
              properties: { submission_rank: 2 },
            },
            {
              locations: [
                {
                  physicalLocation: { artifactLocation: { uri: "net/demo/other.c" } },
                  logicalLocations: [{ name: "demo_other", kind: "function" }],
                },
              ],
              properties: { submission_rank: 1 },
            },
          ],
        },
      ],
    };
    const r = rankedFromReport(sarif, (p) => (p === "net/demo/core.c" ? SRC : null));
    assert.deepEqual(r.files, ["net/demo/other.c", "net/demo/core.c"]);
    assert.deepEqual(r.functions, ["net/demo/other.c::demo_other", "net/demo/core.c::demo_free"]);
  });

  it("rejects unknown documents and normalizes snapshot paths", () => {
    assert.throws(() => rankedFromReport({ foo: 1 }));
    assert.equal(normalizePath("/snapshot/net/a.c"), "net/a.c");
    assert.equal(normalizePath("file:///tmp/x/snapshot/net/a.c"), "net/a.c");
  });
});

describe("scoreEntry / summarize", () => {
  it("scores file and function ranks independently", () => {
    const s = scoreEntry(entry, {
      files: ["net/demo/util.c", "net/demo/core.c"],
      functions: ["net/demo/util.c::x", "net/demo/core.c::demo_alloc", "net/demo/core.c::demo_free"],
    });
    assert.equal(s.fileRank, 2);
    assert.equal(s.functionRank, 3);
  });

  it("a function with the right name in the wrong file is not a hit", () => {
    const s = scoreEntry(entry, { files: ["net/demo/util.c"], functions: ["net/demo/util.c::demo_free"] });
    assert.equal(s.fileRank, null);
    assert.equal(s.functionRank, null);
  });

  it("computes hit@1/3/5 over all entries, counting missing reports as misses", () => {
    const scores = [
      scoreEntry(entry, { files: ["net/demo/core.c"], functions: ["net/demo/core.c::demo_free"] }),
      scoreEntry(entry, { files: ["a.c", "b.c", "c.c", "net/demo/core.c"], functions: [] }),
      scoreEntry(entry, null),
      scoreEntry(entry, { files: [], functions: [] }),
    ];
    const sum = summarize(scores);
    assert.equal(sum.entries, 4);
    assert.equal(sum.scored, 3);
    assert.equal(sum.missing, 1);
    assert.deepEqual(sum.file["hit@1"], { hits: 1, rate: 0.25 });
    assert.deepEqual(sum.file["hit@3"], { hits: 1, rate: 0.25 });
    assert.deepEqual(sum.file["hit@5"], { hits: 2, rate: 0.5 });
    assert.deepEqual(sum.function["hit@5"], { hits: 1, rate: 0.25 });
  });
});
