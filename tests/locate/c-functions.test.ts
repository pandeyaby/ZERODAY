/**
 * C support for localization: function extraction, evidence annotation,
 * SARIF logical locations, and .c / .h as candidate source files.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  annotateCFunctions,
  blankCNoise,
  enclosingCFunction,
  extractCFunctions,
  isCPath,
} from "../../src/locate/c-functions.ts";
import { walkSourceFiles } from "../../src/locate/rules/walk.ts";
import { toSarif } from "../../src/locate/sarif.ts";
import { runRulesLocalization } from "../../src/locate/rules/index.ts";
import type { LocalizationResult } from "../../src/locate/types.ts";

const SAMPLE = `// SPDX-License-Identifier: GPL-2.0
#include <linux/module.h>
#define WRAP(x) \\
	do { x; } while (0)

static const struct file_operations demo_fops = {
	.owner = THIS_MODULE,
};

struct demo { int a; };
static int demo_proto(int a);

/* a comment with { braces } */
static int __init demo_init(void)
{
	const char *s = "}{";
	char c = '{';

	if (s[0] == c) {
		return 1;
	}
	return 0;
}

SYSCALL_DEFINE2(demo_call, int, a, int, b)
{
	return a + b;
}

static void demo_lock(struct demo *d) __acquires(&d->lock)
{
#ifdef CONFIG_DEMO
	if (d->a) {
#else
	if (!d->a) {
#endif
		d->a++;
	}
}

static int
demo_split_signature(struct demo *d,
		     int flags)
{
	return flags;
}
`;

describe("extractCFunctions", () => {
  const fns = extractCFunctions(SAMPLE);

  it("finds top-level definitions in order, skipping initializers, structs and prototypes", () => {
    assert.deepEqual(
      fns.map((f) => f.name),
      ["demo_init", "demo_call", "demo_lock", "demo_split_signature"],
    );
  });

  it("gives 1-based spans from signature to closing brace", () => {
    const lines = SAMPLE.split("\n");
    const init = fns.find((f) => f.name === "demo_init")!;
    assert.match(lines[init.startLine - 1]!, /demo_init\(void\)/);
    assert.equal(lines[init.endLine - 1], "}");
    const split = fns.find((f) => f.name === "demo_split_signature")!;
    assert.equal(lines[split.startLine - 1], "static int");
  });

  it("keeps braces balanced across #ifdef / #else branches", () => {
    const lock = fns.find((f) => f.name === "demo_lock")!;
    assert.equal(SAMPLE.split("\n")[lock.endLine - 1], "}");
    assert.ok(fns.some((f) => f.name === "demo_split_signature"));
  });

  it("blanks comments, literals and directives without moving lines", () => {
    const blanked = blankCNoise(SAMPLE);
    assert.equal(blanked.length, SAMPLE.length);
    assert.equal(blanked.split("\n").length, SAMPLE.split("\n").length);
    assert.ok(!blanked.includes("braces"));
    assert.ok(!blanked.includes("#include"));
  });

  it("maps a line to its enclosing function", () => {
    const line = SAMPLE.split("\n").findIndex((l) => l.includes("return a + b")) + 1;
    assert.equal(enclosingCFunction(fns, line)?.name, "demo_call");
    assert.equal(enclosingCFunction(fns, 1), undefined);
  });

  it("returns nothing for empty or non-function input", () => {
    assert.deepEqual(extractCFunctions(""), []);
    assert.deepEqual(extractCFunctions("int x = 1;\nstruct s { int a; };\n"), []);
  });
});

describe("C as a localization target", () => {
  it("isCPath accepts .c / .h only", () => {
    assert.ok(isCPath("net/sched/act_api.c"));
    assert.ok(isCPath("include/linux/skbuff.h"));
    assert.ok(!isCPath("src/app.ts"));
    assert.ok(!isCPath("lib/foo.cc"));
  });

  it("rules walk lists .c and .h files as candidates", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-c-walk-"));
    fs.mkdirSync(path.join(dir, "net"));
    fs.writeFileSync(path.join(dir, "net/demo.c"), SAMPLE);
    fs.writeFileSync(path.join(dir, "net/demo.h"), "int demo(void);\n");
    fs.writeFileSync(path.join(dir, "README"), "x\n");
    const rel = walkSourceFiles(dir).files.map((f) => f.relPath).sort();
    assert.deepEqual(rel, ["net/demo.c", "net/demo.h"]);
  });

  it("annotateCFunctions tags evidence lines with the enclosing function", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-c-annot-"));
    fs.writeFileSync(path.join(dir, "demo.c"), SAMPLE);
    const line = SAMPLE.split("\n").findIndex((l) => l.includes("d->a++")) + 1;
    const result = {
      rankedFiles: [
        { filePath: "demo.c", evidence: [{ startLine: line, note: "x" }, { note: "no line" }] as Array<{ startLine?: number; note: string; function?: string }> },
        { filePath: "missing.c", evidence: [{ startLine: 3, note: "unreadable" }] as Array<{ startLine?: number; note: string; function?: string }> },
        { filePath: "app.ts", evidence: [{ startLine: 3, note: "not C" }] as Array<{ startLine?: number; note: string; function?: string }> },
      ],
    };
    annotateCFunctions(result, dir);
    assert.equal(result.rankedFiles[0]!.evidence[0]!.function, "demo_lock");
    assert.equal(result.rankedFiles[0]!.evidence[1]!.function, undefined);
    assert.equal(result.rankedFiles[1]!.evidence[0]!.function, undefined);
    assert.equal(result.rankedFiles[2]!.evidence[0]!.function, undefined);
  });

  it("SARIF carries the function as a logical location", () => {
    const result = {
      mode: "rules",
      advisory: { kind: "cwe", id: "CWE-416", cweId: "CWE-416" },
      targetRepo: "/tmp/repo",
      model: "test",
      generatedAt: "2026-01-01T00:00:00Z",
      rankedFiles: [
        {
          filePath: "net/demo.c",
          rank: 1,
          cweIds: ["CWE-416"],
          title: "candidate",
          evidence: [{ filePath: "net/demo.c", startLine: 10, note: "n", function: "demo_lock" }],
        },
      ],
      explorationTrace: [],
      warnings: [],
      posture: { localizationOnly: true, notExploitProof: true, noAutoMerge: true, noPoC: true },
      summary: { findingCount: 1, incompleteReason: null, terminalCallBudget: 0, terminalCallsUsed: 0 },
    } as LocalizationResult;
    const sarif = toSarif(result);
    const r = sarif.runs[0]!.results[0]!;
    assert.deepEqual(r.locations[0]!.logicalLocations, [{ name: "demo_lock", kind: "function" }]);
    assert.deepEqual(r.properties.functions, ["demo_lock"]);
  });

  it("keyless rules mode still runs on a C tree (unsupported CWE is reported, not a clean negative)", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-c-rules-"));
    fs.writeFileSync(path.join(dir, "demo.c"), SAMPLE);
    const res = await runRulesLocalization({ kind: "cwe", id: "CWE-416", cweId: "CWE-416" }, dir, { offline: true });
    assert.equal(res.mode, "rules");
    assert.equal(res.summary.unsupportedCwe, true);
    assert.equal(res.rankedFiles.length, 0);
  });
});
