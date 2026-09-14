/**
 * Desk slice C — harden recommendations tests (fixture / docs/reports only).
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  buildHardenReport,
  defaultHardenReportsDir,
  isHardenFindingKind,
  loadHardenSources,
  toHardenRecommendations,
  writeHardenReport,
} from "../../src/harden/index.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const deskBReports = path.join(root, "docs/reports");
const deskAPacket = path.join(root, "docs/reports/desk-a-packet");

describe("harden recommendation mapping (no guessing)", () => {
  it("maps inventory kinds deterministically", () => {
    assert.equal(isHardenFindingKind("agent_harness"), true);
    assert.equal(isHardenFindingKind("dependency_harness"), true);
    assert.equal(isHardenFindingKind("ci_secret_pattern"), true);
    assert.equal(isHardenFindingKind("env_example_honesty"), true);
    assert.equal(isHardenFindingKind("config_surface"), true);
    assert.equal(isHardenFindingKind("something_novel"), false);

    const recs = toHardenRecommendations([
      {
        id: "a1",
        kind: "agent_harness",
        path: "AGENTS.md",
        pattern: "remote-fetch-hint",
        repoId: "aomb",
      },
      {
        id: "d1",
        kind: "dependency_harness",
        path: "package.json",
        pattern: "scripts.postinstall",
        repoId: "webuzz",
      },
      {
        id: "x1",
        kind: "novel_kind",
        path: "x",
      },
    ]);
    assert.equal(recs.length, 2);
    assert.equal(recs.find((r) => r.evidence.findingId === "a1")?.category, "agent-harness");
    assert.equal(
      recs.find((r) => r.evidence.findingId === "d1")?.category,
      "package-scripts",
    );
    assert.equal(
      recs.find((r) => r.evidence.findingId === "a1")?.priority,
      "high",
    );
  });

  it("includes CodeGuard refs only when draft requested", () => {
    const base = toHardenRecommendations([
      {
        id: "a1",
        kind: "agent_harness",
        path: "AGENTS.md",
        pattern: "code-exec-hint",
      },
    ]);
    assert.equal(base[0]!.codeguard, undefined);

    const withDraft = toHardenRecommendations(
      [
        {
          id: "a1",
          kind: "agent_harness",
          path: "AGENTS.md",
          pattern: "code-exec-hint",
        },
      ],
      { includeDraftRefs: true },
    );
    assert.ok(withDraft[0]!.codeguard?.ruleId);
    assert.match(withDraft[0]!.codeguard!.ruleId, /codeguard-/);
  });
});

describe("harden from desk-b docs/reports", () => {
  it("loads desk-b inventory without re-scan", () => {
    const loaded = loadHardenSources(deskBReports);
    assert.ok(loaded.inventoryJsonPath?.endsWith("desk-b-inventory.json"));
    assert.ok(loaded.findings.length > 0);
  });

  it("builds recommend-only report with redaction + posture", () => {
    const report = buildHardenReport(deskBReports);
    assert.equal(report.schemaVersion, "zeroday-harden-recommendations/v1");
    assert.equal(report.desk, "C");
    assert.equal(report.posture.recommendationsOnly, true);
    assert.equal(report.posture.noAutoApply, true);
    assert.equal(report.posture.noAutoPr, true);
    assert.equal(report.posture.noAutoMerge, true);
    assert.equal(report.posture.noPoC, true);
    assert.equal(report.posture.secretsRedacted, true);
    assert.equal(report.posture.needsHuman, true);
    assert.equal(report.draftNotes.length, 0);
    assert.ok(report.recommendations.length >= 10);
    assert.ok(report.categoryCounts["agent-harness"] >= 1);
    assert.ok(report.categoryCounts["secrets-hygiene"] >= 1);
    assert.ok(report.categoryCounts["package-scripts"] >= 1);

    const blob = JSON.stringify(report);
    assert.doesNotMatch(blob, /sk_[A-Za-z0-9]{10,}/);
    assert.doesNotMatch(blob, /ghp_[A-Za-z0-9]{10,}/);
    assert.doesNotMatch(blob, /\b(write|craft)\s+an?\s+exploit\b/i);
    for (const r of report.recommendations) {
      assert.ok(r.recommendation.length > 0);
      assert.ok(r.evidence.findingId.length > 0);
    }
  });

  it("writeHardenReport emits harden.md + harden.json (no drafts by default)", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-harden-"));
    const result = writeHardenReport(deskBReports, dir);
    assert.ok(fs.existsSync(result.hardenJsonPath));
    assert.ok(fs.existsSync(result.hardenMdPath));
    assert.ok(fs.existsSync(result.readmePath));
    assert.equal(result.draftDir, null);
    assert.equal(result.draftPaths.length, 0);
    assert.ok(!fs.existsSync(path.join(dir, "drafts")));

    const md = fs.readFileSync(result.hardenMdPath, "utf8");
    assert.match(md, /Desk C/i);
    assert.match(md, /Recommend-only|recommendations only/i);
    assert.match(md, /no auto-apply/i);
    assert.match(md, /no auto-PR|no auto-pr/i);
    assert.match(md, /No PoC|no PoC/i);
    assert.doesNotMatch(md, /\b(write|craft)\s+an?\s+exploit\b/i);
  });

  it("writeHardenReport --draft emits human-gated CodeGuard notes", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-harden-draft-"));
    const result = writeHardenReport(deskBReports, dir, { draft: true });
    assert.ok(result.draftDir);
    assert.ok(result.draftPaths.length >= 1);
    assert.ok(fs.existsSync(result.draftDir!));
    const sample = fs.readFileSync(result.draftPaths[0]!, "utf8");
    assert.match(sample, /DRAFT ONLY/i);
    assert.match(sample, /Never auto-apply|no auto-apply/i);
    assert.match(sample, /CodeGuard/i);
    assert.doesNotMatch(sample, /CodeGuard-approved/i);
    assert.doesNotMatch(sample, /\b(write|craft)\s+an?\s+exploit\b/i);
    assert.ok(result.report.draftNotes.length >= 1);
  });

  it("defaultHardenReportsDir points at docs/reports", () => {
    assert.equal(defaultHardenReportsDir(root), deskBReports);
  });
});

describe("harden from desk-a packet", () => {
  it("consumes packet findings without re-inventory", () => {
    const loaded = loadHardenSources(deskAPacket);
    assert.ok(loaded.packetJsonPath?.endsWith("packet.json"));
    assert.ok(loaded.findings.length > 0);
    const report = buildHardenReport(deskAPacket);
    assert.ok(report.categoryCounts["agent-harness"] >= 1);
    assert.ok(report.categoryCounts["package-scripts"] >= 1);
    // Packet excludes config_surface noise
    assert.equal(report.categoryCounts["config-surface"], 0);
  });
});

describe("harden CLI", () => {
  it("npm run zeroday -- harden --fixture writes harden dir", () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-harden-cli-"));
    const r = spawnSync(
      "npx",
      ["tsx", "cli/index.ts", "harden", "--fixture", "--output", out],
      {
        cwd: root,
        encoding: "utf8",
        env: { ...process.env, CI: "true" },
      },
    );
    assert.equal(r.status, 0, r.stderr || r.stdout);
    assert.match(r.stdout, /harden \(Desk C\)/i);
    assert.match(r.stdout, /Recommend-only|no auto-apply/i);
    assert.ok(fs.existsSync(path.join(out, "harden.json")));
    assert.ok(fs.existsSync(path.join(out, "harden.md")));
    const j = JSON.parse(fs.readFileSync(path.join(out, "harden.json"), "utf8"));
    assert.equal(j.schemaVersion, "zeroday-harden-recommendations/v1");
    assert.equal(j.desk, "C");
  });

  it("harden --from docs/reports/desk-a-packet --draft works as one-command path", () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-harden-from-"));
    const r = spawnSync(
      "npx",
      [
        "tsx",
        "cli/index.ts",
        "harden",
        "--from",
        "docs/reports/desk-a-packet",
        "--draft",
        "--output",
        out,
      ],
      {
        cwd: root,
        encoding: "utf8",
        env: { ...process.env, CI: "true" },
      },
    );
    assert.equal(r.status, 0, r.stderr || r.stdout);
    assert.ok(fs.existsSync(path.join(out, "harden.md")));
    assert.ok(fs.existsSync(path.join(out, "drafts")));
    assert.ok(fs.readdirSync(path.join(out, "drafts")).some((n) => n.endsWith(".md")));
  });
});
