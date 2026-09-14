/**
 * Keyless K2 — locate --from-sarif ingest mode.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  resolveLocateMode,
  MIXED_MODE_REFUSED,
} from "../../src/locate/live-guard.ts";
import {
  locate,
  runIngestLocalization,
  parseSarifFile,
  mapRuleToCwe,
} from "../../src/locate/index.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const sampleSarif = path.join(
  root,
  "fixtures/locate/ingest-sample/sample.sarif",
);

describe("locate --from-sarif mode resolution", () => {
  it("resolveLocateMode: --from-sarif → ingest", () => {
    assert.equal(
      resolveLocateMode({ fromSarif: "/tmp/report.sarif" }),
      "ingest",
    );
  });

  it("refuses --from-sarif + --fixture", () => {
    assert.throws(
      () =>
        resolveLocateMode({
          fromSarif: "/tmp/a.sarif",
          fixture: true,
        }),
      (e: Error) =>
        e.message.includes("mixed mode") || e.message === MIXED_MODE_REFUSED,
    );
  });

  it("refuses --from-sarif + --rules", () => {
    assert.throws(
      () =>
        resolveLocateMode({
          fromSarif: "/tmp/a.sarif",
          rules: true,
        }),
      /mixed mode|Refusing/,
    );
  });

  it("refuses --from-sarif + --endpoint / --live", () => {
    assert.throws(
      () =>
        resolveLocateMode({
          fromSarif: "/tmp/a.sarif",
          endpoint: "http://127.0.0.1:8000/v1",
        }),
      /mixed mode|Refusing/,
    );
    assert.throws(
      () =>
        resolveLocateMode({
          fromSarif: "/tmp/a.sarif",
          live: true,
        }),
      /mixed mode|Refusing/,
    );
  });

  it("default and --fixture still → fixture (mvp unchanged)", () => {
    assert.equal(resolveLocateMode({}), "fixture");
    assert.equal(resolveLocateMode({ fixture: true }), "fixture");
  });
});

describe("SARIF parse + CWE map", () => {
  it("parses ingest-sample with ≥1 finding and mapped CWEs", () => {
    const parsed = parseSarifFile(sampleSarif);
    assert.ok(parsed.resultCount >= 2, "expected ≥2 SARIF results");
    assert.ok(parsed.findings.length >= 2);
    assert.ok(
      parsed.findings.some((f) => f.cweIds.includes("CWE-89")),
      "expected CWE-89 mapping from CodeQL/Semgrep sample",
    );
    assert.ok(
      parsed.findings.some((f) => f.uri.includes("search.js")),
    );
  });

  it("mapRuleToCwe: CodeQL tags + Semgrep rule ids", () => {
    const codeql = mapRuleToCwe({
      ruleId: "js/sql-injection",
      ruleProperties: {
        tags: ["security", "external/cwe/cwe-089"],
      },
    });
    assert.deepEqual(codeql.cweIds, ["CWE-89"]);
    assert.equal(codeql.mapped, true);

    const semgrep = mapRuleToCwe({
      ruleId: "javascript.lang.security.audit.sqli.node-mysql-sqli",
      resultProperties: { cwe: ["CWE-89"] },
    });
    assert.ok(semgrep.cweIds.includes("CWE-89"));

    const unknown = mapRuleToCwe({ ruleId: "custom/obscure-check-v1" });
    assert.equal(unknown.mapped, false);
    assert.deepEqual(unknown.cweIds, []);
  });

  it("runIngestLocalization emits mode=ingest + honest warnings", () => {
    const result = runIngestLocalization({
      sarifPath: sampleSarif,
      advisory: {
        kind: "cwe",
        id: "CWE-89",
        cweId: "CWE-89",
      },
      cweFilter: "CWE-89",
      targetRepo: root,
    });
    assert.equal(result.mode, "ingest");
    assert.ok(result.rankedFiles.length >= 1);
    assert.ok(result.posture.localizationOnly);
    assert.ok(result.posture.noPoC);
    const warn = result.warnings.join(" ");
    assert.match(warn, /third-party|not Antares/i);
    assert.match(warn, /not proof of exploitability|Localization only/i);
    assert.match(warn, /no GitHub|File-path ingest|alerts API/i);
  });
});

describe("locate() ingest end-to-end", () => {
  it("writes report.json mode=ingest + evidence + SARIF", async () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-ingest-"));
    const artifacts = await locate({
      repo: root,
      advisory: "CWE-89",
      fromSarif: sampleSarif,
      offline: true,
      outputDir: out,
    });
    assert.equal(artifacts.result.mode, "ingest");
    assert.ok(artifacts.result.rankedFiles.length >= 1);
    assert.ok(fs.existsSync(artifacts.jsonPath));
    assert.ok(fs.existsSync(artifacts.sarifPath));
    assert.ok(fs.existsSync(artifacts.manifestPath!));

    const report = JSON.parse(fs.readFileSync(artifacts.jsonPath, "utf8")) as {
      mode: string;
      warnings: string[];
      posture: { localizationOnly: boolean; noPoC: boolean };
    };
    assert.equal(report.mode, "ingest");
    assert.ok(report.posture.localizationOnly);
    assert.ok(report.posture.noPoC);
    assert.match(report.warnings.join(" "), /not Antares/i);

    const sarif = JSON.parse(fs.readFileSync(artifacts.sarifPath, "utf8")) as {
      runs: Array<{ properties?: { mode?: string } }>;
    };
    assert.equal(sarif.runs[0]?.properties?.mode, "ingest");
  });

  it("refuses mixed --from-sarif + --rules", async () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-ingest-mix-"));
    await assert.rejects(
      () =>
        locate({
          repo: root,
          advisory: "CWE-89",
          fromSarif: sampleSarif,
          rules: true,
          outputDir: out,
        }),
      /mixed mode|Refusing/,
    );
  });
});
