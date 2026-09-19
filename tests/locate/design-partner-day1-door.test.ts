/**
 * Door test: design-partner Day-1 checklist doc exists and links key paths.
 * Light assert only — no GPU, no invented metrics.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DAY1 = "docs/design-partner-day1.md";

describe("design-partner Day-1 checklist", () => {
  it("exists and links mvp + stranger:verify + gpu-claims + ci-trust", () => {
    const docPath = path.join(root, DAY1);
    assert.ok(fs.existsSync(docPath), `missing ${DAY1}`);
    const doc = fs.readFileSync(docPath, "utf8");

    assert.match(doc, /npm run mvp/);
    assert.match(doc, /npm run stranger:verify/);
    assert.match(doc, /npm run trust-loop/);
    assert.match(doc, /gpu-claims\.md/);
    assert.match(doc, /ci-trust\.md/);
    assert.match(doc, /Live re-proof/);
    assert.match(doc, /workflow_call|stranger-verify\.yml/);
    assert.match(doc, /localization ≠ exploitability|localization != exploitability/i);
    assert.match(doc, /no AUROC|AUROC/i);
    assert.match(doc, /DIPTYCH grades/i);
    assert.match(doc, /illustrative/i);
    assert.doesNotMatch(doc, /create-pod|auto-provision|AUROC\s*[:=]\s*0?\.\d+/i);
  });

  it("README + SUPPORT + design-partner-trust + stranger-verify cross-link day1", () => {
    const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
    const support = fs.readFileSync(path.join(root, "SUPPORT.md"), "utf8");
    const trust = fs.readFileSync(
      path.join(root, "docs/design-partner-trust.md"),
      "utf8",
    );
    const stranger = fs.readFileSync(
      path.join(root, "docs/stranger-verify.md"),
      "utf8",
    );
    const index = fs.readFileSync(path.join(root, "docs/README.md"), "utf8");

    assert.match(readme, /design-partner-day1\.md/);
    assert.match(support, /design-partner-day1\.md/);
    assert.match(trust, /design-partner-day1\.md/);
    assert.match(stranger, /design-partner-day1\.md/);
    assert.match(index, /design-partner-day1\.md/);
  });
});
