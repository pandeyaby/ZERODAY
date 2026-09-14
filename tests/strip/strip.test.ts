import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const FORBIDDEN_PATHS = [
  "src/plinius",
  "src/stego",
  "src/agents/operators",
  "src/components/plinius",
  "src/components/stego",
  "src/app/api/plinius",
  "src/app/api/stego",
  "src/app/api/missions",
  "docs/plinius.md",
  "docs/stego.md",
  "vendor/plinius",
];

const FORBIDDEN_PACKAGE_SCRIPTS = [
  "plinius:init",
  "plinius:status",
  "plinius:st3gg-deps",
];

const FORBIDDEN_PRODUCT_PATTERNS =
  /plinius|stego|tokenade|nmap_syn|Exploiter|elder-plinius|G0DM0D3|L1B3RT4S/i;

describe("strip confirmation — no offensive product surface", () => {
  it("removed Plinius / stego / kill-chain modules from tree", () => {
    for (const rel of FORBIDDEN_PATHS) {
      const abs = path.join(root, rel);
      assert.equal(
        fs.existsSync(abs),
        false,
        `must not ship ${rel}`,
      );
    }
  });

  it("package.json has no plinius scripts", () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(root, "package.json"), "utf8"),
    ) as { scripts: Record<string, string>; license?: string };
    for (const s of FORBIDDEN_PACKAGE_SCRIPTS) {
      assert.equal(pkg.scripts[s], undefined, `script ${s} must be removed`);
    }
    assert.equal(pkg.scripts["war-room"], undefined, "war-room script renamed");
    assert.ok(pkg.scripts.operator, "operator script required");
    assert.equal(pkg.license, "Apache-2.0");
  });

  it("CLI has no missions/launch/authorize/stego/plinius commands", () => {
    const cli = fs.readFileSync(path.join(root, "cli/index.ts"), "utf8");
    assert.doesNotMatch(cli, /\.command\("missions"\)/);
    assert.doesNotMatch(cli, /\.command\("launch"\)/);
    assert.doesNotMatch(cli, /\.command\("authorize"\)/);
    assert.doesNotMatch(cli, /\.command\("stego"\)/);
    assert.doesNotMatch(cli, /\.command\("plinius"\)/);
    assert.match(cli, /\.command\("operate"\)/);
    assert.match(cli, /\.command\("verify"\)/);
    assert.match(cli, /\.command\("factory"\)/);
    assert.match(cli, /\.command\("mvp"\)/);
    assert.match(cli, /\.command\("antares"\)/);
    assert.match(cli, /\.command\("record"\)/);
    assert.match(cli, /--recording/);
  });

  it("mission stubs stay stubbed (no offensive mission theater)", () => {
    const missionsDir = path.join(root, "examples/missions");
    for (const name of fs.readdirSync(missionsDir)) {
      if (!name.endsWith(".yaml") && !name.endsWith(".yml")) continue;
      const text = fs.readFileSync(path.join(missionsDir, name), "utf8");
      assert.match(text, /removed from the product surface|use examples\/factory/i);
      assert.doesNotMatch(text, /kill-chain stages|exploit chain|red team playbook/i);
    }
  });

  it("SCOPE is defensive localization — not red-team RoE theater", () => {
    const scope = fs.readFileSync(
      path.join(root, "SCOPE_AND_AUTHORIZATION.md"),
      "utf8",
    );
    assert.doesNotMatch(scope, FORBIDDEN_PRODUCT_PATTERNS);
    assert.match(scope, /defensive/i);
    assert.match(scope, /evidence/i);
    assert.match(scope, /Acceptable Use/i);
  });

  it("Dockerfile / health / README product paths have no forbidden tokens", () => {
    for (const rel of [
      "Dockerfile",
      "src/app/api/health/route.ts",
      "cli/index.ts",
      "package.json",
    ]) {
      const text = fs.readFileSync(path.join(root, rel), "utf8");
      assert.doesNotMatch(
        text,
        FORBIDDEN_PRODUCT_PATTERNS,
        `${rel} must not contain forbidden product tokens`,
      );
    }
  });
});
