/**
 * UI-2 — Reports browser + org cassette record/replay (sandboxed).
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { PathPolicyError } from "../../src/lib/path-policy.ts";
import {
  listReports,
  previewReport,
  recordOrgCassette,
  replayOrgCassette,
  runReportsAction,
  RecordRefuseError,
} from "../../src/desk/reports.ts";
import { runDeskRules } from "../../src/desk/console.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const rulesSample = path.join(root, "fixtures/locate/rules-sample");

describe("reports browser + cassettes (UI-2)", () => {
  it("listReports lists sandboxed zeroday-reports dirs after rules locate", async () => {
    const out = path.join(root, "zeroday-reports", "test-ui2-list");
    fs.rmSync(out, { recursive: true, force: true });
    await runDeskRules({
      action: "rules",
      cwe: "CWE-89",
      repo: "fixtures/locate/rules-sample",
      output: out,
      cwd: root,
    });

    const listed = listReports({ cwd: root, limit: 50 });
    assert.equal(listed.kind, "reports-list");
    assert.ok(listed.reportsRoot.endsWith("zeroday-reports"));
    const hit = listed.entries.find((e) => e.dir === out || e.name === "test-ui2-list");
    assert.ok(hit, "expected test-ui2-list in reports list");
    assert.equal(hit!.hasReportJson, true);
    assert.equal(hit!.kind, "locate");
    assert.equal(hit!.mode, "rules");
    assert.ok((hit!.findingCount ?? 0) >= 1);
  });

  it("previewReport returns summary key fields + paths (not raw dump)", async () => {
    const out = path.join(root, "zeroday-reports", "test-ui2-preview");
    fs.rmSync(out, { recursive: true, force: true });
    await runDeskRules({
      action: "rules",
      cwe: "CWE-89",
      repo: rulesSample,
      output: out,
      cwd: root,
    });

    const preview = previewReport(out, { cwd: root });
    assert.equal(preview.kind, "reports-preview");
    assert.equal(preview.mode, "rules");
    assert.equal(preview.cweId, "CWE-89");
    assert.ok(preview.findingCount >= 1);
    assert.ok(preview.rankedFiles.length >= 1);
    assert.ok(preview.paths.json?.endsWith("report.json"));
    assert.ok(preview.paths.sarif?.endsWith("report.sarif"));
    assert.equal(preview.needs_human, true);
  });

  it("record → replay happy path (mode=recording) on fixtures", async () => {
    const locateOut = path.join(root, "zeroday-reports", "test-ui2-cassette-src");
    const cassetteOut = path.join(
      root,
      "zeroday-reports",
      "cassettes",
      "test-ui2.cassette.json",
    );
    const replayOut = path.join(root, "zeroday-reports", "test-ui2-replay");
    fs.rmSync(locateOut, { recursive: true, force: true });
    fs.rmSync(replayOut, { recursive: true, force: true });
    if (fs.existsSync(cassetteOut)) fs.unlinkSync(cassetteOut);

    await runDeskRules({
      action: "rules",
      cwe: "CWE-89",
      repo: "fixtures/locate/rules-sample",
      output: locateOut,
      cwd: root,
    });

    const recorded = recordOrgCassette({
      from: locateOut,
      cassette: cassetteOut,
      cwd: root,
    });
    assert.equal(recorded.kind, "cassette-record");
    assert.equal(recorded.redacted, true);
    assert.equal(recorded.sourceMode, "rules");
    assert.ok(recorded.findingCount >= 1);
    assert.match(recorded.humanReviewNote, /Human review required/i);
    assert.ok(fs.existsSync(recorded.outPath));

    const replayed = await replayOrgCassette({
      cassette: cassetteOut,
      output: replayOut,
      cwd: root,
    });
    assert.equal(replayed.kind, "locate");
    assert.equal(replayed.mode, "recording");
    assert.equal(replayed.action, "replay");
    assert.equal(replayed.needs_human, true);
    assert.equal(replayed.cweId, "CWE-89");
    assert.ok(replayed.findingCount >= 1);
    assert.ok(fs.existsSync(replayed.paths.json));
    assert.match(replayed.warnings.join(" "), /recording|cassette/i);
  });

  it("path escape refuse on preview / record / replay", async () => {
    const outside = path.join(os.tmpdir(), `zeroday-ui2-escape-${Date.now()}`);
    fs.mkdirSync(outside, { recursive: true });
    fs.writeFileSync(
      path.join(outside, "report.json"),
      JSON.stringify({
        mode: "rules",
        advisory: { kind: "cwe", id: "CWE-89", cweId: "CWE-89" },
        rankedFiles: [
          {
            rank: 1,
            filePath: "x.js",
            title: "t",
            score: 1,
            startLine: 1,
            endLine: 1,
            cweIds: ["CWE-89"],
            rationale: "r",
            evidenceSpans: [],
          },
        ],
        explorationTrace: [],
        warnings: [],
        posture: {
          localizationOnly: true,
          notExploitProof: true,
          noAutoMerge: true,
          noPoC: true,
        },
        summary: { findingCount: 1, incompleteReason: null, incompleteClass: null, terminalCallBudget: 0, terminalCallsUsed: 0 },
        targetRepo: "<repo>",
        model: "test",
        generatedAt: new Date().toISOString(),
      }),
    );

    try {
      assert.throws(
        () => previewReport(outside, { cwd: root }),
        (e: Error) =>
          e instanceof PathPolicyError && /escapes sandbox/i.test(e.message),
      );
      assert.throws(
        () =>
          recordOrgCassette({
            from: outside,
            cassette: path.join(root, "zeroday-reports", "nope.cassette.json"),
            cwd: root,
          }),
        PathPolicyError,
      );
      await assert.rejects(
        () =>
          replayOrgCassette({
            cassette: path.join(outside, "nope.cassette.json"),
            cwd: root,
          }),
        PathPolicyError,
      );
    } finally {
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });

  it("UI/API refuses redact:false (--no-redact)", async () => {
    const locateOut = path.join(root, "zeroday-reports", "test-ui2-noredact");
    fs.rmSync(locateOut, { recursive: true, force: true });
    await runDeskRules({
      action: "rules",
      cwe: "CWE-89",
      repo: "fixtures/locate/rules-sample",
      output: locateOut,
      cwd: root,
    });

    assert.throws(
      () =>
        recordOrgCassette({
          from: locateOut,
          cassette: path.join(
            root,
            "zeroday-reports",
            "cassettes",
            "should-not-exist.cassette.json",
          ),
          redact: false,
          cwd: root,
        }),
      (e: Error) =>
        e instanceof RecordRefuseError && /no-redact/i.test(e.message),
    );

    await assert.rejects(
      () =>
        runReportsAction({
          action: "record",
          from: locateOut,
          redact: false,
          cwd: root,
        }),
      RecordRefuseError,
    );
  });

  it("runReportsAction list works", async () => {
    const r = await runReportsAction({ action: "list", cwd: root });
    assert.equal(r.kind, "reports-list");
  });
});
