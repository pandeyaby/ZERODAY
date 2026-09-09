import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  playgroundCatalog,
  runPlaygroundLocate,
  runPlaygroundClassify,
  runPlaygroundDemo,
} from "../../src/playground/index.ts";

const OUT = path.join("zeroday-reports", "test-playground");

describe("playground (fixture-only)", () => {
  it("catalog lists classify scenarios and honesty rails", () => {
    const c = playgroundCatalog();
    assert.equal(c.mode, "fixture");
    assert.ok(c.classifyScenarios.includes("possible_breach"));
    assert.ok(c.classifyScenarios.includes("needs_human"));
    assert.ok(!c.classifyScenarios.includes("mixed"));
    assert.ok(c.honesty.some((h) => /agent-misfire/i.test(h)));
  });

  it("locate CWE-89 returns SARIF summary + Splunk snippet + report markdown", async () => {
    const r = await runPlaygroundLocate({
      outputDir: path.join(OUT, "locate"),
    });
    assert.equal(r.kind, "locate");
    assert.equal(r.mode, "fixture");
    assert.equal(r.cweId, "CWE-89");
    assert.ok(r.findingCount >= 1);
    assert.ok(r.sarifSummary.resultCount >= 1);
    assert.equal(r.sarifSummary.level, "note");
    assert.ok(r.splunkSnippet.length >= 1);
    assert.ok(r.cisoMarkdown.includes("CWE") || r.cisoMarkdown.length > 20);
    assert.ok(fs.existsSync(r.paths.sarif));
  });

  it("classify each scenario stays fixture-driven with needs_human", async () => {
    for (const scenario of playgroundCatalog().classifyScenarios) {
      const r = await runPlaygroundClassify({
        scenario,
        outputDir: path.join(OUT, `classify-${scenario}`),
      });
      assert.equal(r.kind, "classify");
      assert.equal(r.needs_human, true);
      assert.equal(
        r.classification,
        scenario === "needs_human" ? "needs_human" : scenario,
      );
      assert.ok(r.cisoMarkdown.length > 10);
      assert.ok(fs.existsSync(r.paths.markdown));
    }
  });

  it("mixed demo returns classes + SARIF + Splunk + CISO markdown", async () => {
    const r = await runPlaygroundDemo({
      outputDir: path.join(OUT, "demo"),
    });
    assert.equal(r.kind, "demo");
    assert.ok(r.cases.length >= 4);
    const labels = new Set(r.cases.map((c) => c.classification));
    for (const need of [
      "software_defect",
      "possible_breach",
      "infra_failure",
      "agent_misfire",
    ]) {
      assert.ok(labels.has(need), `missing ${need}`);
    }
    assert.ok(r.sarifSummary.resultCount >= 1);
    assert.ok(r.splunkSnippet.length >= 1);
    assert.ok(r.cisoMarkdown.includes("fixture") || r.cisoMarkdown.length > 40);
    assert.ok(fs.existsSync(r.paths.sarif));
  });
});
