import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { operate, validateOperatorSubmission } from "../../src/operate/index.ts";
import { defaultFixtureRepo } from "../../src/locate/index.ts";
import { verifyRunDir } from "../../src/evidence/vault.ts";

describe("operate (keyless agent operator)", () => {
  it("fixture path writes full artifact + evidence pack", async () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-operate-"));
    const artifacts = await operate({
      repo: defaultFixtureRepo(),
      advisory: "CWE-89",
      fixture: true,
      offline: true,
      outputDir: out,
    });

    assert.equal(artifacts.result.mode, "agent");
    assert.ok(artifacts.result.summary.findingCount >= 1);
    assert.ok(fs.existsSync(artifacts.jsonPath));
    assert.ok(fs.existsSync(artifacts.sarifPath));
    assert.ok(fs.existsSync(artifacts.reportPath));
    assert.ok(fs.existsSync(artifacts.commentPath));
    assert.ok(fs.existsSync(artifacts.briefPath));
    assert.ok(fs.existsSync(artifacts.schemaPath));
    assert.ok(fs.existsSync(artifacts.instructionsPath));
    assert.ok(fs.existsSync(artifacts.submissionPath));
    assert.ok(fs.existsSync(artifacts.manifestPath));
    assert.ok(fs.existsSync(path.join(out, "asff-findings.json")));
    assert.ok(fs.existsSync(path.join(out, "splunk-cim-vulnerabilities.json")));
    assert.ok(fs.existsSync(path.join(out, "xsoar-incidents.json")));
    assert.ok(fs.existsSync(path.join(out, "fortisiem-custom.json")));
    assert.ok(fs.existsSync(path.join(out, "crowdstrike-hec-events.ndjson")));

    const report = fs.readFileSync(artifacts.reportPath, "utf8");
    assert.match(report, /Evidence citations|ev_claim_/);
    assert.match(report, /needs_human|keyless|agent/i);

    const v = verifyRunDir(out);
    assert.equal(v.ok, true, JSON.stringify(v.failures, null, 2));
    assert.ok(v.checked >= 3);
  });

  it("rejects exploit-oriented submission", () => {
    const bad = validateOperatorSubmission({
      schemaVersion: "zeroday-operator-submission/v1",
      advisory: { kind: "cwe", id: "CWE-89", cweId: "CWE-89" },
      needs_human: true,
      rankedFiles: [
        {
          filePath: "x.js",
          rank: 1,
          cweIds: ["CWE-89"],
          title: "issue",
          confidence: "high",
          evidence: [
            {
              filePath: "x.js",
              excerpt: "code",
              note: "here is how to exploit this with a proof-of-concept payload",
            },
          ],
        },
      ],
    });
    assert.equal(bad.ok, false);
    if (!bad.ok) {
      assert.ok(bad.issues.some((i) => i.path === "no-exploit"));
    }
  });

  it("requires needs_human true", () => {
    const bad = validateOperatorSubmission({
      schemaVersion: "zeroday-operator-submission/v1",
      advisory: { kind: "cwe", id: "CWE-89", cweId: "CWE-89" },
      needs_human: false,
      rankedFiles: [],
    });
    assert.equal(bad.ok, false);
  });
});

describe("verify", () => {
  it("fails when an artifact is tampered", async () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-verify-"));
    await operate({
      repo: defaultFixtureRepo(),
      advisory: "CWE-89",
      fixture: true,
      offline: true,
      outputDir: out,
    });
    const report = path.join(out, "report.md");
    fs.appendFileSync(report, "\n<!-- tamper -->\n");
    const v = verifyRunDir(out);
    assert.equal(v.ok, false);
    assert.ok(v.failures.some((f) => f.path.includes("report.md")));
  });
});
