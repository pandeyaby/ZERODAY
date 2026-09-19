/**
 * Door test: stranger prove-doors (stranger:verify / doors) — keyless glue.
 * Asserts package scripts, docs links, honest card facts, and exit 0 on
 * the keyless path (reuses trust-loop; never runs live GPU).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import os from "node:os";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("stranger prove-doors (stranger:verify)", () => {
  it("package.json exposes stranger:verify + doors → scripts/stranger-verify.sh", () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(root, "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };
    assert.ok(pkg.scripts["stranger:verify"], "missing npm run stranger:verify");
    assert.ok(pkg.scripts.doors, "missing npm run doors alias");
    assert.match(pkg.scripts["stranger:verify"], /stranger-verify\.sh/);
    assert.match(pkg.scripts.doors, /stranger-verify\.sh/);
    assert.ok(
      fs.existsSync(path.join(root, "scripts/stranger-verify.sh")),
      "missing scripts/stranger-verify.sh",
    );
    const script = fs.readFileSync(
      path.join(root, "scripts/stranger-verify.sh"),
      "utf8",
    );
    assert.match(script, /trust-loop/);
    assert.match(script, /gpu-claims\.md/);
    assert.match(script, /Live re-proof|2026-09-19/);
    assert.match(script, /d65ny3xqf7bwza/);
    assert.match(script, /\$0\.034|0\.034/);
    assert.match(script, /src\/users\.js/);
    assert.match(script, /localization ≠ exploitability|localization != exploitability/i);
    assert.match(script, /CI badge|ci-trust/i);
    assert.match(script, /no AUROC|AUROC/i);
    assert.match(script, /DIPTYCH grades/i);
    assert.match(script, /illustrative/i);
    // Must not auto-provision or spend GPU
    assert.doesNotMatch(script, /create-pod|runpod create|auto-provision/i);
    assert.match(script, /NOT run|citation only|Do not provision/i);
  });

  it("README links ci-trust + gpu-claims and documents stranger:verify", () => {
    const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
    assert.match(readme, /What a stranger can verify today/i);
    assert.match(readme, /npm run stranger:verify/);
    assert.match(readme, /npm run doors/);
    assert.match(readme, /docs\/ci-trust\.md/);
    assert.match(readme, /docs\/gpu-claims\.md/);
    assert.match(readme, /docs\/stranger-verify\.md/);
    assert.match(readme, /d65ny3xqf7bwza/);
    assert.match(readme, /Live re-proof \(2026-09-19\)/);
    assert.match(readme, /localization ≠ exploitability|localization != exploitability/i);
    assert.match(readme, /CI badge ≠ vuln|CI badge.*vuln/i);
    assert.match(readme, /no AUROC|AUROC/i);
  });

  it("docs/stranger-verify.md + docs index + ci-trust cross-link", () => {
    const docPath = path.join(root, "docs/stranger-verify.md");
    assert.ok(fs.existsSync(docPath), "missing docs/stranger-verify.md");
    const doc = fs.readFileSync(docPath, "utf8");
    assert.match(doc, /stranger:verify/);
    assert.match(doc, /trust-loop/);
    assert.match(doc, /ci-trust\.md/);
    assert.match(doc, /gpu-claims\.md/);
    assert.match(doc, /d65ny3xqf7bwza/);
    assert.match(doc, /2026-09-19/);
    assert.match(doc, /no AUROC|AUROC/i);
    assert.match(doc, /DIPTYCH grades/i);

    const index = fs.readFileSync(path.join(root, "docs/README.md"), "utf8");
    assert.match(index, /stranger-verify\.md/);

    const ciTrust = fs.readFileSync(path.join(root, "docs/ci-trust.md"), "utf8");
    assert.match(ciTrust, /stranger:verify|stranger-verify/);
  });

  it("npm run stranger:verify exits 0 on keyless path", () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-stranger-"));
    const result = spawnSync("npm", ["run", "stranger:verify"], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, TRUST_LOOP_OUT: out },
      timeout: 120_000,
    });
    assert.equal(
      result.status,
      0,
      `stranger:verify failed:\n${result.stdout}\n${result.stderr}`,
    );
    assert.match(result.stdout, /Door A/i);
    assert.match(result.stdout, /Door B/i);
    assert.match(result.stdout, /PASS/);
    assert.match(result.stdout, /d65ny3xqf7bwza/);
    assert.match(result.stdout, /src\/users\.js/);
    assert.match(result.stdout, /gpu-claims\.md/);
    assert.doesNotMatch(result.stdout, /\bAUROC\s*[:=]\s*0?\.\d+/i);
    assert.ok(
      fs.existsSync(path.join(out, "paired-probe")),
      "expected paired-probe envelopes under TRUST_LOOP_OUT",
    );
  });
});
