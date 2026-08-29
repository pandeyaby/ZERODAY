import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { toPullRequestComment } from "../../src/locate/comment.ts";
import { runFixtureLocalization } from "../../src/locate/fixture.ts";
import { checkNoExploitInvariant } from "../../src/locate/invariant.ts";

describe("PR comment formatter", () => {
  it("includes ranked files, evidence, and human-in-the-loop posture", () => {
    const result = runFixtureLocalization(
      { kind: "cwe", id: "CWE-89", cweId: "CWE-89" },
      "/tmp/demo",
    );
    const md = toPullRequestComment(result);
    assert.match(md, /Human review required/);
    assert.match(md, /proof of exploitability/i);
    assert.match(md, /src\/users\.js/);
    assert.match(md, /Ranked candidate files/);
    assert.match(md, /Exploration trace/);
    assert.equal(checkNoExploitInvariant([md]).length, 0);
  });

  it("handles empty findings", () => {
    const md = toPullRequestComment({
      mode: "fixture",
      advisory: { kind: "cwe", id: "CWE-89", cweId: "CWE-89" },
      targetRepo: "/tmp/demo",
      model: "fixture",
      generatedAt: new Date().toISOString(),
      rankedFiles: [],
      explorationTrace: [],
      warnings: [],
      posture: {
        localizationOnly: true,
        notExploitProof: true,
        noAutoMerge: true,
        noPoC: true,
      },
      summary: {
        findingCount: 0,
        incompleteReason: null,
        terminalCallBudget: 15,
        terminalCallsUsed: 0,
      },
    });
    assert.match(md, /No vulnerable files submitted/);
  });
});
