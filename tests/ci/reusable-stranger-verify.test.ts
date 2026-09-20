/**
 * Light assert: reusable stranger-verify workflow is callable and keyless.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const WORKFLOW_REL = ".github/workflows/stranger-verify.yml";

describe("reusable stranger-verify workflow", () => {
  it("has workflow_call and runs npm run stranger:verify (no GPU)", () => {
    const wfPath = path.join(root, WORKFLOW_REL);
    assert.ok(fs.existsSync(wfPath), `missing ${WORKFLOW_REL}`);
    const wf = fs.readFileSync(wfPath, "utf8");

    assert.match(wf, /workflow_call/);
    assert.match(wf, /npm run stranger:verify/);
    assert.match(wf, /npm run prove-doors/);
    assert.match(wf, /repository:\s*\$\{\{\s*inputs\.zeroday_repository\s*\}\}/);
    assert.match(wf, /pandeyaby\/ZERODAY/);
    assert.match(
      wf,
      /--json|ZERODAY_STRANGER_JSON/,
      "reusable stranger-verify should emit machine-readable JSON",
    );
    assert.match(wf, /stranger-verify\.json/);
    assert.match(wf, /prove-doors\.json/);
    assert.match(wf, /gpu-evidence/);
    assert.match(wf, /gpu-evidence\.json/);
    assert.match(wf, /upload-artifact/);
    assert.match(wf, /stranger-verify-json/);
    assert.match(wf, /prove-doors-json/);
    assert.match(wf, /gpu-evidence-json/);
    assert.match(wf, /evidence-pack/);
    assert.match(wf, /out\/evidence/);
    assert.match(wf, /doctor/);
    assert.match(wf, /out\/doctor\.json/);
    assert.match(wf, /assert-prove-doors-ci-json\.mjs/);
    assert.match(wf, /assert-gpu-evidence-ci-json\.mjs/);
    assert.match(wf, /assert-evidence-pack-ci-json\.mjs/);
    assert.match(wf, /assert-doctor-ci-json\.mjs/);
    assert.doesNotMatch(wf, /--endpoint|--live|HF_TOKEN|HF_HUB|create-pod/i);
    assert.match(wf, /no GPU|keyless/i);
  });
});
