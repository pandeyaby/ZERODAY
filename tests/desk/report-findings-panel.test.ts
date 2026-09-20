/**
 * Desk ranked findings panel — presentational view from zeroday.report/v1.
 * Fail-closed · no invented findings · localization ≠ exploitability · no RunPod.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  evidenceSnippetFromFinding,
  findingsViewFromReport,
  REPORT_FINDINGS_NON_CLAIM,
  viewFromReportFinding,
} from "../../src/desk/report-findings-view.ts";
import {
  REPORT_SCHEMA,
  runReport,
} from "../../src/locate/report-summary.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURE_PROVE = path.join(
  root,
  "fixtures/locate/report-sample/prove-doors.json",
);

describe("report-findings-view (from fixture report JSON)", () => {
  it("renders ranked rows from runReport fixture (path · rank · evidence · no invent)", () => {
    const report = runReport({ from: FIXTURE_PROVE, cwd: root });
    assert.equal(report.schemaVersion, REPORT_SCHEMA);
    assert.equal(report.runpod, false);
    assert.ok(report.findings.length >= 1);

    const view = findingsViewFromReport(report);
    assert.equal(view.findingsPresent, true);
    assert.equal(view.findings.length, report.findings.length);
    assert.equal(view.findings[0]?.path, "src/search.js");
    assert.equal(view.findings[0]?.rank, 1);
    assert.ok(view.findings[0]?.cweIds?.includes("CWE-89"));
    assert.ok(
      view.findings[0]?.evidenceSnippet?.includes("cassette:replay"),
      "short evidence snippet from report.evidence[]",
    );
    // Must not invent score when absent on the report finding.
    assert.equal(view.findings[0]?.score, undefined);
    assert.equal(view.emptyMessage, undefined);
  });

  it("preserves score when present on report JSON (does not re-rank)", () => {
    const view = findingsViewFromReport({
      schemaVersion: REPORT_SCHEMA,
      findings: [
        {
          path: "src/a.js",
          rank: 2,
          score: 0.42,
          evidence: ["note from SARIF"],
          source: "sarif",
        },
        {
          path: "src/b.js",
          rank: 1,
          evidence: ["second"],
        },
      ],
      runpod: false,
    });
    // Order preserved — no re-rank.
    assert.equal(view.findings[0]?.path, "src/a.js");
    assert.equal(view.findings[0]?.rank, 2);
    assert.equal(view.findings[0]?.score, 0.42);
    assert.equal(view.findings[1]?.path, "src/b.js");
    assert.equal(view.findings[1]?.rank, 1);
  });

  it("empty / corrupt findings fail-closed (no invented rows)", () => {
    const empty = findingsViewFromReport({
      schemaVersion: REPORT_SCHEMA,
      findings: [],
      runpod: false,
    });
    assert.equal(empty.findingsPresent, true);
    assert.equal(empty.findings.length, 0);
    assert.match(empty.emptyMessage ?? "", /empty is not a clean claim/i);

    const badShape = findingsViewFromReport({
      schemaVersion: REPORT_SCHEMA,
      findings: "not-an-array",
      runpod: false,
    });
    assert.equal(badShape.findingsPresent, false);
    assert.equal(badShape.findings.length, 0);
    assert.match(badShape.emptyMessage ?? "", /fail-closed/i);

    const missingPath = findingsViewFromReport({
      findings: [{ rank: 1, evidence: ["x"] }, { path: "ok.js", rank: 2 }],
    });
    assert.equal(missingPath.findings.length, 1);
    assert.equal(missingPath.findings[0]?.path, "ok.js");

    assert.equal(viewFromReportFinding(null), null);
    assert.equal(viewFromReportFinding({ path: "  " }), null);
  });

  it("evidence snippet truncates honestly; never invents", () => {
    assert.equal(evidenceSnippetFromFinding(undefined), undefined);
    assert.equal(evidenceSnippetFromFinding([]), undefined);
    assert.equal(evidenceSnippetFromFinding([42]), undefined);
    const short = evidenceSnippetFromFinding(["hello"]);
    assert.equal(short, "hello");
    const long = "x".repeat(200);
    const snip = evidenceSnippetFromFinding([long], 40);
    assert.ok(snip && snip.length <= 40);
    assert.ok(snip.endsWith("…"));
  });

  it("exports explicit localization ≠ exploitability non-claim", () => {
    assert.match(REPORT_FINDINGS_NON_CLAIM, /Localization\s*≠\s*exploitability/i);
    assert.match(REPORT_FINDINGS_NON_CLAIM, /not proof of exploitability/i);
  });
});

describe("ReportFindingsPanel + Prove-doors wiring", () => {
  it("panel component + prove-doors card use findings view (no RunPod / no invent)", () => {
    const panel = fs.readFileSync(
      path.join(root, "src/components/operator/report-findings-panel.tsx"),
      "utf8",
    );
    const prove = fs.readFileSync(
      path.join(root, "src/components/operator/prove-doors-panel.tsx"),
      "utf8",
    );
    const view = fs.readFileSync(
      path.join(root, "src/desk/report-findings-view.ts"),
      "utf8",
    );

    assert.match(panel, /data-testid="prove-doors-report-findings-panel"/);
    assert.match(panel, /data-testid="prove-doors-report-findings"/);
    assert.match(panel, /data-testid="prove-doors-report-findings-non-claim"/);
    assert.match(panel, /data-testid="prove-doors-report-findings-empty"/);
    assert.match(panel, /REPORT_FINDINGS_NON_CLAIM/);
    assert.match(panel, /findingsViewFromReport/);
    assert.match(panel, /Localization|REPORT_FINDINGS_NON_CLAIM/);
    assert.match(panel, /runpod/);
    assert.doesNotMatch(panel, /create-pod|auto-provision|AUROC\s*=/i);

    assert.match(prove, /ReportFindingsPanel/);
    assert.match(prove, /report-findings-panel/);
    assert.match(prove, /data-testid="prove-doors-report-card"/);
    assert.match(prove, /downloadReportFiles|downloadReportJson/);
    assert.match(prove, /REPORT_JSON_DOWNLOAD_FILENAME/);
    assert.match(prove, /does not start RunPod/i);
    assert.doesNotMatch(prove, /create-pod|auto-provision/i);

    assert.match(view, /zeroday\.report\/v1/);
    assert.match(view, /does not re-rank|Does not re-sort/i);
    assert.match(view, /fail-closed/i);
    assert.match(view, /Localization\s*≠\s*exploitability/);
    assert.doesNotMatch(view, /create-pod|runpod\.com|exploit PoC/i);
  });
});
