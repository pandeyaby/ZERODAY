/**
 * Door test: opt-in stranger:verify pre-commit hook (keyless, no GPU).
 * Asserts script surface, skip/dry-run/--help, and package hooks:install.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const HOOK = path.join(
  root,
  "scripts/git-hooks/pre-commit-stranger-verify.sh",
);
const INSTALL = path.join(
  root,
  "scripts/git-hooks/install-stranger-verify-hook.sh",
);

describe("opt-in stranger:verify pre-commit hook", () => {
  it("package.json exposes hooks:install → install script", () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(root, "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };
    assert.ok(pkg.scripts["hooks:install"], "missing npm run hooks:install");
    assert.match(
      pkg.scripts["hooks:install"],
      /install-stranger-verify-hook\.sh/,
    );
    // Must stay opt-in — no prepare auto-install
    assert.equal(pkg.scripts.prepare, undefined);
    assert.ok(fs.existsSync(HOOK), "missing pre-commit-stranger-verify.sh");
    assert.ok(fs.existsSync(INSTALL), "missing install-stranger-verify-hook.sh");
  });

  it("hook script is keyless Door A + skippable; no GPU / Antares", () => {
    const script = fs.readFileSync(HOOK, "utf8");
    assert.match(script, /stranger:verify/);
    assert.match(script, /SKIP=stranger-verify|SKIP.*stranger-verify/);
    assert.match(script, /--dry-run/);
    assert.match(script, /--help/);
    assert.match(script, /no GPU|keyless|citation/i);
    assert.doesNotMatch(script, /create-pod|runpod create|auto-provision/i);
    assert.doesNotMatch(script, /model\.safetensors|huggingface.*download/i);
  });

  it("--help and --dry-run exit 0 without running stranger:verify", () => {
    const help = spawnSync("bash", [HOOK, "--help"], {
      encoding: "utf8",
      cwd: root,
    });
    assert.equal(help.status, 0, help.stderr);
    assert.match(help.stdout, /stranger:verify|SKIP=stranger-verify/);

    const dry = spawnSync("bash", [HOOK, "--dry-run"], {
      encoding: "utf8",
      cwd: root,
    });
    assert.equal(dry.status, 0, dry.stderr);
    assert.match(dry.stdout, /dry-run/i);
    assert.match(dry.stdout, /stranger:verify/);
    assert.doesNotMatch(dry.stdout, /Door A PASS|trust-loop/i);
  });

  it("SKIP=stranger-verify exits 0 without running the gate", () => {
    const result = spawnSync("bash", [HOOK], {
      encoding: "utf8",
      cwd: root,
      env: { ...process.env, SKIP: "stranger-verify" },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /SKIP=stranger-verify|skipping/i);
  });

  it("install script --help / --dry-run exit 0", () => {
    const help = spawnSync("bash", [INSTALL, "--help"], {
      encoding: "utf8",
      cwd: root,
    });
    assert.equal(help.status, 0, help.stderr);
    assert.match(help.stdout, /hooks:install|stranger:verify/);

    const dry = spawnSync("bash", [INSTALL, "--dry-run"], {
      encoding: "utf8",
      cwd: root,
    });
    assert.equal(dry.status, 0, dry.stderr);
    assert.match(dry.stdout, /dry-run/i);
  });

  it("docs mention optional pre-commit + Day-1 one-liner", () => {
    const stranger = fs.readFileSync(
      path.join(root, "docs/stranger-verify.md"),
      "utf8",
    );
    assert.match(stranger, /Optional local pre-commit/);
    assert.match(stranger, /npm run hooks:install/);
    assert.match(stranger, /SKIP=stranger-verify/);
    assert.match(stranger, /CI remains source of truth/i);

    const day1 = fs.readFileSync(
      path.join(root, "docs/design-partner-day1.md"),
      "utf8",
    );
    assert.match(day1, /hooks:install/);
    assert.match(day1, /SKIP=stranger-verify|--no-verify/);
  });
});
