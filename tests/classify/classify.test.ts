import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  classify,
  isValidCisoObject,
  runClassify,
  listClassifyScenarios,
  toCisoMarkdown,
} from "../../src/classify/index.ts";
import { checkNoExploitInvariant } from "../../src/locate/invariant.ts";

describe("classify (fixture-driven)", () => {
  it("lists bundled scenarios covering every label", () => {
    const names = listClassifyScenarios();
    for (const n of [
      "software_defect",
      "possible_breach",
      "infra_failure",
      "agent_misfire",
      "needs_human",
    ]) {
      assert.ok(names.includes(n), `missing scenario ${n}`);
    }
  });

  it("software_defect from locate-only fixture", () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "zd-cls-"));
    const a = runClassify({ scenario: "software_defect", outputDir: out });
    assert.equal(a.ciso.classification, "software_defect");
    assert.equal(a.ciso.needs_human, true);
    assert.equal(a.ciso.human_review_required, true);
    assert.equal(isValidCisoObject(a.ciso), true);
    assert.ok(a.ciso.evidence.some((e) => e.kind === "locate_file"));
  });

  it("possible_breach from lateral telemetry fixture", () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "zd-cls-"));
    const a = runClassify({ scenario: "possible_breach", outputDir: out });
    assert.equal(a.ciso.classification, "possible_breach");
    assert.equal(a.ciso.needs_human, true);
    assert.ok(a.ciso.evidence.some((e) => e.kind === "telemetry_event"));
  });

  it("infra_failure from infra telemetry fixture", () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "zd-cls-"));
    const a = runClassify({ scenario: "infra_failure", outputDir: out });
    assert.equal(a.ciso.classification, "infra_failure");
  });

  it("agent_misfire as classifier output on agent_session fixture only", () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "zd-cls-"));
    const a = runClassify({ scenario: "agent_misfire", outputDir: out });
    assert.equal(a.ciso.classification, "agent_misfire");
    assert.equal(a.ciso.posture.fixtureDrivenClassifier, true);
    assert.equal(a.ciso.posture.notProductionSoc, true);
    // Honesty: we claim this only as fixture classifier output
    assert.match(a.ciso.rationale.join(" "), /fixture/i);
  });

  it("ambiguous competing signals → needs_human", () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "zd-cls-"));
    const a = runClassify({ scenario: "needs_human", outputDir: out });
    assert.equal(a.ciso.classification, "needs_human");
    assert.match(a.ciso.rationale.join(" "), /Ambiguous/i);
  });

  it("empty inputs → needs_human", () => {
    const { ciso } = classify({});
    assert.equal(ciso.classification, "needs_human");
    assert.equal(ciso.needs_human, true);
  });

  it("CISO markdown + JSON satisfy no-exploit invariant", () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "zd-cls-"));
    const a = runClassify({ scenario: "software_defect", outputDir: out });
    const md = fs.readFileSync(a.markdownPath, "utf8");
    assert.match(md, /Human review required/);
    assert.match(md, /not.*production SOC/i);
    assert.equal(checkNoExploitInvariant([md, toCisoMarkdown(a.ciso)]).length, 0);
  });

  it("software + lateral together → needs_human (ambiguous)", () => {
    const locate = JSON.parse(
      fs.readFileSync("fixtures/classify/software_defect/report.json", "utf8"),
    );
    const telemetry = JSON.parse(
      fs.readFileSync("fixtures/classify/possible_breach/telemetry.json", "utf8"),
    );
    const { ciso } = classify({ locate, telemetry });
    assert.equal(ciso.classification, "needs_human");
  });
});
