import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { locate, defaultFixtureRepo } from "../../src/locate/index.ts";
import { isValidSarifShape } from "../../src/locate/sarif.ts";
import { isValidAsffShape } from "../../src/locate/export/asff.ts";
import { isValidSplunkShape } from "../../src/locate/export/splunk.ts";

describe("locate end-to-end (fixture)", () => {
  it("writes JSON, SARIF, CISO report, and defender exports", async () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-test-"));
    const artifacts = await locate({
      repo: defaultFixtureRepo(),
      advisory: "CWE-89",
      fixture: true,
      outputDir: out,
    });

    assert.equal(artifacts.result.mode, "fixture");
    assert.ok(fs.existsSync(artifacts.jsonPath));
    assert.ok(fs.existsSync(artifacts.sarifPath));
    assert.ok(fs.existsSync(artifacts.reportPath));
    assert.ok(fs.existsSync(artifacts.commentPath));

    const sarif = JSON.parse(fs.readFileSync(artifacts.sarifPath, "utf8"));
    assert.equal(isValidSarifShape(sarif), true);
    assert.ok(artifacts.result.rankedFiles[0].filePath.includes("users.js"));

    const report = fs.readFileSync(artifacts.reportPath, "utf8");
    assert.match(report, /CISO one-pager/);
    assert.match(report, /0\.209/);
    assert.match(report, /Next human action/);

    const comment = fs.readFileSync(artifacts.commentPath, "utf8");
    assert.match(comment, /Human review required/);

    assert.ok(fs.existsSync(path.join(out, "asff-findings.json")));
    assert.ok(fs.existsSync(path.join(out, "splunk-cim-vulnerabilities.json")));
    assert.ok(fs.existsSync(path.join(out, "xsoar-incidents.json")));
    assert.ok(fs.existsSync(path.join(out, "fortisiem-custom.json")));
    assert.ok(fs.existsSync(path.join(out, "crowdstrike-hec-events.ndjson")));

    const asff = JSON.parse(
      fs.readFileSync(path.join(out, "asff-findings.json"), "utf8"),
    );
    assert.equal(isValidAsffShape(asff), true);
    const splunk = JSON.parse(
      fs.readFileSync(path.join(out, "splunk-cim-vulnerabilities.json"), "utf8"),
    );
    assert.equal(isValidSplunkShape(splunk), true);
  });

  it("accepts CVE mapped to CWE-89", async () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-test-"));
    const artifacts = await locate({
      repo: defaultFixtureRepo(),
      advisory: "CVE-2024-89001",
      fixture: true,
      outputDir: out,
    });
    assert.equal(artifacts.result.advisory.cweId, "CWE-89");
    assert.ok(artifacts.result.summary.findingCount >= 1);
  });
});
