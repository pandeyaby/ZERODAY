/**
 * Keyless K5 — Desk path resolution (real-first vs --fixture).
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  findUsableReportsDir,
  fixtureDeskReportsDir,
  fixtureInventoryManifest,
  looksLikeDeskReportsDir,
  resolveClassifyFromPath,
  resolveDeskReportsFrom,
  resolveInventoryTarget,
} from "../../src/desk/index.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const realShaped = path.join(root, "fixtures/inventory/real-shaped");

describe("desk resolve — inventory", () => {
  it("defaults to cwd when no --repo / --from / --fixture", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-desk-cwd-"));
    const t = resolveInventoryTarget({ cwd: tmp, repoRoot: root });
    assert.equal(t.source, "cwd");
    assert.deepEqual(t.repos, [tmp]);
    assert.equal(t.from, undefined);
  });

  it("--fixture selects desk-b manifest only", () => {
    const t = resolveInventoryTarget({
      fixture: true,
      cwd: "/tmp/elsewhere",
      repoRoot: root,
    });
    assert.equal(t.source, "fixture");
    assert.equal(t.from, fixtureInventoryManifest(root));
    assert.ok(fs.existsSync(t.from!));
  });

  it("refuses mixed --fixture and --repo", () => {
    assert.throws(
      () =>
        resolveInventoryTarget({
          fixture: true,
          repo: [realShaped],
          repoRoot: root,
        }),
      /refuse mixed --fixture/i,
    );
  });

  it("--repo wins as explicit-repo", () => {
    const t = resolveInventoryTarget({
      repo: [realShaped],
      cwd: root,
      repoRoot: root,
    });
    assert.equal(t.source, "explicit-repo");
    assert.equal(t.repos[0], path.resolve(realShaped));
  });
});

describe("desk resolve — reports (packet/harden/craft)", () => {
  it("--fixture → docs/reports", () => {
    const r = resolveDeskReportsFrom({
      fixture: true,
      cwd: "/tmp/empty-desk",
      repoRoot: root,
      command: "packet",
    });
    assert.equal(r.source, "fixture");
    assert.equal(r.path, fixtureDeskReportsDir(root));
  });

  it("prefers zeroday-reports/ over docs/reports when usable", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-desk-zr-"));
    const zr = path.join(tmp, "zeroday-reports", "my-inventory");
    fs.mkdirSync(zr, { recursive: true });
    fs.writeFileSync(
      path.join(zr, "inventory.json"),
      JSON.stringify({
        schemaVersion: "zeroday-factory-inventory/v1",
        findings: [],
      }),
    );
    // decoy docs/reports
    fs.mkdirSync(path.join(tmp, "docs", "reports"), { recursive: true });
    fs.writeFileSync(
      path.join(tmp, "docs", "reports", "desk-b-inventory.json"),
      "{}",
    );

    const r = resolveDeskReportsFrom({
      cwd: tmp,
      repoRoot: root,
      command: "packet",
    });
    assert.equal(r.source, "zeroday-reports");
    assert.equal(r.path, zr);
  });

  it("falls back to docs/reports when present (not fixture mode)", () => {
    const r = resolveDeskReportsFrom({
      cwd: root,
      repoRoot: root,
      command: "harden",
    });
    // In this checkout, zeroday-reports may exist from prior runs — either is OK
    // as long as we did not force fixture mode.
    assert.notEqual(r.source, "fixture");
    assert.ok(
      r.source === "zeroday-reports" || r.source === "docs-reports",
      `unexpected source ${r.source}`,
    );
    assert.ok(looksLikeDeskReportsDir(r.path));
  });

  it("errors when no reports dir (requires --from or --fixture)", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-desk-empty-"));
    assert.throws(
      () =>
        resolveDeskReportsFrom({
          cwd: tmp,
          repoRoot: root,
          command: "packet",
        }),
      /no reports dir|--from|--fixture/i,
    );
  });

  it("refuses mixed --fixture and --from", () => {
    assert.throws(
      () =>
        resolveDeskReportsFrom({
          fixture: true,
          from: "docs/reports",
          cwd: root,
          repoRoot: root,
        }),
      /refuse mixed/i,
    );
  });

  it("findUsableReportsDir picks newest child", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-desk-find-"));
    const older = path.join(tmp, "older");
    const newer = path.join(tmp, "newer");
    fs.mkdirSync(older);
    fs.mkdirSync(newer);
    fs.writeFileSync(path.join(older, "inventory.json"), "{}");
    fs.writeFileSync(path.join(newer, "packet.json"), "{}");
    const oldTime = Date.now() - 60_000;
    fs.utimesSync(older, oldTime / 1000, oldTime / 1000);
    const found = findUsableReportsDir(tmp);
    assert.equal(found, newer);
  });
});

describe("desk resolve — classify", () => {
  it("--fixture → fixtures/classify/software_defect", () => {
    const r = resolveClassifyFromPath({
      fixture: true,
      cwd: root,
      repoRoot: root,
    });
    assert.equal(r.source, "fixture");
    assert.match(r.path, /fixtures[\\/]classify[\\/]software_defect$/);
  });
});

describe("desk CLI — real-shaped vs fixture", () => {
  it("inventory --repo real-shaped (mirrors cwd usage)", () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-inv-real-"));
    const r = spawnSync(
      "npx",
      [
        "tsx",
        "cli/index.ts",
        "inventory",
        "--repo",
        "fixtures/inventory/real-shaped",
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
    assert.match(r.stdout, /Source\s+:\s+explicit-repo/);
    assert.ok(fs.existsSync(path.join(out, "inventory.json")));
    assert.ok(fs.existsSync(path.join(out, "inventory.sarif")));
    const inv = JSON.parse(fs.readFileSync(path.join(out, "inventory.json"), "utf8"));
    assert.ok(inv.configHotspots?.length >= 1);
  });

  it("inventory --fixture still uses desk-b", () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-inv-fix-"));
    const r = spawnSync(
      "npx",
      ["tsx", "cli/index.ts", "inventory", "--fixture", "--output", out],
      {
        cwd: root,
        encoding: "utf8",
        env: { ...process.env, CI: "true" },
      },
    );
    assert.equal(r.status, 0, r.stderr || r.stdout);
    assert.match(r.stdout, /Source\s+:\s+fixture/);
    assert.ok(fs.existsSync(path.join(out, "inventory.json")));
    const inv = JSON.parse(fs.readFileSync(path.join(out, "inventory.json"), "utf8"));
    assert.ok(inv.repoCount >= 5 || inv.repos?.length >= 5);
  });

  it("packet without --from prefers zeroday-reports when present", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-pkt-real-"));
    // Seed a mini checkout with usable zeroday-reports from real-shaped inventory
    const invOut = path.join(tmp, "zeroday-reports", "inv");
    const inv = spawnSync(
      "npx",
      [
        "tsx",
        path.join(root, "cli/index.ts"),
        "inventory",
        "--repo",
        realShaped,
        "--output",
        invOut,
      ],
      {
        cwd: root,
        encoding: "utf8",
        env: { ...process.env, CI: "true" },
      },
    );
    assert.equal(inv.status, 0, inv.stderr || inv.stdout);

    // Copy inventory artifacts into tmp workspace layout
    const ws = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-pkt-ws-"));
    const wsInv = path.join(ws, "zeroday-reports", "inv");
    fs.mkdirSync(wsInv, { recursive: true });
    for (const f of fs.readdirSync(invOut)) {
      fs.copyFileSync(path.join(invOut, f), path.join(wsInv, f));
    }

    const pktOut = path.join(ws, "zeroday-reports", "packet-out");
    const pkt = spawnSync(
      "npx",
      [
        "tsx",
        path.join(root, "cli/index.ts"),
        "packet",
        "--output",
        pktOut,
      ],
      {
        cwd: ws,
        encoding: "utf8",
        env: { ...process.env, CI: "true" },
      },
    );
    assert.equal(pkt.status, 0, pkt.stderr || pkt.stdout);
    assert.match(pkt.stdout, /Source\s+:\s+zeroday-reports/);
    assert.ok(fs.existsSync(path.join(pktOut, "packet.json")));
  });

  it("packet --fixture still works", () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-pkt-fix-"));
    const r = spawnSync(
      "npx",
      ["tsx", "cli/index.ts", "packet", "--fixture", "--output", out],
      {
        cwd: root,
        encoding: "utf8",
        env: { ...process.env, CI: "true" },
      },
    );
    assert.equal(r.status, 0, r.stderr || r.stdout);
    assert.match(r.stdout, /Source\s+:\s+fixture/);
    assert.ok(fs.existsSync(path.join(out, "packet.json")));
  });
});
