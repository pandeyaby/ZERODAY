/**
 * Desk slice B — multi-repo + config inventory tests (fixture-only).
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  buildInventory,
  buildMultiRepoInventory,
  collectConfigHotspots,
  detectConfigSurface,
  loadInventoryManifest,
  parseInventoryManifest,
  redactInventoryText,
  sanitizeInventoryExport,
  toInventorySarif,
  writeInventory,
  writeMultiRepoInventory,
} from "../../src/factory/index.ts";
import { defaultFixtureRepo } from "../../src/locate/index.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const sidecar = path.join(root, "fixtures/inventory/sidecar-app");
const manifestJson = path.join(root, "fixtures/inventory/manifest.json");
const manifestYaml = path.join(root, "fixtures/inventory/manifest.yaml");
const deskBManifest = path.join(root, "fixtures/inventory/desk-b/manifest.json");

describe("config surface detection", () => {
  it("classifies Actions, Docker, compose, manifests, agent/skills, env.example", () => {
    assert.equal(
      detectConfigSurface(".github/workflows/ci.yml")?.surface,
      "github_actions",
    );
    assert.equal(detectConfigSurface("Dockerfile")?.surface, "docker");
    assert.equal(
      detectConfigSurface("docker-compose.yml")?.surface,
      "compose",
    );
    assert.equal(
      detectConfigSurface("package.json")?.surface,
      "package_manifest",
    );
    assert.equal(detectConfigSurface("AGENTS.md")?.surface, "agent_config");
    assert.equal(
      detectConfigSurface("skills/demo-skill/SKILL.md")?.surface,
      "skill_config",
    );
    assert.equal(
      detectConfigSurface(".github/CODEOWNERS")?.surface,
      "codeowners",
    );
    assert.equal(detectConfigSurface(".env.example")?.surface, "env_example");
    assert.equal(detectConfigSurface("src/users.js"), null);
  });
});

describe("single-repo inventory enrichment", () => {
  it("emits languages, hotspots, rankedPaths, findings for demo-app", () => {
    const inv = buildInventory(defaultFixtureRepo());
    assert.equal(inv.schemaVersion, "zeroday-factory-inventory/v1");
    assert.ok(inv.configHotspots.length >= 3);
    assert.ok(
      inv.configHotspots.some((h) => h.surface === "github_actions"),
      "expected GitHub Actions hotspot",
    );
    assert.ok(
      inv.configHotspots.some((h) => h.surface === "docker"),
      "expected Dockerfile hotspot",
    );
    assert.ok(
      inv.configHotspots.some((h) => h.surface === "package_manifest"),
    );
    assert.ok(inv.languages.some((l) => l.language === "JavaScript"));
    assert.ok(inv.rankedPaths.length >= 1);
    assert.equal(inv.rankedPaths[0]!.rank, 1);
    assert.ok(Array.isArray(inv.findings));
    assert.ok(inv.findings.some((f) => f.kind === "config_surface"));
    assert.equal(inv.posture.noPoC, true);
  });

  it("writes inventory.json + inventory.md + sarif + case-note", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-inv-"));
    const jsonPath = path.join(dir, "inventory.json");
    const inv = writeInventory(defaultFixtureRepo(), jsonPath);
    assert.ok(fs.existsSync(jsonPath));
    assert.ok(fs.existsSync(path.join(dir, "inventory.md")));
    assert.ok(fs.existsSync(path.join(dir, "inventory.sarif")));
    assert.ok(fs.existsSync(path.join(dir, "case-note.md")));
    const md = fs.readFileSync(path.join(dir, "inventory.md"), "utf8");
    assert.match(md, /Config hotspots/i);
    assert.match(md, /Ranked locate hints/i);
    assert.match(md, /No exploit|no PoC/i);
    assert.equal(inv.fileCount > 0, true);
  });
});

describe("multi-repo inventory", () => {
  it("parses JSON and YAML manifests", () => {
    const j = loadInventoryManifest(manifestJson);
    assert.equal(j.repos.length, 2);
    assert.equal(j.repos[0]!.id, "demo-app");

    const y = loadInventoryManifest(manifestYaml);
    assert.equal(y.repos.length, 2);
    assert.equal(y.repos[1]!.id, "sidecar-app");

    const parsed = parseInventoryManifest(
      JSON.stringify({ repos: [{ path: "./x", id: "x" }] }),
    );
    assert.equal(parsed.repos[0]!.path, "./x");
  });

  it("inventories demo-app + sidecar with global ranked hotspots", () => {
    const multi = buildMultiRepoInventory(
      [
        { path: defaultFixtureRepo(), id: "demo-app" },
        { path: sidecar, id: "sidecar-app" },
      ],
      { baseDir: root },
    );
    assert.equal(multi.schemaVersion, "zeroday-config-inventory/v1");
    assert.equal(multi.repoCount, 2);
    assert.equal(multi.posture.inventoryOnly, true);
    assert.ok(Array.isArray(multi.skipped));
    assert.ok(Array.isArray(multi.findings));
    assert.ok(multi.rankedHotspots.length >= 4);
    assert.equal(multi.rankedHotspots[0]!.rank, 1);
    assert.ok(multi.locateHints.length === 2);
    assert.ok(
      multi.repos.some((r) =>
        r.configHotspots.some((h) => h.surface === "compose"),
      ),
    );
    assert.ok(
      multi.repos.some((r) =>
        r.configHotspots.some((h) => h.surface === "agent_config"),
      ),
    );
    assert.ok(
      multi.repos.some((r) =>
        r.configHotspots.some((h) => h.surface === "skill_config"),
      ),
    );
  });

  it("writeMultiRepoInventory emits json, md, sarif, case-note, per-repo", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-minv-"));
    const { multi, jsonPath, mdPath, sarifPath, caseNotePath } =
      writeMultiRepoInventory(
        [
          { path: defaultFixtureRepo(), id: "demo-app" },
          { path: sidecar, id: "sidecar-app" },
        ],
        dir,
      );
    assert.ok(fs.existsSync(jsonPath));
    assert.ok(fs.existsSync(mdPath));
    assert.ok(sarifPath && fs.existsSync(sarifPath));
    assert.ok(caseNotePath && fs.existsSync(caseNotePath));
    assert.match(fs.readFileSync(mdPath, "utf8"), /multi-repo inventory/i);
    assert.ok(fs.existsSync(path.join(dir, "repos/demo-app/inventory.json")));
    assert.ok(
      fs.existsSync(path.join(dir, "repos/sidecar-app/inventory.md")),
    );
    assert.equal(multi.locateHints[0]!.paths.length > 0, true);
  });
});

describe("desk-b fixture inventory", () => {
  it("loads desk-b manifest with EternalEcho skip + optional snipercore", () => {
    const m = loadInventoryManifest(deskBManifest);
    assert.ok(m.skip?.some((s) => s.id === "EternalEcho"));
    assert.ok(m.repos.some((r) => r.id === "webuzz"));
    assert.ok(m.repos.some((r) => r.id === "zeroday"));
    assert.ok(m.repos.some((r) => r.id === "snipercore-external" && r.optional));
  });

  it("runs desk-b fixtures with secret patterns + harness findings (no secret values)", () => {
    const m = loadInventoryManifest(deskBManifest);
    const baseDir = path.dirname(deskBManifest);
    const entries = m.repos.map((r) => ({
      path: path.isAbsolute(r.path) ? r.path : path.resolve(baseDir, r.path),
      id: r.id,
      optional: r.optional === true,
    }));
    // Faster unit path: exclude inventoring full zeroday tree
    const slim = entries.filter((e) => e.id !== "zeroday");
    const multi = buildMultiRepoInventory(slim, { skipped: m.skip });
    assert.ok(multi.repoCount >= 4);
    assert.ok(multi.skipped.some((s) => s.id === "EternalEcho"));
    assert.ok(
      multi.findings.some(
        (f) => f.kind === "ci_secret_pattern" && f.pattern?.includes("NPM_TOKEN"),
      ),
    );
    assert.ok(
      multi.findings.some(
        (f) => f.kind === "dependency_harness" && f.repoId === "webuzz",
      ),
    );
    const blob = JSON.stringify(multi.findings);
    assert.doesNotMatch(blob, /\bsk_[A-Za-z0-9]{10,}\b/);
    const sarif = toInventorySarif(sanitizeInventoryExport(multi));
    const sarifBlob = JSON.stringify(sarif);
    assert.doesNotMatch(sarifBlob, /\/workspace\//);
    assert.equal(sarif.version, "2.1.0");
    assert.match(sarif.runs[0]!.tool.driver.name, /Inventory/);
  });
});

describe("hotspot ranking stability", () => {
  it("ranks Actions above lockfiles", () => {
    const files = [
      { path: ".github/workflows/ci.yml", bytes: 10, kind: "config" as const },
      { path: "package-lock.json", bytes: 10, kind: "manifest" as const },
      { path: "package.json", bytes: 10, kind: "manifest" as const },
    ];
    const hotspots = collectConfigHotspots(files);
    assert.ok(hotspots[0]!.score >= hotspots[hotspots.length - 1]!.score);
    assert.equal(hotspots[0]!.surface, "github_actions");
  });
});

describe("redaction helpers", () => {
  it("redacts absolute paths and token-shaped strings", () => {
    const s = redactInventoryText(
      "path /workspace/foo and token sk_testlivevalue1234567890",
      ["/workspace"],
    );
    assert.doesNotMatch(s, /\/workspace/);
    assert.match(s, /\[REDACTED\]/);
  });
});
