/**
 * Desk slice D — defensive craft tests (fixture / docs/reports only).
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  buildCraftReport,
  craftRequestLooksOffensive,
  defaultCraftReportsDir,
  distillCraftPatterns,
  loadCraftSources,
  refuseOffensiveCraft,
  renderSkillMarkdown,
  writeCraftReport,
  CraftRefuseError,
} from "../../src/craft/index.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const deskReports = path.join(root, "docs/reports");

describe("craft offensive refusal", () => {
  it("detects offensive / PoC / attack skill patterns", () => {
    assert.equal(craftRequestLooksOffensive("zeroday-defensive-operator"), false);
    assert.equal(craftRequestLooksOffensive("harden-agent-hygiene"), false);
    assert.equal(craftRequestLooksOffensive("exploit-kit-skill"), true);
    assert.equal(craftRequestLooksOffensive("write a poc"), true);
    assert.equal(craftRequestLooksOffensive("red-team attack-skill"), true);
    assert.equal(craftRequestLooksOffensive("jailbreak pack"), true);
    assert.equal(
      craftRequestLooksOffensive("auto-install into cursor"),
      true,
    );
    assert.ok(refuseOffensiveCraft(["payload dropper skill"])?.refused);
    assert.equal(refuseOffensiveCraft(["defensive localization"]), null);
  });
});

describe("craft patterns from desk reports", () => {
  it("loads Desk B/A/C/E artifacts without re-scan", () => {
    const loaded = loadCraftSources(deskReports);
    assert.ok(loaded.inventoryJsonPath?.endsWith("desk-b-inventory.json"));
    assert.ok(loaded.packetJsonPath?.endsWith("packet.json"));
    assert.ok(loaded.hardenJsonPath?.endsWith("harden.json"));
    assert.ok(loaded.classifyJsonPath?.endsWith("classify.json"));
    const patterns = distillCraftPatterns(loaded);
    assert.ok(patterns.length >= 5);
    const stages = new Set(patterns.map((p) => p.stage));
    assert.ok(stages.has("inventory"));
    assert.ok(stages.has("locate"));
    assert.ok(stages.has("packet"));
    assert.ok(stages.has("harden"));
    assert.ok(stages.has("classify"));
  });

  it("builds generate-only report with posture + habits", () => {
    const report = buildCraftReport(deskReports);
    assert.equal(report.schemaVersion, "zeroday-craft-scaffold/v1");
    assert.equal(report.desk, "D");
    assert.equal(report.posture.generateOnly, true);
    assert.equal(report.posture.noAutoInstall, true);
    assert.equal(report.posture.noMarketplacePublish, true);
    assert.equal(report.posture.noPoC, true);
    assert.equal(report.posture.refusesOffensive, true);
    assert.equal(report.posture.needsHuman, true);
    assert.equal(report.refused, false);
    assert.ok(report.scaffolds.some((s) => s.kind === "skill"));
    assert.ok(report.scaffolds.some((s) => s.kind === "plugin"));
    assert.ok(report.patterns.length >= 5);

    const blob = JSON.stringify(report);
    assert.doesNotMatch(blob, /sk_[A-Za-z0-9]{10,}/);
    assert.doesNotMatch(blob, /ghp_[A-Za-z0-9]{10,}/);
    assert.doesNotMatch(blob, /\b(write|craft)\s+an?\s+exploit\b/i);
  });

  it("refuses offensive name before writing", () => {
    assert.throws(
      () => buildCraftReport(deskReports, { name: "exploit-kit-skill" }),
      (err: unknown) => {
        assert.ok(err instanceof CraftRefuseError);
        assert.equal(err.refuse.refused, true);
        return true;
      },
    );
  });

  it("skill markdown encodes habit loop and forbids auto-install", () => {
    const report = buildCraftReport(deskReports);
    const md = renderSkillMarkdown({
      name: report.name,
      patterns: report.patterns,
      generatedAt: report.generatedAt,
      sourceLabel: report.source.reportsDir,
    });
    assert.match(md, /inventory/i);
    assert.match(md, /locate/i);
    assert.match(md, /packet/i);
    assert.match(md, /harden/i);
    assert.match(md, /classify/i);
    assert.match(md, /No auto-install|auto-install/i);
    assert.match(md, /Never.*exploit|no PoC|Never.*PoC/i);
    assert.doesNotMatch(md, /\b(write|craft)\s+an?\s+exploit\b/i);
  });
});

describe("craft write + CLI", () => {
  it("writeCraftReport emits skill + plugin scaffolds", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-craft-"));
    const result = writeCraftReport(deskReports, dir);
    assert.ok(fs.existsSync(result.craftJsonPath));
    assert.ok(fs.existsSync(result.craftMdPath));
    assert.ok(fs.existsSync(result.readmePath));
    assert.ok(result.skillPaths.length >= 1);
    assert.ok(result.pluginPaths.length >= 1);
    for (const p of result.skillPaths) {
      assert.ok(fs.existsSync(p));
      const md = fs.readFileSync(p, "utf8");
      assert.match(md, /^---/m);
      assert.match(md, /inventory → locate → packet → harden → classify/i);
    }
    const pluginJson = result.pluginPaths.find((p) => p.endsWith("plugin.json"));
    assert.ok(pluginJson);
    const pj = JSON.parse(fs.readFileSync(pluginJson!, "utf8"));
    assert.equal(pj.schemaVersion, "zeroday-craft-plugin-stub/v1");
    assert.equal(pj.posture.noAutoInstall, true);
    assert.equal(pj.posture.noMarketplacePublish, true);

    const md = fs.readFileSync(result.craftMdPath, "utf8");
    assert.match(md, /Desk D/i);
    assert.match(md, /Generate-only|generate-only/i);
    assert.match(md, /no auto-install/i);
    assert.match(md, /marketplace/i);
  });

  it("writeCraftReport --kind skill omits plugin", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-craft-skill-"));
    const result = writeCraftReport(deskReports, dir, { kind: "skill" });
    assert.ok(result.skillPaths.length >= 1);
    assert.equal(result.pluginPaths.length, 0);
    assert.ok(!fs.existsSync(path.join(dir, "plugins")));
  });

  it("defaultCraftReportsDir points at docs/reports", () => {
    assert.equal(defaultCraftReportsDir(root), deskReports);
  });

  it("npm run zeroday -- craft --fixture writes craft dir", () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-craft-cli-"));
    const r = spawnSync(
      "npx",
      ["tsx", "cli/index.ts", "craft", "--fixture", "--output", out],
      {
        cwd: root,
        encoding: "utf8",
        env: { ...process.env, CI: "true" },
      },
    );
    assert.equal(r.status, 0, r.stderr || r.stdout);
    assert.match(r.stdout, /craft \(Desk D\)/i);
    assert.match(r.stdout, /Generate-only|no auto-install/i);
    assert.ok(fs.existsSync(path.join(out, "craft.json")));
    assert.ok(fs.existsSync(path.join(out, "craft.md")));
    const j = JSON.parse(fs.readFileSync(path.join(out, "craft.json"), "utf8"));
    assert.equal(j.schemaVersion, "zeroday-craft-scaffold/v1");
    assert.equal(j.desk, "D");
  });

  it("craft refuses offensive --name with exit 3", () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-craft-refuse-"));
    const r = spawnSync(
      "npx",
      [
        "tsx",
        "cli/index.ts",
        "craft",
        "--fixture",
        "--name",
        "exploit-kit-skill",
        "--output",
        out,
      ],
      {
        cwd: root,
        encoding: "utf8",
        env: { ...process.env, CI: "true" },
      },
    );
    assert.equal(r.status, 3, r.stderr || r.stdout);
    assert.match(r.stderr || r.stdout, /refuses|offensive|PoC|exploit/i);
    assert.ok(!fs.existsSync(path.join(out, "craft.json")));
  });

  it("skill and plugin aliases work", () => {
    const skillOut = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-skill-"));
    const pluginOut = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-plugin-"));
    const s = spawnSync(
      "npx",
      ["tsx", "cli/index.ts", "skill", "--fixture", "--output", skillOut],
      { cwd: root, encoding: "utf8", env: { ...process.env, CI: "true" } },
    );
    assert.equal(s.status, 0, s.stderr || s.stdout);
    assert.ok(
      fs.readdirSync(path.join(skillOut, "skills"), { recursive: true }).length >
        0,
    );
    assert.ok(!fs.existsSync(path.join(skillOut, "plugins")));

    const p = spawnSync(
      "npx",
      ["tsx", "cli/index.ts", "plugin", "--fixture", "--output", pluginOut],
      { cwd: root, encoding: "utf8", env: { ...process.env, CI: "true" } },
    );
    assert.equal(p.status, 0, p.stderr || p.stdout);
    assert.ok(fs.existsSync(path.join(pluginOut, "plugins")));
    assert.ok(!fs.existsSync(path.join(pluginOut, "skills")));
  });
});
