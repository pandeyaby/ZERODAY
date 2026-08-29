import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { locate, defaultFixtureRepo } from "../../src/locate/index.ts";
import { isValidSarifShape } from "../../src/locate/sarif.ts";

describe("locate end-to-end (fixture)", () => {
  it("writes JSON, SARIF, and human report", async () => {
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

    const sarif = JSON.parse(fs.readFileSync(artifacts.sarifPath, "utf8"));
    assert.equal(isValidSarifShape(sarif), true);
    assert.ok(artifacts.result.rankedFiles[0].filePath.includes("users.js"));
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
