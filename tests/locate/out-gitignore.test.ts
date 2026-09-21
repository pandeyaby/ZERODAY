/**
 * Contract: generated operator artifacts under out/ stay gitignored.
 * Fail-closed if .gitignore drops /out/ (or equivalent). No RunPod / no PoC.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const gitignorePath = path.join(root, ".gitignore");

/** Sample generated paths under out/ (CLI / CI defaults). */
const OUT_SAMPLES = [
  "out/",
  "out/report.json",
  "out/report.md",
  "out/doctor.json",
  "out/prove-doors.json",
  "out/evidence/",
  "out/evidence/report.json",
  "out/evidence/report.md",
  "out/evidence/manifest.json",
] as const;

/** Checked-in historical / fixture paths must remain trackable. */
const MUST_NOT_IGNORE = [
  "fixtures/locate/report-sample/prove-doors.json",
  "docs/reports",
] as const;

function gitignoreLines(): string[] {
  assert.ok(fs.existsSync(gitignorePath), ".gitignore must exist");
  return fs
    .readFileSync(gitignorePath, "utf8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));
}

/** True if a .gitignore pattern covers repo-root out/ (directory). */
function coversOutDir(pattern: string): boolean {
  // Anchored root dir, unanchored out/, or recursive **/out/
  return (
    pattern === "/out/" ||
    pattern === "/out" ||
    pattern === "out/" ||
    pattern === "out" ||
    pattern === "**/out/" ||
    pattern === "**/out"
  );
}

function checkIgnore(relPath: string): {
  status: number | null;
  stdout: string;
  stderr: string;
} {
  const r = spawnSync("git", ["check-ignore", "-q", "--", relPath], {
    cwd: root,
    encoding: "utf8",
  });
  return {
    status: r.status,
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? "",
  };
}

describe("out/ gitignore contract", () => {
  it(".gitignore declares a pattern that covers repo-root out/", () => {
    const lines = gitignoreLines();
    const hit = lines.find(coversOutDir);
    assert.ok(
      hit,
      "fail-closed: .gitignore must ignore /out/ (or out/) so generated " +
        "operator artifacts stay untracked",
    );
  });

  it("git check-ignore covers common out/ artifact paths", () => {
    for (const sample of OUT_SAMPLES) {
      const r = checkIgnore(sample);
      assert.equal(
        r.status,
        0,
        `fail-closed: expected git check-ignore to match ${sample} ` +
          `(status=${r.status}${r.stderr ? `; stderr=${r.stderr.trim()}` : ""})`,
      );
    }
  });

  it("does not ignore fixtures/ or docs/ historical evidence via out/ rule", () => {
    for (const sample of MUST_NOT_IGNORE) {
      const r = checkIgnore(sample);
      // git check-ignore exits 1 when the path is not ignored
      assert.equal(
        r.status,
        1,
        `must not ignore tracked historical/fixture path ${sample} ` +
          `(status=${r.status}; check-ignore matched unexpectedly)`,
      );
    }
  });
});
