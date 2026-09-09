import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_ANTARES_MODEL,
  resolveLiveModel,
} from "../../src/locate/model.ts";
import { adaptAntaresReport } from "../../src/locate/live.ts";
import { toHumanReport } from "../../src/locate/report.ts";
import { toPullRequestComment } from "../../src/locate/comment.ts";

describe("live model id default", () => {
  it("defaults to fdtn-ai/antares-1b when unset", () => {
    const prev = process.env.ANTARES_MODEL;
    delete process.env.ANTARES_MODEL;
    try {
      assert.equal(DEFAULT_ANTARES_MODEL, "fdtn-ai/antares-1b");
      assert.equal(resolveLiveModel(), "fdtn-ai/antares-1b");
      assert.equal(resolveLiveModel(""), "fdtn-ai/antares-1b");
      assert.equal(resolveLiveModel(null), "fdtn-ai/antares-1b");
    } finally {
      if (prev === undefined) delete process.env.ANTARES_MODEL;
      else process.env.ANTARES_MODEL = prev;
    }
  });

  it("honors explicit --model then ANTARES_MODEL", () => {
    const prev = process.env.ANTARES_MODEL;
    process.env.ANTARES_MODEL = "fdtn-ai/antares-350m";
    try {
      assert.equal(resolveLiveModel(), "fdtn-ai/antares-350m");
      assert.equal(resolveLiveModel("fdtn-ai/antares-1b"), "fdtn-ai/antares-1b");
    } finally {
      if (prev === undefined) delete process.env.ANTARES_MODEL;
      else process.env.ANTARES_MODEL = prev;
    }
  });
});

describe("incomplete Antares submission surfacing", () => {
  it("infers incomplete when no findings and no submit in trace", () => {
    const result = adaptAntaresReport(
      {
        findings: [],
        summary: { terminal_calls_used: 4 },
        metadata: { model: "fdtn-ai/antares-1b", terminal_call_budget: 15 },
        exploration_trace: [
          {
            step: 1,
            tool: "find",
            command: "find . -type f",
            summary: "listed files",
          },
        ],
      },
      {
        advisory: { kind: "cwe", id: "CWE-89", cweId: "CWE-89" },
        repo: "/tmp/demo",
        snapshotPath: "/tmp/snap",
        outputDir: "/tmp/out",
        model: "fdtn-ai/antares-1b",
      },
    );
    assert.equal(result.rankedFiles.length, 0);
    assert.ok(result.summary.incompleteReason);
    assert.match(result.summary.incompleteReason!, /submit_vulnerable_files|explicit final submission/i);
    assert.match(result.summary.incompleteReason!, /did not invent/i);
    assert.equal(result.summary.incompleteClass, "no_submit");
    assert.ok(
      (result.summary.incompleteTips ?? []).some((t) => /tool-budget/i.test(t)),
    );

    const md = toHumanReport(result);
    assert.match(md, /Incomplete localization/);
    assert.match(md, /will not invent findings/i);
    assert.match(md, /completions_server\.py/);
    assert.match(md, /--tool-budget/);
    // Must not present as a clean negative-only result
    assert.doesNotMatch(
      md,
      /_No vulnerable files submitted \(`submit_no_vulnerability_found`\)\./,
    );

    const comment = toPullRequestComment(result);
    assert.match(comment, /Incomplete localization/);
    assert.doesNotMatch(
      comment,
      /^No vulnerable files submitted \(`submit_no_vulnerability_found`\)\.$/m,
    );
  });

  it("does not mark incomplete when submit_no_vulnerability_found", () => {
    const result = adaptAntaresReport(
      {
        findings: [],
        summary: {},
        metadata: { model: "fdtn-ai/antares-1b" },
        exploration_trace: [
          {
            step: 1,
            tool: "submit",
            command: "submit_no_vulnerability_found",
            summary: "clean negative",
          },
        ],
      },
      {
        advisory: { kind: "cwe", id: "CWE-89", cweId: "CWE-89" },
        repo: "/tmp/demo",
        snapshotPath: "/tmp/snap",
        outputDir: "/tmp/out",
      },
    );
    assert.equal(result.summary.incompleteReason, null);
    const md = toHumanReport(result);
    assert.match(md, /submit_no_vulnerability_found/);
  });
});
