/**
 * Read-only repository snapshot for localization runs.
 * Caps mirror the official Antares CLI contract:
 * 100k files / 2 GiB total / 256 MiB per file.
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

/** Official Antares snapshot caps (cisco-antares-cli). */
export const SNAPSHOT_CAPS = {
  maxFiles: 100_000,
  maxTotalBytes: 2 * 1024 * 1024 * 1024, // 2 GiB
  maxFileBytes: 256 * 1024 * 1024, // 256 MiB
} as const;

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
  byteCount: number;
  skippedFiles: number;
  sourceRepo: string;
  warnings: string[];
}

function shouldSkip(name: string): boolean {
  return SKIP_DIRS.has(name) || name.startsWith(".git");
}

function copyTree(
  src: string,
  dest: string,
  stats: { files: number; bytes: number; skipped: number },
  warnings: string[],
): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (shouldSkip(entry.name)) continue;
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyTree(from, to, stats, warnings);
    } else if (entry.isFile() || entry.isSymbolicLink()) {
      try {
        const st = fs.statSync(from);
        if (st.size > SNAPSHOT_CAPS.maxFileBytes) {
          stats.skipped += 1;
          warnings.push(
            `Skipped ${path.relative(dest, to) || entry.name}: exceeds 256 MiB Antares per-file cap`,
          );
          continue;
        }
        if (stats.files >= SNAPSHOT_CAPS.maxFiles) {
          stats.skipped += 1;
          continue;
        }
        if (stats.bytes + st.size > SNAPSHOT_CAPS.maxTotalBytes) {
          stats.skipped += 1;
          warnings.push(
            `Stopped copying at Antares 2 GiB snapshot cap (${stats.files} files retained)`,
          );
          return;
        }
        fs.copyFileSync(from, to);
        fs.chmodSync(to, 0o444);
        stats.files += 1;
        stats.bytes += st.size;
      } catch {
        stats.skipped += 1;
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
  const stats = { files: 0, bytes: 0, skipped: 0 };
  const warnings: string[] = [];
  copyTree(abs, snapshotPath, stats, warnings);

  if (stats.files >= SNAPSHOT_CAPS.maxFiles) {
    warnings.push(`Hit Antares 100k file snapshot cap`);
  }

  try {
    fs.chmodSync(snapshotPath, 0o555);
  } catch {
    /* ignore on platforms that disagree */
  }

  return {
    snapshotPath,
    fileCount: stats.files,
    byteCount: stats.bytes,
    skippedFiles: stats.skipped,
    sourceRepo: abs,
    warnings,
  };
}

export function destroySnapshot(snapshotPath: string): void {
  const root = path.dirname(snapshotPath);
  if (!root.includes("zeroday-snap-")) {
    return;
  }
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
