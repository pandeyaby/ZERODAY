/**
 * Read-only repository snapshot for localization runs.
 * Copies source into a temp directory; never mutates the target.
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  ".next",
  "dist",
  "build",
  "coverage",
  ".venv",
  ".venv-st3gg",
  "__pycache__",
  ".antares-data",
  "zeroday-reports",
]);

export interface SnapshotResult {
  snapshotPath: string;
  fileCount: number;
  sourceRepo: string;
}

function shouldSkip(name: string): boolean {
  return SKIP_DIRS.has(name) || name.startsWith(".git");
}

function copyTree(src: string, dest: string, stats: { files: number }) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (shouldSkip(entry.name)) continue;
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyTree(from, to, stats);
    } else if (entry.isFile() || entry.isSymbolicLink()) {
      try {
        fs.copyFileSync(from, to);
        // Enforce read-only on copied files
        fs.chmodSync(to, 0o444);
        stats.files += 1;
      } catch {
        // Skip unreadable files
      }
    }
  }
}

/**
 * Create a disposable read-only-ish snapshot of `repoPath`.
 * Caller should destroySnapshot() when finished.
 */
export function createSnapshot(repoPath: string): SnapshotResult {
  const abs = path.resolve(repoPath);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) {
    throw new Error(`Repository path does not exist or is not a directory: ${repoPath}`);
  }

  const root = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-snap-"));
  const snapshotPath = path.join(root, "repo");
  const stats = { files: 0 };
  copyTree(abs, snapshotPath, stats);

  // Best-effort: mark tree walk-only for owner
  try {
    fs.chmodSync(snapshotPath, 0o555);
  } catch {
    /* ignore on platforms that disagree */
  }

  return { snapshotPath, fileCount: stats.files, sourceRepo: abs };
}

export function destroySnapshot(snapshotPath: string): void {
  const root = path.dirname(snapshotPath);
  if (!root.includes("zeroday-snap-")) {
    // Safety: only delete our temp roots
    return;
  }
  // Files may have been marked read-only — restore write bits before rimraf
  chmodTreeWritable(root);
  fs.rmSync(root, { recursive: true, force: true });
}

function chmodTreeWritable(dir: string): void {
  try {
    fs.chmodSync(dir, 0o755);
  } catch {
    /* ignore */
  }
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      chmodTreeWritable(p);
    } else {
      try {
        fs.chmodSync(p, 0o644);
      } catch {
        /* ignore */
      }
    }
  }
}
