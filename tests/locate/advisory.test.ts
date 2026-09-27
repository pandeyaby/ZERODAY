/**
 * Advisory matching: OSV records (recorded fixtures, offline) → lockfile
 * versions → affected? → importing files / vulnerable call sites.
 */

import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compareVersions, fixedVersionFor, inRange } from "../../src/locate/advisory/versions.ts";
import { readDependencies } from "../../src/locate/advisory/lockfiles.ts";
import { canonicalOsvId } from "../../src/locate/advisory/osv.ts";
import { functionsFromPatch } from "../../src/locate/advisory/symbols.ts";
import { matchAdvisory } from "../../src/locate/advisory/match.ts";
import { locate } from "../../src/locate/index.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const fx = (name: string) => path.join(root, "fixtures/advisory", name);

before(() => {
  process.env.ZERODAY_OSV_DIR = path.join(root, "fixtures/advisories/osv");
  process.env.ZERODAY_CACHE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-cache-"));
});

function tmpRepo(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-adv-"));
  for (const [rel, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), body);
  }
  return dir;
}

describe("advisory versions", () => {
  it("semver incl. pre-release and Go pseudo-versions", () => {
    assert.ok(compareVersions("npm", "4.17.15", "4.17.21") < 0);
    assert.ok(compareVersions("npm", "1.0.0-rc.1", "1.0.0") < 0);
    assert.ok(compareVersions("Go", "0.0.0-20220127200216-cd36cc0744dd", "0.0.0-20220906165146-f3363e06e74c") < 0);
    assert.ok(compareVersions("Go", "v1.19.1", "1.19.0-0") > 0);
  });

  it("PEP 440 and Maven orderings", () => {
    assert.ok(compareVersions("PyPI", "5.3.1", "5.4") < 0);
    assert.ok(compareVersions("PyPI", "5.4b1", "5.4") < 0);
    assert.ok(compareVersions("PyPI", "5.4.post1", "5.4") > 0);
    assert.equal(compareVersions("Maven", "2.15", "2.15.0"), 0);
    assert.ok(compareVersions("Maven", "2.0-beta9", "2.0") < 0);
    assert.ok(compareVersions("Maven", "2.14.1", "2.15.0") < 0);
  });

  it("OSV range events incl. multiple introduced/fixed pairs and last_affected", () => {
    const go = { type: "SEMVER" as const, events: [{ introduced: "0" }, { fixed: "1.18.6" }, { introduced: "1.19.0-0" }, { fixed: "1.19.1" }] };
    assert.equal(inRange("Go", "1.18.2", go), true);
    assert.equal(inRange("Go", "1.18.6", go), false);
    assert.equal(inRange("Go", "1.19.0", go), true);
    assert.equal(inRange("Go", "1.19.1", go), false);
    assert.equal(inRange("npm", "4.5.0", { type: "ECOSYSTEM", events: [{ introduced: "0" }, { last_affected: "4.5.0" }] }), true);
    assert.equal(inRange("npm", "4.5.1", { type: "ECOSYSTEM", events: [{ introduced: "0" }, { last_affected: "4.5.0" }] }), false);
    assert.equal(fixedVersionFor("Go", "1.19.0", [go]), "1.19.1");
  });
});

describe("advisory lockfiles", () => {
  it("reads npm (lock v1/v3, yarn v1/berry, pnpm), Python, Go, Maven, Gradle pins", () => {
    const dir = tmpRepo({
      "a/package-lock.json": JSON.stringify({ lockfileVersion: 3, packages: { "": {}, "node_modules/lodash": { version: "4.17.15" }, "node_modules/x/node_modules/minimist": { version: "0.0.8" } } }),
      "b/package-lock.json": JSON.stringify({ lockfileVersion: 1, dependencies: { qs: { version: "6.5.1", dependencies: { "side-channel": { version: "1.0.4" } } } } }),
      "c/yarn.lock": `lodash@^4.17.15:\n  version "4.17.15"\n  resolved "x"\n\n"@babel/core@^7.0.0", "@babel/core@^7.1.0":\n  version "7.12.3"\n`,
      "d/yarn.lock": `"lodash@npm:^4.17.20":\n  version: 4.17.20\n  resolution: "lodash@npm:4.17.20"\n`,
      "e/pnpm-lock.yaml": `packages:\n\n  /axios@0.21.0:\n    resolution: {}\n  '@types/node@20.1.0':\n    resolution: {}\n`,
      "f/requirements.txt": `Django==3.2.1\nrequests>=2.20  # range\n-r other.txt\n`,
      "g/poetry.lock": `[[package]]\nname = "Jinja2"\nversion = "2.10"\n`,
      "h/go.mod": `module x\n\ngo 1.21\n\nrequire (\n\tgithub.com/gin-gonic/gin v1.7.0 // indirect\n)\nrequire golang.org/x/text v0.3.5\n`,
      "i/pom.xml": `<project><properties><jackson.version>2.9.8</jackson.version></properties><dependencies><dependency><groupId>com.fasterxml.jackson.core</groupId><artifactId>jackson-databind</artifactId><version>\${jackson.version}</version></dependency></dependencies></project>`,
      "j/gradle.lockfile": `org.springframework:spring-core:5.3.17=compileClasspath\n`,
      "k/package.json": JSON.stringify({ dependencies: { express: "^4.17.1" } }),
    });
    const got = readDependencies(dir).map((d) => `${d.ecosystem}:${d.name}@${d.version}${d.exact ? "" : "~"}`);
    for (const want of [
      "npm:lodash@4.17.15",
      "npm:minimist@0.0.8",
      "npm:qs@6.5.1",
      "npm:side-channel@1.0.4",
      "npm:@babel/core@7.12.3",
      "npm:lodash@4.17.20",
      "npm:axios@0.21.0",
      "npm:@types/node@20.1.0",
      "PyPI:django@3.2.1",
      "PyPI:requests@2.20~",
      "PyPI:jinja2@2.10",
      "Go:github.com/gin-gonic/gin@1.7.0",
      "Go:golang.org/x/text@0.3.5",
      "Go:stdlib@1.21~",
      "Maven:com.fasterxml.jackson.core:jackson-databind@2.9.8",
      "Maven:org.springframework:spring-core@5.3.17",
      "npm:express@4.17.1~",
    ]) {
      assert.ok(got.includes(want), `missing ${want} in ${got.join(", ")}`);
    }
  });

  it("canonical OSV ids", () => {
    assert.equal(canonicalOsvId("ghsa-35JH-r3h4-6jhm"), "GHSA-35jh-r3h4-6jhm");
    assert.equal(canonicalOsvId("cve-2021-23337"), "CVE-2021-23337");
  });

  it("fix-commit hunk headers name the changed functions", () => {
    const patch = "@@ -10,4 +10,6 @@ function template(string, options, guard) {\n@@ -1 +1 @@ def full_load(stream):\n@@ -3 +3 @@ func (s *Server) ServeConn(c net.Conn) {\n";
    assert.deepEqual([...functionsFromPatch(patch)].sort(), ["ServeConn", "full_load", "template"]);
  });

  it("fix-commit functions skip the regression tests the fix adds", () => {
    const patch = [
      "diff --git a/torch/nn/functional.py b/torch/nn/functional.py",
      "@@ -1 +1 @@ def ctc_loss(log_probs, targets):",
      "diff --git a/test/test_nn.py b/test/test_nn.py",
      "@@ -1 +1 @@ def test_ctc_loss_cudnn_tensor(self):",
      "diff --git a/lib/parse.go b/lib/parse.go",
      "@@ -1 +1 @@ func TestParse(t *testing.T) {",
      "",
    ].join("\n");
    assert.deepEqual([...functionsFromPatch(patch)], ["ctc_loss"]);
  });
});

describe("advisory matching (recorded OSV fixtures, offline)", () => {
  it("npm: affected lodash → template call site outranks lockfile and import-only file", async () => {
    const m = await matchAdvisory("CVE-2021-23337", fx("npm-lodash"), { offline: true });
    assert.equal(m.verdict, "affected");
    assert.deepEqual(m.packages.map((p) => [p.name, p.installed, p.affected, p.fixed]), [["lodash", "4.17.15", true, "4.17.21"]]);
    assert.ok(m.symbols.includes("template"));
    assert.deepEqual(m.hits.map((h) => h.filePath), ["src/email.js", "package-lock.json", "src/cart.js"]);
    assert.equal(m.hits[0]!.ruleId, "advisory/vulnerable-call");
    assert.ok(!m.hits.some((h) => h.filePath === "src/util.js"));
  });

  it("npm: fixed version is not affected", async () => {
    const m = await matchAdvisory("GHSA-35jh-r3h4-6jhm", fx("npm-lodash-fixed"), { offline: true });
    assert.equal(m.verdict, "not-affected");
    assert.equal(m.hits.length, 0);
  });

  it("PyPI: PyYAML → yaml.full_load call", async () => {
    const m = await matchAdvisory("CVE-2020-14343", fx("py-yaml"), { offline: true });
    assert.equal(m.verdict, "affected");
    assert.equal(m.hits[0]!.filePath, "app/config.py");
    assert.match(m.hits[0]!.title, /full_load/);
  });

  it("Go: stdlib + x/net pseudo-version; OSV symbols find ListenAndServe", async () => {
    const m = await matchAdvisory("CVE-2022-27664", fx("go-http"), { offline: true });
    assert.equal(m.verdict, "affected");
    const names = m.packages.filter((p) => p.affected).map((p) => p.name).sort();
    assert.deepEqual(names, ["golang.org/x/net", "stdlib"]);
    assert.equal(m.symbolSource, "osv-symbols");
    assert.ok(m.hits.some((h) => h.filePath === "main.go" && /ListenAndServe/.test(h.title)));
    assert.ok(!m.hits.some((h) => h.filePath === "util/strings.go"));
  });

  it("Maven: Log4Shell via ${property} version", async () => {
    const m = await matchAdvisory("CVE-2021-44228", fx("java-log4j"), { offline: true });
    assert.equal(m.verdict, "affected");
    assert.equal(m.packages[0]!.fixed, "2.15.0");
    assert.deepEqual(m.hits.map((h) => h.filePath), ["pom.xml", "src/main/java/com/example/OrderService.java"]);
  });

  it("not used / no data", async () => {
    assert.equal((await matchAdvisory("CVE-2021-44228", fx("npm-lodash"), { offline: true })).verdict, "not-used");
    const none = await matchAdvisory("CVE-1999-0001", fx("npm-lodash"), { offline: true });
    assert.equal(none.verdict, "no-data");
    assert.match(none.notes[0]!, /offline/);
  });
});

describe("locate --rules with a CVE", () => {
  it("unmapped CVE resolves via OSV and reports exposure in report.json + report.md", async () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-adv-locate-"));
    const a = await locate({ repo: fx("py-yaml"), advisory: "CVE-2020-14343", rules: true, offline: true, outputDir: out });
    assert.equal(a.result.advisory.cweId, "CWE-20");
    assert.equal(a.result.summary.unsupportedCwe, undefined);
    assert.equal(a.result.summary.advisoryMatch?.verdict, "affected");
    assert.equal(a.result.rankedFiles[0]!.filePath, "app/config.py");
    assert.match(fs.readFileSync(a.reportPath, "utf8"), /## Dependency exposure[\s\S]*pyyaml/);
  });
});
