import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  OPERATORS,
  SAMPLE_GRADE_KIND,
  buildSampleDiptychGradeReport,
  loadMatrixOrJustifications,
  renderSampleGradeMarkdown,
  writeSampleGradeReport,
} from "../../src/locate/paired-probes/index.ts";
import { runAllPairedProbes } from "../../src/locate/paired-probes/run-all.ts";
import { gateAxisMutateAllEight } from "../../src/locate/paired-probes/gate-axis-mutate.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("paired-probe sample DIPTYCH grade report", () => {
  it("builds a deterministic sample grade from emit envelopes (keyless)", async () => {
    const emitRoot = path.join(root, "zeroday-reports");
    await runAllPairedProbes(emitRoot);
    const matrix = loadMatrixOrJustifications(emitRoot);
    const { proofs, failures } = gateAxisMutateAllEight();
    assert.equal(failures.length, 0, "gate_axis_mutate must be clean for sample");
    assert.equal(proofs.length, OPERATORS.length);

    const a = buildSampleDiptychGradeReport(emitRoot, matrix, proofs);
    const b = buildSampleDiptychGradeReport(emitRoot, matrix, proofs);
    assert.equal(a.emit_content_sha256, b.emit_content_sha256);
    assert.equal(a.kind, SAMPLE_GRADE_KIND);
    assert.equal(a.sample, true);
    assert.equal(a.live_diptych_run, false);
    assert.equal(a.results.length, OPERATORS.length * 2);
    assert.equal(a.axis_power.length, OPERATORS.length);
    assert.ok(a.non_claims.some((c) => /exploitability/i.test(c)));
    assert.ok(a.non_claims.some((c) => /DIPTYCH grades/i.test(c)));

    for (const cell of a.results) {
      assert.equal(cell.matches_expected, true);
      if (cell.control_role === "conforming") {
        assert.equal(cell.expected_verdict, "pass");
      } else {
        assert.equal(cell.expected_verdict, "fail");
      }
    }
    for (const row of a.matrix_summary) {
      assert.equal(row.status, "green");
    }

    const md = renderSampleGradeMarkdown(a);
    assert.match(md, /SAMPLE|ILLUSTRATIVE/i);
    assert.match(md, /Not a live DIPTYCH/i);
    assert.match(md, /paired-probe:sample-report/);
    assert.match(md, /FREEZEDRY/);
    assert.match(md, /VARSCALE/);
    assert.doesNotMatch(md, /"auroc"\s*:/i);
  });

  it("checked-in docs/reports sample is present and labeled sample", () => {
    const md = path.join(root, "docs/reports/diptych-sample-grade.md");
    const json = path.join(root, "docs/reports/diptych-sample-grade.json");
    assert.ok(fs.existsSync(md), "missing diptych-sample-grade.md");
    assert.ok(fs.existsSync(json), "missing diptych-sample-grade.json");
    const mdText = fs.readFileSync(md, "utf8");
    assert.match(mdText, /sample|illustrative/i);
    assert.match(mdText, /Not a live DIPTYCH/i);
    assert.match(mdText, /localization|exploitability/i);
    const report = JSON.parse(fs.readFileSync(json, "utf8")) as {
      kind: string;
      sample: boolean;
      live_diptych_run: boolean;
      results: unknown[];
    };
    assert.equal(report.kind, SAMPLE_GRADE_KIND);
    assert.equal(report.sample, true);
    assert.equal(report.live_diptych_run, false);
    assert.equal(report.results.length, 16);
  });

  it("package.json exposes paired-probe:sample-report", () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(root, "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };
    assert.ok(pkg.scripts["paired-probe:sample-report"]);
    assert.match(pkg.scripts["paired-probe:sample-report"], /sample-report/);
  });

  it("docs door mentions sample-report path", () => {
    const paired = fs.readFileSync(
      path.join(root, "docs/paired-probes.md"),
      "utf8",
    );
    const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
    assert.match(paired, /paired-probe:sample-report/);
    assert.match(paired, /diptych-sample-grade\.md/);
    assert.match(readme, /paired-probe:sample-report/);
    assert.match(readme, /diptych-sample-grade\.md/);
  });
});
