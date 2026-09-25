import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { toSarif, isValidSarifShape } from "../../src/locate/sarif.ts";
import type { LocalizationResult } from "../../src/locate/types.ts";

function sampleResult(overrides?: Partial<LocalizationResult>): LocalizationResult {
  return {
    mode: "fixture",
    advisory: {
      kind: "cwe",
      id: "CWE-89",
      cweId: "CWE-89",
      title: "SQL Injection",
    },
    targetRepo: "/tmp/demo",
    model: "fixture/antares-1b-recorded",
    generatedAt: "2026-01-01T00:00:00.000Z",
    rankedFiles: [
      {
        filePath: "src/users.js",
        rank: 1,
        cweIds: ["CWE-89"],
        title: "SQL concatenation",
        evidence: [
          {
            filePath: "src/users.js",
            startLine: 8,
            note: "string concat into SQL",
          },
        ],
      },
    ],
    explorationTrace: [
      {
        step: 1,
        tool: "grep",
        command: "grep SELECT",
        summary: "found SQL",
      },
    ],
    warnings: [],
    posture: {
      localizationOnly: true,
      notExploitProof: true,
      noAutoMerge: true,
      noPoC: true,
    },
    summary: {
      findingCount: 1,
      incompleteReason: null,
      terminalCallBudget: 15,
      terminalCallsUsed: 1,
    },
    ...overrides,
  };
}

describe("SARIF emitter", () => {
  it("emits valid SARIF 2.1.0 shape", () => {
    const sarif = toSarif(sampleResult());
    assert.equal(isValidSarifShape(sarif), true);
    assert.equal(sarif.version, "2.1.0");
    assert.equal(sarif.runs[0].tool.driver.name, "ZERODAY");
    assert.equal(sarif.runs[0].results.length, 1);
    assert.equal(sarif.runs[0].results[0].ruleId, "CWE-89");
    assert.equal(sarif.runs[0].results[0].level, "note");
    assert.equal(
      sarif.runs[0].results[0].locations[0].physicalLocation.artifactLocation.uri,
      "src/users.js",
    );
    assert.equal(
      sarif.runs[0].results[0].locations[0].physicalLocation.region?.startLine,
      8,
    );
  });

  it("includes posture in run properties", () => {
    const sarif = toSarif(sampleResult());
    const posture = sarif.runs[0].properties.posture as {
      noPoC?: boolean;
      localizationOnly?: boolean;
    };
    assert.equal(posture.noPoC, true);
    assert.equal(posture.localizationOnly, true);
  });

  it("emits empty results when no findings", () => {
    const sarif = toSarif(
      sampleResult({
        rankedFiles: [],
        summary: {
          findingCount: 0,
          incompleteReason: null,
          terminalCallBudget: 15,
          terminalCallsUsed: 2,
        },
      }),
    );
    assert.equal(isValidSarifShape(sarif), true);
    assert.equal(sarif.runs[0].results.length, 0);
    assert.ok(sarif.runs[0].tool.driver.rules.length >= 1);
  });

  it("rejects non-SARIF objects", () => {
    assert.equal(isValidSarifShape({}), false);
    assert.equal(isValidSarifShape(null), false);
  });
});
