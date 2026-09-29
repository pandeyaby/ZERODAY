/**
 * Findings in tests / specs / fixtures rank after application code (Juice Shop:
 * 48 hard-coded-credential files, many of them specs, crowded out real code).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { isLowPriorityPath, isTestPath } from "../../src/locate/test-paths.ts";
import { runRulesLocalization } from "../../src/locate/rules/index.ts";

describe("test files rank last", () => {
  it("recognizes test, spec, fixture and e2e paths", () => {
    for (const p of [
      "test/api.js",
      "src/__tests__/a.ts",
      "frontend/src/app/nft-unlock/nft-unlock.component.spec.ts",
      "cypress/e2e/contact.cy.ts",
      "pkg/server/handler_test.go",
      "tests/test_views.py",
      "app/test_utils.py",
      "src/main/java/FooTest.java",
      "fixtures/users.json",
      "lib/a.test.mjs",
    ]) {
      assert.equal(isTestPath(p), true, p);
    }
    for (const p of ["routes/redirect.ts", "lib/insecurity.ts", "src/testimonials.ts", "contest/app.py", "latest/index.js"]) {
      assert.equal(isTestPath(p), false, p);
    }
  });

  it("vendored and minified code is low priority too", () => {
    for (const p of ["frontend/src/assets/private/dat.gui.min.js", "vendor/github.com/x/y.go", "static/app.bundle.js", "third_party/lib.py"]) {
      assert.equal(isLowPriorityPath(p), true, p);
    }
    assert.equal(isLowPriorityPath("routes/redirect.ts"), false);
  });

  it("application code outranks a higher-scoring spec file", async () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), "zd-testpaths-"));
    fs.mkdirSync(path.join(repo, "src"));
    fs.mkdirSync(path.join(repo, "test"));
    fs.writeFileSync(path.join(repo, "src", "config.js"), `const password = "Sup3rS3cretPass!";\nmodule.exports = { password };\n`);
    fs.writeFileSync(
      path.join(repo, "test", "config.spec.js"),
      `const password = "An0therS3cret!"; const apiKey = "AKIAIOSFODNN7EXAMPLE"; const token = "ghp_0123456789abcdefghijklmnopqrstuvwxyzAB";\n`,
    );
    const r = await runRulesLocalization({ kind: "cwe", id: "CWE-798", cweId: "CWE-798" }, repo, { offline: true });
    assert.deepEqual(r.rankedFiles.map((f) => f.filePath), ["src/config.js", "test/config.spec.js"]);
  });
});
