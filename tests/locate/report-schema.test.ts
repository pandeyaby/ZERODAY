/**
 * Stability contract: every report.json ZERODAY writes validates against the
 * published schema (docs/schemas/zeroday.report.v1.schema.json). A change that
 * removes or retypes a field fails here before it reaches a release.
 */

import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { locate } from "../../src/locate/index.ts";
import { scanRepo } from "../../src/locate/scan.ts";
import { assertValidReport as assertValid, validateReport as validate } from "./report-schema.helper.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const out = () => fs.mkdtempSync(path.join(os.tmpdir(), "zd-schema-"));

// Recorded OSV advisories and an empty cache: the CVE case must not depend on the network or ~/.cache.
before(() => {
  process.env.ZERODAY_OSV_DIR = path.join(root, "fixtures/advisories/osv");
  process.env.ZERODAY_CACHE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-cache-"));
});

describe("report.json schema (zeroday.report/v1)", () => {
  it("rules mode on a CWE", async () => {
    const a = await locate({ repo: path.join(root, "fixtures/locate/rules-sample"), advisory: "CWE-89", rules: true, offline: true, outputDir: out() });
    const r = assertValid(a.jsonPath);
    assert.ok((r.rankedFiles as unknown[]).length >= 1);
  });

  it("rules mode on a CVE with dependency exposure", async () => {
    const a = await locate({ repo: path.join(root, "fixtures/advisory/npm-lodash"), advisory: "CVE-2021-23337", rules: true, offline: true, outputDir: out() });
    const r = assertValid(a.jsonPath) as { summary: { advisoryMatch?: { verdict: string } } };
    assert.equal(r.summary.advisoryMatch?.verdict, "affected");
  });

  it("rules mode on a CWE the rules cannot scan", async () => {
    const a = await locate({ repo: path.join(root, "fixtures/locate/rules-sample"), advisory: "CWE-287", rules: true, offline: true, outputDir: out() });
    const r = assertValid(a.jsonPath) as { summary: { unsupportedCwe?: boolean } };
    assert.equal(r.summary.unsupportedCwe, true);
  });

  it("fixture (recorded Antares) mode", async () => {
    const a = await locate({ repo: path.join(root, "fixtures/locate/demo-app"), advisory: "CWE-89", fixture: true, outputDir: out() });
    assertValid(a.jsonPath);
  });

  it("baseline and changed-since runs", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zd-schema-repo-"));
    fs.mkdirSync(path.join(dir, "src"));
    fs.writeFileSync(path.join(dir, "src/old.js"), 'const q = "SELECT * FROM t WHERE id = " + req.query.id;\ndb.query(q);\n');
    const git = (...a: string[]) => execFileSync("git", a, { cwd: dir, stdio: "ignore" });
    git("init", "-q");
    git("-c", "user.email=t@t", "-c", "user.name=t", "add", ".");
    git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "base");
    const base = await locate({ repo: dir, advisory: "CWE-89", rules: true, offline: true, outputDir: out() });
    fs.writeFileSync(path.join(dir, "src/new.js"), 'const q = "DELETE FROM t WHERE id = " + req.body.id;\ndb.query(q);\n');
    const next = await locate({ repo: dir, advisory: "CWE-89", rules: true, offline: true, outputDir: out(), baseline: base.jsonPath });
    const r = assertValid(next.jsonPath) as { summary: { baseline?: { new: number } } };
    assert.equal(r.summary.baseline?.new, 1);
    const changed = await locate({ repo: dir, advisory: "CWE-89", rules: true, offline: true, outputDir: out(), changedSince: "HEAD" });
    assertValid(changed.jsonPath);
  });

  it("scan (rules only)", async () => {
    const a = await scanRepo({ repo: path.join(root, "fixtures/locate/rules-sample"), outputDir: out(), antares: "off" });
    const r = assertValid(a.jsonPath) as { summary: { scan?: { cwesRules: string[] } } };
    assert.equal(r.summary.scan?.cwesRules.length, 10);
  });

  it("rejects a report missing a required field (the schema is not vacuous)", async () => {
    const a = await locate({ repo: path.join(root, "fixtures/locate/rules-sample"), advisory: "CWE-89", rules: true, offline: true, outputDir: out() });
    const report = JSON.parse(fs.readFileSync(a.jsonPath, "utf8")) as Record<string, unknown>;
    delete report.rankedFiles;
    assert.equal(validate(report), false);
    assert.equal(validate({ ...report, rankedFiles: [], schema: "zeroday.report/v2" }), false);
  });
});
