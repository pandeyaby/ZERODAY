import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  classifyIncomplete,
  shouldFailOnIncomplete,
  resolveLiveToolBudget,
  shouldAttemptLiveRecovery,
  DEFAULT_LIVE_TOOL_BUDGET,
  LIVE_RECOVERY_TOOL_BUDGET,
  formatIncompleteCliBlock,
} from "../../src/locate/incomplete.ts";
import { adaptAntaresReport } from "../../src/locate/live.ts";
import { toHumanReport } from "../../src/locate/report.ts";
import { toPullRequestComment } from "../../src/locate/comment.ts";

describe("incomplete classification", () => {
  it("defaults live tool budget to 30", () => {
    const prev = process.env.ANTARES_TOOL_BUDGET;
    delete process.env.ANTARES_TOOL_BUDGET;
    try {
      assert.equal(DEFAULT_LIVE_TOOL_BUDGET, 30);
      assert.equal(resolveLiveToolBudget(), 30);
      assert.equal(resolveLiveToolBudget(12), 12);
      assert.equal(resolveLiveToolBudget(99), 50);
    } finally {
      if (prev === undefined) delete process.env.ANTARES_TOOL_BUDGET;
      else process.env.ANTARES_TOOL_BUDGET = prev;
    }
  });

  it("classifies Antares no-submit message as no_submit", () => {
    const c = classifyIncomplete({
      rankedFileCount: 0,
      submitted: false,
      rawIncompleteReason: "Model ended without an explicit final submission.",
      terminalCallsUsed: 7,
      terminalCallBudget: 15,
    });
    assert.equal(c.incomplete, true);
    assert.equal(c.class, "no_submit");
    assert.match(c.reason!, /explicit final submission|did not invent/i);
    assert.ok(c.tips.some((t) => /tool-budget/i.test(t)));
    assert.ok(c.tips.some((t) => /completions_server/i.test(t)));
  });

  it("classifies budget exhaustion", () => {
    const c = classifyIncomplete({
      rankedFileCount: 0,
      submitted: false,
      terminalCallsUsed: 30,
      terminalCallBudget: 30,
    });
    assert.equal(c.class, "budget_exhausted");
  });

  it("classifies timeout", () => {
    const c = classifyIncomplete({
      rankedFileCount: 0,
      submitted: false,
      timedOut: true,
      cliOutput: "ETIMEDOUT",
    });
    assert.equal(c.class, "timeout");
  });

  it("classifies endpoint errors", () => {
    const c = classifyIncomplete({
      rankedFileCount: 0,
      submitted: false,
      cliOutput: "ECONNREFUSED 127.0.0.1:8000",
    });
    assert.equal(c.class, "endpoint_error");
  });

  it("classifies parse failure", () => {
    const c = classifyIncomplete({
      rankedFileCount: 0,
      submitted: false,
      parseFailure: true,
    });
    assert.equal(c.class, "parse_failure");
  });

  it("complete when submit_no_vulnerability_found", () => {
    const c = classifyIncomplete({
      rankedFileCount: 0,
      submitted: true,
      rawIncompleteReason: null,
    });
    assert.equal(c.incomplete, false);
    assert.equal(c.class, null);
  });

  it("complete when raw findings exist even without explicit submit (Harden D)", () => {
    const c = classifyIncomplete({
      rankedFileCount: 1,
      submitted: false,
      rawIncompleteReason: null,
      terminalCallsUsed: 6,
      terminalCallBudget: 11,
    });
    assert.equal(c.incomplete, false);
    assert.equal(c.class, null);
    assert.equal(c.reason, null);
  });

  it("complete with findings even if Antares incomplete_reason text is present", () => {
    const c = classifyIncomplete({
      rankedFileCount: 1,
      submitted: false,
      rawIncompleteReason: "Model ended without an explicit final submission.",
    });
    assert.equal(c.incomplete, false);
    assert.equal(c.class, null);
  });

  it("fail-on-incomplete defaults true for live only", () => {
    assert.equal(
      shouldFailOnIncomplete({
        mode: "live",
        incomplete: true,
      }),
      true,
    );
    assert.equal(
      shouldFailOnIncomplete({
        mode: "fixture",
        incomplete: true,
      }),
      false,
    );
    assert.equal(
      shouldFailOnIncomplete({
        mode: "live",
        incomplete: true,
        failOnIncomplete: false,
      }),
      false,
    );
    assert.equal(
      shouldFailOnIncomplete({
        mode: "live",
        incomplete: false,
      }),
      false,
    );
  });

  it("recovery only for no_submit / budget / unknown", () => {
    assert.equal(shouldAttemptLiveRecovery("no_submit"), true);
    assert.equal(shouldAttemptLiveRecovery("budget_exhausted"), true);
    assert.equal(shouldAttemptLiveRecovery("timeout"), false);
    assert.equal(shouldAttemptLiveRecovery("endpoint_error"), false);
    assert.ok(LIVE_RECOVERY_TOOL_BUDGET >= DEFAULT_LIVE_TOOL_BUDGET);
  });

  it("formatIncompleteCliBlock lists next actions", () => {
    const block = formatIncompleteCliBlock({
      incomplete: true,
      class: "no_submit",
      reason: "Model ended without an explicit final submission.",
      tips: ["Raise --tool-budget", "Check /v1/completions"],
    });
    assert.match(block, /Incomplete class : no_submit/);
    assert.match(block, /Next actions/);
    assert.match(block, /Raise --tool-budget/);
  });
});

describe("adaptAntaresReport incomplete fields", () => {
  it("sets incompleteClass + tips for no-submit dry-run shape", () => {
    const result = adaptAntaresReport(
      {
        findings: [],
        summary: {
          incomplete_reason: "Model ended without an explicit final submission.",
          terminal_calls_used: 7,
        },
        metadata: { model: "fdtn-ai/antares-1b", terminal_call_budget: 15 },
        exploration_trace: [
          { step: 1, tool: "grep", command: "grep SELECT", summary: "search" },
        ],
      },
      {
        advisory: { kind: "cwe", id: "CWE-89", cweId: "CWE-89" },
        repo: "/tmp/demo",
        snapshotPath: "/tmp/snap",
        outputDir: "/tmp/out",
        model: "fdtn-ai/antares-1b",
        toolBudget: 30,
      },
    );
    assert.equal(result.rankedFiles.length, 0);
    assert.equal(result.summary.incompleteClass, "no_submit");
    assert.ok(result.summary.incompleteReason);
    assert.ok((result.summary.incompleteTips?.length ?? 0) >= 3);

    const md = toHumanReport(result);
    assert.match(md, /Incomplete localization/);
    assert.match(md, /`no_submit`/);
    assert.doesNotMatch(
      md,
      /_No vulnerable files submitted \(`submit_no_vulnerability_found`\)\./,
    );

    const comment = toPullRequestComment(result);
    assert.match(comment, /Incomplete localization/);
    assert.match(comment, /no_submit/);
  });

  it("Harden D: raw findings + missing submit → ranked file, not bare no_submit", () => {
    const result = adaptAntaresReport(
      {
        findings: [
          {
            file_path: "src/search.js",
            submission_rank: 1,
            cwe_ids: ["CWE-89"],
            title: "SQL concatenation candidate",
            rationale: "User input concatenated into a query string.",
            start_line: 12,
          },
        ],
        summary: {
          total_findings: 1,
          incomplete_reason: null,
          terminal_calls_used: 6,
          status: "complete",
        },
        metadata: { model: "fdtn-ai/antares-350m", terminal_call_budget: 11 },
        exploration_trace: [
          { step: 1, tool: "grep", command: "grep SELECT", summary: "hit" },
          {
            step: 2,
            tool: "cat",
            command: "cat src/search.js",
            summary: "read candidate",
          },
          // Partial tool failures — no submit_vulnerable_files in trace
        ],
      },
      {
        advisory: { kind: "cwe", id: "CWE-89", cweId: "CWE-89" },
        repo: "/tmp/demo",
        snapshotPath: "/tmp/snap",
        outputDir: "/tmp/out",
        model: "fdtn-ai/antares-350m",
        toolBudget: 30,
      },
    );

    assert.equal(result.rankedFiles.length, 1);
    assert.equal(result.rankedFiles[0].filePath, "src/search.js");
    assert.equal(result.summary.findingCount, 1);
    assert.equal(result.summary.incompleteReason, null);
    assert.equal(result.summary.incompleteClass, null);
    assert.ok(
      result.warnings.some((w) => /not bare no_submit/i.test(w)),
      "should warn that candidates came without submit_* in trace",
    );

    const md = toHumanReport(result);
    assert.match(md, /src\/search\.js/);
    assert.doesNotMatch(md, /### Incomplete localization/);
    assert.doesNotMatch(md, /`no_submit`/);

    const comment = toPullRequestComment(result);
    assert.match(comment, /src\/search\.js/);
    assert.doesNotMatch(comment, /Incomplete localization/);
    assert.match(comment, /Incomplete \| no/);
  });
});
