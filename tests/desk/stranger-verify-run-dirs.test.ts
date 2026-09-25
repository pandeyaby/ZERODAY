/**
 * Desk Door A per-run output dirs (zeroday-reports/trust-loop-XXXXXX) stay
 * bounded: stale run dirs are pruned, fresh/concurrent ones are never touched,
 * and the CLI's stable zeroday-reports/trust-loop/ dir is never pruned.
 * All work happens under an isolated temp cwd.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import {
  createTrustLoopRunDir,
  pruneTrustLoopRunDirs,
  TRUST_LOOP_RUN_DIRS_KEEP,
  TRUST_LOOP_RUN_DIR_MIN_AGE_MS,
} from "../../src/desk/stranger-verify.ts";

const HOUR = 60 * 60 * 1000;

function tmpBase(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "zd-trust-loop-runs-"));
}

function runDirs(base: string): string[] {
  return fs
    .readdirSync(base)
    .filter((n) => /^trust-loop-[A-Za-z0-9]{6}$/.test(n))
    .sort();
}

function makeRunDir(base: string, name: string, ageMs: number): string {
  const abs = path.join(base, name);
  fs.mkdirSync(path.join(abs, "paired-probe"), { recursive: true });
  const t = new Date(Date.now() - ageMs);
  fs.utimesSync(abs, t, t);
  return abs;
}

describe("Desk trust-loop run dirs — bounded (no pile-up)", () => {
  it("prunes stale run dirs beyond the newest N", () => {
    const base = tmpBase();
    for (let i = 0; i < 12; i++) {
      makeRunDir(base, `trust-loop-old${String(i).padStart(3, "0")}`, (i + 1) * HOUR);
    }
    const removed = pruneTrustLoopRunDirs(base, { keep: 5 });
    assert.equal(removed.length, 7);
    // Newest five (smallest age) survive.
    assert.deepEqual(runDirs(base), [
      "trust-loop-old000",
      "trust-loop-old001",
      "trust-loop-old002",
      "trust-loop-old003",
      "trust-loop-old004",
    ]);
  });

  it("never prunes run dirs younger than the min age (concurrent runs)", () => {
    const base = tmpBase();
    for (let i = 0; i < 8; i++) {
      makeRunDir(base, `trust-loop-new${String(i).padStart(3, "0")}`, i * 1000);
    }
    const removed = pruneTrustLoopRunDirs(base, { keep: 2 });
    assert.equal(removed.length, 0);
    assert.equal(runDirs(base).length, 8);
    assert.ok(TRUST_LOOP_RUN_DIR_MIN_AGE_MS >= 60_000);
  });

  it("ignores the CLI stable trust-loop/ dir, non-mkdtemp names, files, symlinks", () => {
    const base = tmpBase();
    const stable = makeRunDir(base, "trust-loop", 5 * HOUR);
    const notes = makeRunDir(base, "trust-loop-mvp-notes", 5 * HOUR);
    const file = path.join(base, "trust-loop-abcdef");
    fs.writeFileSync(file, "not a dir");
    const target = makeRunDir(base, "elsewhere", 5 * HOUR);
    const link = path.join(base, "trust-loop-lnk123");
    fs.symlinkSync(target, link, "dir");
    const removed = pruneTrustLoopRunDirs(base, { keep: 0, minAgeMs: 0 });
    assert.deepEqual(removed, []);
    for (const p of [stable, notes, file, link, target]) {
      assert.ok(fs.existsSync(p), `unexpectedly removed ${p}`);
    }
  });

  it("createTrustLoopRunDir keeps default Door A output bounded across many runs", () => {
    const cwd = tmpBase();
    const base = path.join(cwd, "zeroday-reports");
    for (let i = 0; i < 30; i++) {
      const dir = createTrustLoopRunDir(cwd);
      assert.ok(fs.statSync(dir).isDirectory());
      assert.equal(path.dirname(dir), base);
      assert.match(path.basename(dir), /^trust-loop-[A-Za-z0-9]{6}$/);
      // Simulate time passing: every existing run dir ages past min-age.
      const aged = new Date(Date.now() - TRUST_LOOP_RUN_DIR_MIN_AGE_MS - (30 - i) * 1000);
      for (const n of runDirs(base)) fs.utimesSync(path.join(base, n), aged, aged);
    }
    const remaining = runDirs(base).length;
    assert.ok(
      remaining <= TRUST_LOOP_RUN_DIRS_KEEP + 1,
      `expected ≤ ${TRUST_LOOP_RUN_DIRS_KEEP + 1} run dirs, found ${remaining}`,
    );
  });
});
