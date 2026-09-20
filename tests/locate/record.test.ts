/**
 * Keyless K3 — org CI cassette record --redact + locate --recording replay.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  recordCassette,
  buildRedactedCassette,
  loadOrgCassette,
  runRecordingLocalization,
  RecordRefuseError,
  ORG_CASSETTE_SCHEMA,
} from "../../src/locate/record/index.ts";
import { locate } from "../../src/locate/index.ts";
import { resolveLocateMode, MIXED_MODE_REFUSED } from "../../src/locate/live-guard.ts";
import type { LocalizationResult } from "../../src/locate/types.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const rulesSample = path.join(root, "fixtures/locate/rules-sample");

function baseReport(
  overrides: Partial<LocalizationResult> = {},
): LocalizationResult {
  return {
    mode: "rules",
    advisory: { kind: "cwe", id: "CWE-89", cweId: "CWE-89", title: "SQL Injection" },
    targetRepo: "/workspace/fixtures/locate/rules-sample",
    snapshotPath: "/tmp/zeroday-snap-test/snapshot",
    model: "rules/cwe-89",
    generatedAt: new Date().toISOString(),
    rankedFiles: [
      {
        filePath: "/workspace/fixtures/locate/rules-sample/src/search.js",
        rank: 1,
        cweIds: ["CWE-89"],
        title: "SQL string concat",
        evidence: [
          {
            filePath: "/workspace/fixtures/locate/rules-sample/src/search.js",
            startLine: 10,
            note: "query built from req.query.q",
            excerpt: "const sql = \"SELECT * FROM users WHERE q=\" + q",
          },
        ],
      },
    ],
    explorationTrace: [
      {
        step: 1,
        tool: "grep",
        command: "grep -R SELECT /tmp/zeroday-snap-test/snapshot",
        summary: "looked under /workspace/fixtures/locate/rules-sample",
      },
    ],
    warnings: ["Rules mode — not Antares F1"],
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
      terminalCallsUsed: 3,
    },
    ...overrides,
  };
}

describe("record --redact org CI cassettes (Keyless K3)", () => {
  it("redacts absolute paths and keeps CWE / ranks / relative files", () => {
    const cassette = buildRedactedCassette(baseReport());
    assert.equal(cassette.schemaVersion, ORG_CASSETTE_SCHEMA);
    assert.equal(cassette.redacted, true);
    assert.equal(cassette.sourceMode, "rules");
    assert.equal(cassette.advisory.cweId, "CWE-89");
    assert.equal(cassette.targetRepo, "<repo>");
    assert.equal(cassette.rankedFiles.length, 1);
    assert.equal(cassette.rankedFiles[0].filePath, "src/search.js");
    assert.equal(cassette.rankedFiles[0].rank, 1);
    assert.equal(cassette.rankedFiles[0].cweIds[0], "CWE-89");
    const blob = JSON.stringify(cassette);
    assert.doesNotMatch(blob, /\/workspace\//);
    assert.doesNotMatch(blob, /\/tmp\/zeroday-snap/);
    assert.doesNotMatch(blob, /\/Users\//);
    assert.match(cassette.humanReviewNote, /Human review required/i);
  });

  it("strips secret-shaped tokens via sanitize", () => {
    const report = baseReport({
      warnings: [
        "token ghp_abcdefghijklmnopqrstuvwxyz012345 leaked in log",
        "key sk_test_abc1234567890xyz also present",
      ],
      rankedFiles: [
        {
          filePath: "src/search.js",
          rank: 1,
          cweIds: ["CWE-89"],
          title: "hit",
          evidence: [
            {
              filePath: "src/search.js",
              note: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc.def",
            },
          ],
        },
      ],
    });
    const cassette = buildRedactedCassette(report);
    const blob = JSON.stringify(cassette);
    assert.doesNotMatch(blob, /ghp_[A-Za-z0-9]{10,}/);
    assert.doesNotMatch(blob, /sk_test_[A-Za-z0-9]+/);
    assert.doesNotMatch(blob, /Bearer\s+eyJ/);
    assert.match(blob, /\[REDACTED\]/);
  });

  it("refuses empty rankedFiles", () => {
    assert.throws(
      () =>
        buildRedactedCassette(
          baseReport({
            rankedFiles: [],
            summary: {
              findingCount: 0,
              incompleteReason: null,
              terminalCallBudget: 15,
              terminalCallsUsed: 0,
            },
          }),
        ),
      (e: Error) =>
        e instanceof RecordRefuseError && /rankedFiles is empty/i.test(e.message),
    );
  });

  it("refuses incomplete locate reports", () => {
    assert.throws(
      () =>
        buildRedactedCassette(
          baseReport({
            summary: {
              findingCount: 1,
              incompleteReason: "no submit_vulnerable_files",
              incompleteClass: "no_submit",
              terminalCallBudget: 15,
              terminalCallsUsed: 15,
            },
          }),
        ),
      (e: Error) =>
        e instanceof RecordRefuseError && /incomplete/i.test(e.message),
    );
  });

  it("refuses missing rankedFiles field", () => {
    const bad = baseReport();
    // @ts-expect-error intentional corrupt
    delete bad.rankedFiles;
    assert.throws(
      () => buildRedactedCassette(bad),
      /missing rankedFiles/i,
    );
  });

  it("refuses --no-redact / redact:false", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-record-noreduct-"));
    const reportPath = path.join(dir, "report.json");
    fs.writeFileSync(reportPath, JSON.stringify(baseReport(), null, 2));
    assert.throws(
      () =>
        recordCassette({
          from: dir,
          out: path.join(dir, "cassette.json"),
          redact: false,
        }),
      /no-redact|require redaction/i,
    );
    assert.equal(fs.existsSync(path.join(dir, "cassette.json")), false);
  });

  it("recordCassette writes cassette from locate report dir", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-record-ok-"));
    fs.writeFileSync(
      path.join(dir, "report.json"),
      JSON.stringify(baseReport(), null, 2),
    );
    const out = path.join(dir, "org-cassette.json");
    const art = recordCassette({ from: dir, out });
    assert.equal(art.findingCount, 1);
    assert.ok(fs.existsSync(out));
    const loaded = loadOrgCassette(out);
    assert.equal(loaded.schemaVersion, ORG_CASSETTE_SCHEMA);
    assert.equal(loaded.redacted, true);
  });

  it("resolveLocateMode: --recording is exclusive", () => {
    assert.equal(
      resolveLocateMode({ recording: "/tmp/c.json" }),
      "recording",
    );
    assert.throws(
      () =>
        resolveLocateMode({
          recording: "/tmp/c.json",
          rules: true,
        }),
      (e: Error) =>
        e.message === MIXED_MODE_REFUSED || /mixed mode/i.test(e.message),
    );
    assert.throws(
      () =>
        resolveLocateMode({
          recording: "/tmp/c.json",
          fixture: true,
        }),
      /mixed mode/i,
    );
  });

  it("locate --rules → record → locate --recording preserves finding count + mode=recording", async () => {
    const locateOut = fs.mkdtempSync(
      path.join(os.tmpdir(), "zeroday-k3-locate-"),
    );
    const cassetteOut = path.join(locateOut, "rules-cwe-89.cassette.json");
    const replayOut = fs.mkdtempSync(
      path.join(os.tmpdir(), "zeroday-k3-replay-"),
    );

    const located = await locate({
      repo: rulesSample,
      advisory: "CWE-89",
      rules: true,
      offline: true,
      outputDir: locateOut,
    });
    assert.equal(located.result.mode, "rules");
    assert.ok(located.result.rankedFiles.length >= 1);
    const expectedCount = located.result.rankedFiles.length;

    const recorded = recordCassette({
      from: locateOut,
      out: cassetteOut,
    });
    assert.equal(recorded.findingCount, expectedCount);
    assert.equal(recorded.cassette.sourceMode, "rules");

    const replayed = await locate({
      repo: rulesSample,
      advisory: "",
      recording: cassetteOut,
      outputDir: replayOut,
    });
    assert.equal(replayed.result.mode, "recording");
    assert.equal(replayed.result.summary.findingCount, expectedCount);
    assert.equal(replayed.result.rankedFiles.length, expectedCount);
    assert.equal(replayed.result.advisory.cweId, "CWE-89");
    const warn = replayed.result.warnings.join(" ");
    assert.match(warn, /recording|cassette/i);
    assert.match(warn, /sourceMode=rules/);
    // No absolute workspace leaks in replay report
    const replayBlob = fs.readFileSync(
      path.join(replayOut, "report.json"),
      "utf8",
    );
    // targetRepo may be resolved abs for the replay label — ranked files must stay relative
    const report = JSON.parse(replayBlob) as LocalizationResult;
    for (const f of report.rankedFiles) {
      assert.ok(
        !path.isAbsolute(f.filePath),
        `ranked path must be relative: ${f.filePath}`,
      );
    }
  });

  it("runRecordingLocalization sets honest mode=recording", () => {
    const cassette = buildRedactedCassette(baseReport());
    const result = runRecordingLocalization(cassette);
    assert.equal(result.mode, "recording");
    assert.equal(result.summary.findingCount, 1);
    assert.match(result.warnings.join(" "), /mode="recording"/);
  });

  it("assertRecordingReplayArtifacts pins finding count + ranked file + SARIF", async () => {
    const {
      assertRecordingReplayArtifacts,
      CassetteReplayAssertError,
      RULES_CWE_89_CASSETTE,
    } = await import("../../src/locate/record/assert-replay.ts");

    const replayOut = fs.mkdtempSync(
      path.join(os.tmpdir(), "zeroday-k3-assert-"),
    );
    const cassettePath = path.join(root, RULES_CWE_89_CASSETTE.recording);
    assert.ok(fs.existsSync(cassettePath), "committed org cassette missing");

    const replayed = await locate({
      advisory: "",
      recording: cassettePath,
      outputDir: replayOut,
    });
    assert.equal(replayed.result.mode, "recording");

    const ok = assertRecordingReplayArtifacts(replayOut, {
      mode: "recording",
      findingCount: RULES_CWE_89_CASSETTE.findingCount,
      rankedFile: RULES_CWE_89_CASSETTE.rankedFile,
      cweId: RULES_CWE_89_CASSETTE.cweId,
      sarifResultCount: RULES_CWE_89_CASSETTE.sarifResultCount,
    });
    assert.equal(ok.findingCount, 1);
    assert.equal(ok.rankedFile, "src/search.js");
    assert.equal(ok.sarifResultCount, 1);

    assert.throws(
      () =>
        assertRecordingReplayArtifacts(replayOut, {
          findingCount: 99,
          rankedFile: "src/search.js",
        }),
      (e: Error) =>
        e instanceof CassetteReplayAssertError && /findingCount/.test(e.message),
    );
    assert.throws(
      () =>
        assertRecordingReplayArtifacts(replayOut, {
          findingCount: 1,
          rankedFile: "src/wrong.js",
        }),
      (e: Error) =>
        e instanceof CassetteReplayAssertError && /rankedFile/.test(e.message),
    );
  });
});
