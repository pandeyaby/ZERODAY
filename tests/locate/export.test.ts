import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  toAsff,
  isValidAsffShape,
  toSplunkCim,
  isValidSplunkShape,
  toXsoar,
  isValidXsoarShape,
  toFortisiem,
  isValidFortisiemShape,
  toCrowdstrikeNdjson,
  isValidCrowdstrikeNdjson,
  EXPORT_FORMATS,
  renderExport,
  defaultExportFilename,
} from "../../src/locate/export/index.ts";
import { toSarif, isValidSarifShape } from "../../src/locate/sarif.ts";
import { runFixtureLocalization } from "../../src/locate/fixture.ts";
import { defaultFixtureRepo } from "../../src/locate/fixture.ts";

function sample() {
  return runFixtureLocalization(
    {
      kind: "cwe",
      id: "CWE-89",
      cweId: "CWE-89",
      title: "SQL Injection",
    },
    defaultFixtureRepo(),
  );
}

describe("defender exporters (schema smoke)", () => {
  it("exports all official formats", () => {
    assert.deepEqual(EXPORT_FORMATS, [
      "sarif",
      "asff",
      "splunk",
      "xsoar",
      "fortisiem",
      "crowdstrike",
    ]);
    assert.equal(defaultExportFilename("asff"), "asff-findings.json");
    assert.equal(
      defaultExportFilename("splunk"),
      "splunk-cim-vulnerabilities.json",
    );
    assert.equal(defaultExportFilename("xsoar"), "xsoar-incidents.json");
    assert.equal(defaultExportFilename("fortisiem"), "fortisiem-custom.json");
    assert.equal(
      defaultExportFilename("crowdstrike"),
      "crowdstrike-hec-events.ndjson",
    );
  });

  it("SARIF 2.1.0 file-level note with partialFingerprints", () => {
    const sarif = toSarif(sample());
    assert.equal(isValidSarifShape(sarif), true);
    assert.equal(sarif.version, "2.1.0");
    assert.ok(sarif.runs[0].tool.driver.rules.length >= 1);
    assert.ok(sarif.runs[0].results.length >= 1);
    assert.equal(sarif.runs[0].results[0].level, "note");
    assert.ok(sarif.runs[0].results[0].partialFingerprints);
  });

  it("ASFF SchemaVersion 2018-10-08, CWE Types, FindingProviderFields severity", () => {
    const doc = toAsff(sample(), { awsAccountId: "123456789012" });
    assert.equal(isValidAsffShape(doc), true);
    const f = doc.Findings[0];
    assert.equal(f.SchemaVersion, "2018-10-08");
    assert.equal(f.AwsAccountId, "123456789012");
    assert.match(f.ProductArn, /arn:aws:securityhub:/);
    assert.ok(
      f.Types.some((t) => t.includes("CWE-89")),
      "Types must use CWE id, not invent CVE",
    );
    assert.equal(f.FindingProviderFields.Severity.Label, "INFORMATIONAL");
    assert.equal(f.Resources[0].Type, "Other");
    assert.equal(f.Vulnerabilities?.[0]?.Id, "CWE-89");
    // No top-level partner Severity required for our projection
    assert.equal("Severity" in f, false);
  });

  it("Splunk CIM fields; no invented cvss; recommended sourcetype", () => {
    const doc = toSplunkCim(sample());
    assert.equal(isValidSplunkShape(doc), true);
    assert.equal(doc.sourcetype_recommendation, "zeroday:antares:json");
    const e = doc.events[0];
    assert.equal(e.severity, "informational");
    assert.equal(e.xref, "CWE-89");
    assert.ok(e.dest && e.dvc && e.signature && e.signature_id);
    assert.equal("cvss" in e, false);
    // CWE advisory input — no cve field invented
    assert.equal(e.cve, undefined);
  });

  it("XSOAR incident array without invented startLine", () => {
    const doc = toXsoar(sample());
    assert.equal(isValidXsoarShape(doc), true);
    assert.ok(Array.isArray(doc));
    assert.ok(doc[0].cwe && doc[0].file_path && doc[0].type);
    assert.equal("startLine" in doc[0], false);
  });

  it("FortiSIEM generic JSON without PH_DEV_MON claim", () => {
    const doc = toFortisiem(sample());
    assert.equal(isValidFortisiemShape(doc), true);
    assert.equal(doc.events[0].vendor, "ZERODAY");
    assert.equal(doc.events[0].eventType, "VulnerabilityLocalization");
  });

  it("CrowdStrike HEC NDJSON without #cps tags", () => {
    const ndjson = toCrowdstrikeNdjson(sample());
    assert.equal(isValidCrowdstrikeNdjson(ndjson), true);
    assert.ok(!ndjson.includes("#cps"));
    const line = JSON.parse(ndjson.trim().split("\n")[0]);
    assert.equal(line.vendor, "ZERODAY");
    assert.ok(line.host && line.message && line.file_path);
  });

  it("renderExport produces parseable bodies", () => {
    const result = sample();
    for (const fmt of EXPORT_FORMATS) {
      const body = renderExport(result, fmt);
      assert.ok(body.length > 0);
      if (fmt === "crowdstrike") {
        assert.equal(isValidCrowdstrikeNdjson(body), true);
      } else {
        JSON.parse(body);
      }
    }
  });
});
