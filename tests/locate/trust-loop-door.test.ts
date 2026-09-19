/**
 * Door test: stranger trust-loop docs + npm script exist (keyless glue).
 * Does not run full emit — covered by paired-probe-from-sarif tests.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("stranger trust-loop door", () => {
  it("package.json exposes trust-loop → scripts/trust-loop.sh", () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(root, "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };
    assert.ok(pkg.scripts["trust-loop"], "missing npm run trust-loop");
    assert.match(pkg.scripts["trust-loop"], /trust-loop\.sh/);
    assert.ok(
      fs.existsSync(path.join(root, "scripts/trust-loop.sh")),
      "missing scripts/trust-loop.sh",
    );
    const script = fs.readFileSync(
      path.join(root, "scripts/trust-loop.sh"),
      "utf8",
    );
    assert.match(script, /paired-probe:from-sarif/);
    assert.match(script, /diptych-sample-grade\.md/);
    assert.match(script, /localization ≠ exploitability|localization != exploitability/i);
    assert.match(script, /no AUROC|AUROC/i);
    assert.match(script, /DIPTYCH grades/);
  });

  it("README + paired-probes document Stranger trust loop (≤3 commands)", () => {
    const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
    const paired = fs.readFileSync(
      path.join(root, "docs/paired-probes.md"),
      "utf8",
    );
    for (const text of [readme, paired]) {
      assert.match(text, /Stranger trust loop/i);
      assert.match(text, /npm run mvp/);
      assert.match(text, /paired-probe:from-sarif/);
      assert.match(text, /diptych-sample-grade\.md/);
      assert.match(text, /npm run trust-loop/);
      assert.match(text, /localization ≠ exploitability|localization != exploitability/i);
      assert.match(text, /no AUROC|AUROC/i);
    }
    assert.match(readme, /SUPPORT\.md/);
    assert.match(paired, /design-partner-trust\.md/);
    assert.match(paired, /SUPPORT\.md/);
  });

  it("SUPPORT + design-partner-trust cross-link the trust loop", () => {
    const support = fs.readFileSync(path.join(root, "SUPPORT.md"), "utf8");
    const trust = fs.readFileSync(
      path.join(root, "docs/design-partner-trust.md"),
      "utf8",
    );
    assert.match(support, /trust.loop|trust-loop|paired-probe/i);
    assert.match(support, /diptych-sample-grade\.md/);
    assert.match(trust, /Stranger trust loop/i);
    assert.match(trust, /paired-probe:from-sarif/);
    assert.match(trust, /npm run trust-loop/);
    assert.match(trust, /SUPPORT\.md/);
  });

  it("Desk FAQ includes stranger trust-loop Q&A", () => {
    const content = fs.readFileSync(
      path.join(root, "src/faq/content.ts"),
      "utf8",
    );
    assert.match(content, /stranger-trust-loop/);
    assert.match(content, /What is the stranger trust loop/);
    assert.match(content, /paired-probe:from-sarif/);
    assert.match(content, /npm run trust-loop/);
    assert.match(content, /diptych-sample-grade/);
  });

  it("checked-in sample grade docs still exist", () => {
    assert.ok(
      fs.existsSync(path.join(root, "docs/reports/diptych-sample-grade.md")),
    );
    assert.ok(
      fs.existsSync(path.join(root, "docs/reports/diptych-sample-grade.json")),
    );
  });
});
