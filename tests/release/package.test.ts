/**
 * 0.7 release contract: npm CLI package manifest + single version source.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildManifest, NPM_PACKAGE_NAME } from "../../scripts/pack-cli.mjs";
import { ZERODAY_VERSION } from "../../src/version.ts";
import { toSarif } from "../../src/locate/sarif.ts";
import { runRulesLocalization } from "../../src/locate/index.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const rootPkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

describe("npm CLI package (zeroday-cli)", () => {
  it("manifest is CLI-only: bin zeroday, deps commander + tsx", () => {
    const m = buildManifest(rootPkg);
    assert.equal(m.name, NPM_PACKAGE_NAME);
    assert.equal(m.version, rootPkg.version);
    assert.deepEqual(m.bin, { zeroday: "bin/zeroday.mjs" });
    assert.deepEqual(Object.keys(m.dependencies).sort(), ["commander", "tsx"]);
    for (const v of Object.values(m.dependencies)) assert.ok(v, "dependency version resolved");
    assert.ok(!("private" in m), "published manifest must not be private");
  });

  it("bin launcher exists and is executable", () => {
    const bin = path.join(root, "bin/zeroday.mjs");
    assert.ok(fs.existsSync(bin));
    assert.ok(fs.statSync(bin).mode & 0o111, "bin/zeroday.mjs must be executable");
    assert.equal(rootPkg.bin.zeroday, "./bin/zeroday.mjs");
  });
});

describe("single version source", () => {
  it("ZERODAY_VERSION matches package.json and SARIF driver version", async () => {
    assert.equal(ZERODAY_VERSION, rootPkg.version);
    const result = await runRulesLocalization(
      { kind: "cwe", id: "CWE-89", cweId: "CWE-89" },
      path.join(root, "fixtures/locate/rules-sample"),
    );
    assert.equal(toSarif(result).runs[0].tool.driver.version, rootPkg.version);
  });

  it("no hardcoded semver version strings left in CLI / SARIF / health", () => {
    for (const rel of [
      "cli/index.ts",
      "src/locate/sarif.ts",
      "src/factory/inventory-reports.ts",
      "src/app/api/health/route.ts",
    ]) {
      const text = fs.readFileSync(path.join(root, rel), "utf8");
      // SARIF's own spec version ("2.1.0") is fine; tool / CLI / API versions are not.
      assert.doesNotMatch(
        text,
        /\.version\("\d+\.\d+\.\d+"\)|driver:\s*\{[^}]*?version:\s*"\d|ok: true,[^}]*?version:\s*"\d/,
        rel,
      );
    }
  });
});
