/**
 * Minimal resolve check: README Actions badge URL ↔ workflow file + name,
 * and stranger ci-trust one-pager stays honest (non-claims).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const WORKFLOW_REL = ".github/workflows/zeroday-locate.yml";
const BADGE_SVG =
  "https://github.com/pandeyaby/ZERODAY/actions/workflows/zeroday-locate.yml/badge.svg";
const BADGE_HREF =
  "https://github.com/pandeyaby/ZERODAY/actions/workflows/zeroday-locate.yml";

describe("CI trust badge + ci-trust one-pager", () => {
  it("README badge URL resolves to workflow file with badge-friendly name", () => {
    const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
    const wfPath = path.join(root, WORKFLOW_REL);
    assert.ok(fs.existsSync(wfPath), `missing ${WORKFLOW_REL}`);

    assert.match(
      readme,
      new RegExp(
        `\\[!\\[ZERODAY locate\\]\\(${BADGE_SVG.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\)\\]\\(${BADGE_HREF.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\)`,
      ),
    );
    assert.match(readme, /docs\/ci-trust\.md/);
    assert.match(readme, /paired-probe/);
    assert.match(readme, /gate_axis_mutate/);

    const wf = fs.readFileSync(wfPath, "utf8");
    const nameMatch = wf.match(/^name:\s*(.+)\s*$/m);
    assert.ok(nameMatch, "workflow missing top-level name:");
    const workflowName = nameMatch[1].trim();
    assert.equal(workflowName, "ZERODAY locate");
    assert.ok(
      workflowName.length > 0 && workflowName.length <= 64,
      "badge-friendly workflow name should be short",
    );
    assert.doesNotMatch(workflowName, /[{}$]|github\./);

    assert.match(wf, /^ {2}paired-probe:\s*$/m);
    assert.match(wf, /gate_axis_mutate/);
    assert.match(wf, /all.?8|all 8/i);
    assert.match(wf, /npm run test:paired-probes/);
    assert.match(wf, /npm run paired-probe/);
    // Stranger prove-doors visible next to locate CI (keyless; Door B citation-only)
    assert.match(wf, /^ {2}stranger-verify:\s*$/m);
    assert.match(wf, /npm run stranger:verify/);
    assert.match(wf, /npm run prove-doors/);
    assert.match(
      wf,
      /--json|ZERODAY_STRANGER_JSON/,
      "locate stranger-verify job should emit machine-readable JSON",
    );
    assert.match(wf, /stranger-verify\.json/);
    assert.match(wf, /prove-doors\.json/);
    assert.match(wf, /upload-artifact@/);
    assert.match(wf, /name:\s*stranger-verify-json/);
    assert.match(wf, /name:\s*prove-doors-json/);
    assert.match(wf, /assert-prove-doors-ci-json\.mjs/);
    // Isolate job body until the next top-level job key (e.g. `packet:`).
    // Do not use `\z` — in JS that is the letter `z`, which truncates at `zeroday-…`.
    const strangerJob = wf.match(
      /^ {2}stranger-verify:\n([\s\S]*?)(?=^ {2}[a-z][a-z0-9-]*:\s*$)/m,
    );
    assert.ok(strangerJob, "could not isolate stranger-verify job block");
    // Denial prose may say "no RunPod"; forbid live flags / tokens / pod creates only.
    assert.doesNotMatch(
      strangerJob[1],
      /--endpoint|--live\b|HF_TOKEN|HF_HUB|create-pod|runpodctl|api\.runpod/i,
    );
  });

  it("docs/ci-trust.md exists with honest prove / non-prove surface", () => {
    const docPath = path.join(root, "docs/ci-trust.md");
    assert.ok(fs.existsSync(docPath), "missing docs/ci-trust.md");
    const doc = fs.readFileSync(docPath, "utf8");

    assert.match(doc, /ZERODAY locate/);
    assert.match(doc, /zeroday-locate\.yml/);
    assert.match(doc, /paired-probe/);
    assert.match(doc, /gate_axis_mutate/);
    assert.match(doc, /all.?8|all 8/i);
    assert.match(doc, /stranger-verify|stranger:verify/);
    assert.match(doc, /What the badge \*\*does\*\* prove/);
    assert.match(doc, /What the badge does \*\*not\*\* prove/);
    assert.match(doc, /≠ vulnerability|not.*exploitability|≠.*exploitability/i);
    assert.match(doc, /≠ live Antares|not.*Antares File F1|≠.*File F1/i);
    assert.match(doc, /DIPTYCH grades/i);
    assert.match(doc, /no GPU|No GPU/i);
    assert.match(doc, /AUROC/i);
    assert.doesNotMatch(doc, /\bFile F1\s*[:=]\s*0?\.\d+/i);
    assert.doesNotMatch(doc, /\bAUROC\s*[:=]\s*0?\.\d+/i);
  });

  it("SUPPORT + design-partner-trust + docs index link ci-trust.md", () => {
    for (const rel of [
      "SUPPORT.md",
      "docs/design-partner-trust.md",
      "docs/README.md",
      "docs/paired-probes.md",
    ]) {
      const text = fs.readFileSync(path.join(root, rel), "utf8");
      assert.match(text, /ci-trust\.md/, `${rel} should link docs/ci-trust.md`);
    }
  });
});
