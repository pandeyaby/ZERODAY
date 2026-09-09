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
    ) as { scripts: Record<string, string> };
    for (const s of FORBIDDEN_PACKAGE_SCRIPTS) {
      assert.equal(pkg.scripts[s], undefined, `script ${s} must be removed`);
    }
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
  });

  it("SCOPE is defensive localization — not red-team RoE theater", () => {
    const scope = fs.readFileSync(
      path.join(root, "SCOPE_AND_AUTHORIZATION.md"),
      "utf8",
    );
    assert.doesNotMatch(scope, /Plinius|G0DM0D3|T3MP3ST|kill-chain|Gated PoC/i);
    assert.match(scope, /defensive/i);
    assert.match(scope, /evidence/i);
  });
});
