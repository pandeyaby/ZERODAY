/**
 * Desk slice A — security packet tests (fixture / docs/reports only).
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  buildSecurityPacket,
  classifyInventoryKind,
  defaultPacketReportsDir,
  isPacketFindingKind,
  loadPacketSources,
  toPacketFindings,
  writeSecurityPacket,
} from "../../src/packet/index.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const deskBReports = path.join(root, "docs/reports");

describe("packet classification (no guessing)", () => {
  it("maps inventory kinds deterministically", () => {
    assert.equal(classifyInventoryKind("agent_harness").classification, "agent-misfire");
    assert.equal(classifyInventoryKind("dependency_harness").classification, "dependency");
    assert.equal(classifyInventoryKind("ci_secret_pattern").classification, "config");
    assert.equal(classifyInventoryKind("env_example_honesty").classification, "config");
    assert.equal(classifyInventoryKind("config_surface").classification, "unknown");
    assert.equal(classifyInventoryKind("something_novel").classification, "unknown");
  });

  it("excludes config_surface from packet findings list", () => {
    assert.equal(isPacketFindingKind("config_surface"), false);
    assert.equal(isPacketFindingKind("agent_harness"), true);
    const findings = toPacketFindings([
      {
        id: "s1",
        kind: "config_surface",
        path: "x",
        title: "surface",
        summary: "noise",
      },
      {
        id: "a1",
        kind: "agent_harness",
        path: "AGENTS.md",
        title: "agent",
        summary: "hint",
        repoId: "aomb",
        pattern: "remote-fetch-hint",
      },
    ]);
    assert.equal(findings.length, 1);
    assert.equal(findings[0]!.classification, "agent-misfire");
  });
});

describe("packet from desk-b docs/reports", () => {
  it("loads desk-b inventory + SARIF without re-inventory", () => {
    const loaded = loadPacketSources(deskBReports);
    assert.ok(loaded.inventoryJsonPath?.endsWith("desk-b-inventory.json"));
    assert.ok(loaded.sarifPaths.some((p) => p.endsWith(".sarif")));
    assert.ok(loaded.findings.length > 0);
  });

  it("builds packet with evidence-backed labels and redaction", () => {
    const packet = buildSecurityPacket(deskBReports);
    assert.equal(packet.schemaVersion, "zeroday-security-packet/v1");
    assert.equal(packet.desk, "A");
    assert.equal(packet.posture.noAutoSend, true);
    assert.equal(packet.posture.noPoC, true);
    assert.equal(packet.posture.secretsRedacted, true);
    assert.equal(packet.posture.needsHuman, true);
    assert.ok(packet.findings.length >= 10);
    assert.ok(packet.classificationCounts["agent-misfire"] >= 1);
    assert.ok(packet.classificationCounts.config >= 1);
    assert.ok(packet.classificationCounts.dependency >= 1);
    // Placeholders present
    assert.match(packet.placeholders.moduleLink, /TBD|fill/i);
    // No secret-shaped tokens
    const blob = JSON.stringify(packet);
    assert.doesNotMatch(blob, /sk_[A-Za-z0-9]{10,}/);
    assert.doesNotMatch(blob, /ghp_[A-Za-z0-9]{10,}/);
    // Every finding has a basis
    for (const f of packet.findings) {
      assert.ok(f.classificationBasis.length > 0);
      if (f.classification !== "unknown") {
        assert.match(f.classificationBasis, /Inventory kind/);
      }
    }
  });

  it("writeSecurityPacket emits summary + findings + SARIF copy", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-packet-"));
    const result = writeSecurityPacket(deskBReports, dir, {
      moduleLink: "https://example.com/module",
      prLink: "https://github.com/pandeyaby/ZERODAY/pull/0",
    });
    assert.ok(fs.existsSync(result.packetJsonPath));
    assert.ok(fs.existsSync(result.summaryPath));
    assert.ok(fs.existsSync(result.findingsJsonPath));
    assert.ok(fs.existsSync(result.findingsMdPath));
    assert.ok(fs.existsSync(result.readmePath));
    assert.ok(result.sarifPaths.length >= 1);
    for (const s of result.sarifPaths) {
      assert.ok(fs.existsSync(s));
      const sarif = JSON.parse(fs.readFileSync(s, "utf8"));
      assert.equal(sarif.version, "2.1.0");
    }
    const summary = fs.readFileSync(result.summaryPath, "utf8");
    assert.match(summary, /Desk A/i);
    assert.match(summary, /no auto-post|does not auto-send|no auto-send/i);
    assert.match(summary, /No PoC|no PoC/i);
    assert.match(summary, /agent-misfire/);
    assert.match(summary, /https:\/\/example\.com\/module/);
    assert.doesNotMatch(summary, /\b(write|craft)\s+an?\s+exploit\b/i);
    assert.equal(result.packet.placeholders.moduleLink, "https://example.com/module");
  });

  it("defaultPacketReportsDir points at docs/reports", () => {
    assert.equal(defaultPacketReportsDir(root), deskBReports);
  });
});

describe("packet CLI", () => {
  it("npm run zeroday -- packet --fixture writes packet dir", () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-packet-cli-"));
    const r = spawnSync(
      "npx",
      [
        "tsx",
        "cli/index.ts",
        "packet",
        "--fixture",
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
    assert.match(r.stdout, /security packet \(Desk A\)/i);
    assert.match(r.stdout, /does not auto-post/i);
    assert.ok(fs.existsSync(path.join(out, "packet.json")));
    assert.ok(fs.existsSync(path.join(out, "summary.md")));
    const pkt = JSON.parse(fs.readFileSync(path.join(out, "packet.json"), "utf8"));
    assert.equal(pkt.schemaVersion, "zeroday-security-packet/v1");
  });

  it("packet --from docs/reports works as one-command path", () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-packet-from-"));
    const r = spawnSync(
      "npx",
      [
        "tsx",
        "cli/index.ts",
        "packet",
        "--from",
        "docs/reports",
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
    assert.ok(fs.existsSync(path.join(out, "summary.md")));
    assert.ok(
      fs.readdirSync(out).some((n) => n.endsWith(".sarif")),
      "expected SARIF copy in packet",
    );
  });
});
