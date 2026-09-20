/**
 * Door test: opt-in prove-doors pre-commit hook (keyless Door A + cassette).
 * Asserts script surface, skip/dry-run/--help, invoke, and fail-closed non-zero.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const HOOK = path.join(root, "scripts/git-hooks/pre-commit-prove-doors.sh");
const INSTALL = path.join(
  root,
  "scripts/git-hooks/install-prove-doors-hook.sh",
);

describe("opt-in prove-doors pre-commit hook", () => {
  it("package.json exposes hooks:install-prove-doors → install script (opt-in)", () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(root, "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };
    assert.ok(
      pkg.scripts["hooks:install-prove-doors"],
      "missing npm run hooks:install-prove-doors",
    );
    assert.match(
      pkg.scripts["hooks:install-prove-doors"],
      /install-prove-doors-hook\.sh/,
    );
    assert.ok(pkg.scripts["prove-doors"], "missing npm run prove-doors");
    // Must stay opt-in — no prepare auto-install
    assert.equal(pkg.scripts.prepare, undefined);
    assert.ok(fs.existsSync(HOOK), "missing pre-commit-prove-doors.sh");
    assert.ok(fs.existsSync(INSTALL), "missing install-prove-doors-hook.sh");
  });

  it("hook script is keyless Door A + cassette; no --live-url / GPU", () => {
    const script = fs.readFileSync(HOOK, "utf8");
    assert.match(script, /prove-doors/);
    assert.match(script, /SKIP=prove-doors|SKIP.*prove-doors/);
    assert.match(script, /--dry-run/);
    assert.match(script, /--help/);
    assert.match(script, /no --live-url|Never passes --live-url/i);
    assert.match(script, /no GPU|keyless|cassette/i);
    assert.match(script, /GATE_CMD=\(npm run prove-doors\)/);
    assert.doesNotMatch(script, /GATE_CMD=.*--live-url/);
    assert.doesNotMatch(script, /create-pod|runpod create|auto-provision/i);
    assert.doesNotMatch(script, /model\.safetensors|huggingface.*download/i);
  });

  it("--help and --dry-run exit 0 without running prove-doors", () => {
    const help = spawnSync("bash", [HOOK, "--help"], {
      encoding: "utf8",
      cwd: root,
    });
    assert.equal(help.status, 0, help.stderr);
    assert.match(help.stdout, /prove-doors|SKIP=prove-doors/);

    const dry = spawnSync("bash", [HOOK, "--dry-run"], {
      encoding: "utf8",
      cwd: root,
    });
    assert.equal(dry.status, 0, dry.stderr);
    assert.match(dry.stdout, /dry-run/i);
    assert.match(dry.stdout, /prove-doors/);
    assert.doesNotMatch(dry.stdout, /Door A PASS|cassette:replay complete/i);
  });

  it("SKIP=prove-doors exits 0 without running the gate", () => {
    const result = spawnSync("bash", [HOOK], {
      encoding: "utf8",
      cwd: root,
      env: { ...process.env, SKIP: "prove-doors" },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /SKIP=prove-doors|skipping/i);
  });

  it("hook invoke exits non-zero when node_modules missing (fail-closed)", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zd-prove-doors-hook-"));
    try {
      const init = spawnSync("git", ["init"], {
        cwd: tmp,
        encoding: "utf8",
      });
      assert.equal(init.status, 0, init.stderr);

      fs.writeFileSync(
        path.join(tmp, "package.json"),
        JSON.stringify({ name: "tmp-prove-doors-hook", private: true }),
      );
      const hookDir = path.join(tmp, "scripts/git-hooks");
      fs.mkdirSync(hookDir, { recursive: true });
      const tmpHook = path.join(hookDir, "pre-commit-prove-doors.sh");
      fs.copyFileSync(HOOK, tmpHook);
      fs.chmodSync(tmpHook, 0o755);

      const result = spawnSync("bash", [tmpHook], {
        encoding: "utf8",
        cwd: tmp,
        env: { ...process.env, SKIP: "" },
      });
      assert.notEqual(result.status, 0, "expected fail-closed non-zero");
      assert.equal(result.status, 1);
      assert.match(
        `${result.stdout}\n${result.stderr}`,
        /node_modules missing/i,
      );
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("install script --help / --dry-run exit 0", () => {
    const help = spawnSync("bash", [INSTALL, "--help"], {
      encoding: "utf8",
      cwd: root,
    });
    assert.equal(help.status, 0, help.stderr);
    assert.match(help.stdout, /hooks:install-prove-doors|prove-doors/);

    const dry = spawnSync("bash", [INSTALL, "--dry-run"], {
      encoding: "utf8",
      cwd: root,
    });
    assert.equal(dry.status, 0, dry.stderr);
    assert.match(dry.stdout, /dry-run/i);
  });

  it("docs mention optional prove-doors pre-commit (opt-in)", () => {
    const stranger = fs.readFileSync(
      path.join(root, "docs/stranger-verify.md"),
      "utf8",
    );
    assert.match(stranger, /hooks:install-prove-doors/);
    assert.match(stranger, /opt-in/i);
  });
});
