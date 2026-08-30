import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseAdvisory,
  detectAdvisoryKind,
  listFixtureAdvisories,
} from "../../src/locate/parse.ts";
import {
  resolveAdvisory,
  resolveAdvisorySync,
  resolveFromNvd,
  resolveFromGhsa,
} from "../../src/locate/resolve.ts";

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

  it("rejects unmapped CVE sync", () => {
    assert.throws(() => parseAdvisory("CVE-1999-0001"), /vendored advisory/);
  });

  it("lists fixture advisories", () => {
    const keys = listFixtureAdvisories();
    assert.ok(keys.includes("CWE-89"));
    assert.ok(keys.includes("CVE-2024-89001"));
  });
});

describe("advisory resolve (NVD/GHSA metadata only)", () => {
  it("resolveAdvisorySync maps vendored CVE", () => {
    const r = resolveAdvisorySync("CVE-2024-89001");
    assert.equal(r.cweId, "CWE-89");
    assert.equal(r.category, "sql-injection");
    assert.equal(r.source, "vendored");
  });

  it("resolveAdvisory offline uses vendored map", async () => {
    const r = await resolveAdvisory("CVE-2024-89001", { offline: true });
    assert.equal(r.cweId, "CWE-89");
  });

  it("resolveAdvisory accepts explicit CWE override", async () => {
    const r = await resolveAdvisory("CVE-1999-0001", {
      offline: true,
      explicitCwe: "CWE-89",
    });
    assert.equal(r.cweId, "CWE-89");
    assert.equal(r.source, "explicit-cwe");
  });

  it("resolveFromNvd extracts CWE from weaknesses (mocked)", async () => {
    const fetchImpl = async () =>
      new Response(
        JSON.stringify({
          vulnerabilities: [
            {
              cve: {
                id: "CVE-2024-TEST",
                descriptions: [{ lang: "en", value: "Test" }],
                weaknesses: [
                  { description: [{ lang: "en", value: "CWE-79" }] },
                ],
                references: [{ url: "https://nvd.nist.gov/" }],
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    const r = await resolveFromNvd("CVE-2024-TEST", { fetchImpl: fetchImpl as typeof fetch });
    assert.ok(r);
    assert.equal(r!.cweId, "CWE-79");
    assert.equal(r!.source, "nvd");
  });

  it("resolveFromGhsa extracts CWE (mocked)", async () => {
    const fetchImpl = async () =>
      new Response(
        JSON.stringify({
          ghsa_id: "GHSA-aaaa-bbbb-cccc",
          summary: "XSS",
          cwes: [{ cwe_id: "CWE-79", name: "XSS" }],
          references: [{ url: "https://github.com/" }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    const r = await resolveFromGhsa("GHSA-aaaa-bbbb-cccc", {
      fetchImpl: fetchImpl as typeof fetch,
    });
    assert.ok(r);
    assert.equal(r!.cweId, "CWE-79");
    assert.equal(r!.source, "ghsa");
  });

  it("filters exploit-db references from NVD", async () => {
    const fetchImpl = async () =>
      new Response(
        JSON.stringify({
          vulnerabilities: [
            {
              cve: {
                weaknesses: [
                  { description: [{ value: "CWE-89" }] },
                ],
                references: [
                  { url: "https://exploit-db.com/exploits/1" },
                  { url: "https://nvd.nist.gov/vuln/detail/CVE-X" },
                ],
              },
            },
          ],
        }),
        { status: 200 },
      );
    const r = await resolveFromNvd("CVE-X", { fetchImpl: fetchImpl as typeof fetch });
    assert.ok(r);
    assert.ok(!(r!.references ?? []).some((u) => /exploit-db/i.test(u)));
  });
});
