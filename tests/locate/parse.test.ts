import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseAdvisory,
  detectAdvisoryKind,
  listFixtureAdvisories,
} from "../../src/locate/parse.ts";

describe("advisory parsing", () => {
  it("parses CWE ids", () => {
    const a = parseAdvisory("cwe-89");
    assert.equal(a.kind, "cwe");
    assert.equal(a.id, "CWE-89");
    assert.equal(a.cweId, "CWE-89");
  });

  it("parses CVE fixture mapping", () => {
    const a = parseAdvisory("CVE-2024-89001");
    assert.equal(a.kind, "cve");
    assert.equal(a.cweId, "CWE-89");
  });

  it("parses GHSA fixture mapping", () => {
    const a = parseAdvisory("GHSA-demo-0000-sql1");
    assert.equal(a.kind, "ghsa");
    assert.equal(a.cweId, "CWE-89");
    assert.equal(a.id, "ghsa-demo-0000-sql1");
  });

  it("rejects garbage", () => {
    assert.equal(detectAdvisoryKind("not-an-id"), null);
    assert.throws(() => parseAdvisory("SQLI"), /Unrecognized/);
  });

  it("rejects unmapped CVE", () => {
    assert.throws(() => parseAdvisory("CVE-1999-0001"), /built-in advisory/);
  });

  it("lists fixture advisories", () => {
    const keys = listFixtureAdvisories();
    assert.ok(keys.includes("CWE-89"));
  });
});
