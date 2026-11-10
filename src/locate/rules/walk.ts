/**
 * Allowlisted tree walk for rules locate — no Semgrep, no network, no Docker.
 * Skips the same heavy dirs as the Antares snapshot helper.
 */

import fs from "node:fs";
import path from "node:path";

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
  ".turbo",
  "vendor",
]);

/** Source-ish extensions we bother to scan (thin heuristics). */
export const SOURCE_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".py",
  ".rb",
  ".php",
  ".go",
  ".java",
  ".cs",
  ".sql",
]);

export const MAX_FILE_BYTES = 512 * 1024; // 512 KiB per file for rules scan
/**
 * Source files one rules run reads. Past this the run is reported as PARTIAL —
 * never as clean. Raise with ZERODAY_RULES_MAX_FILES for very large monorepos.
 */
export const MAX_FILES = 50_000;

export function maxFiles(env: Record<string, string | undefined> = process.env): number {
  const n = Number(env.ZERODAY_RULES_MAX_FILES);
  return Number.isInteger(n) && n > 0 ? n : MAX_FILES;
}

export interface WalkedFile {
  absPath: string;
  /** Repo-relative POSIX-ish path */
  relPath: string;
}

function shouldSkipDir(name: string): boolean {
  return SKIP_DIRS.has(name) || name.startsWith(".git");
}

/**
 * List source files under `root` (repo or snapshot). Caps kept CI-cheap.
 */
export function walkSourceFiles(root: string): {
  files: WalkedFile[];
  skipped: number;
  warnings: string[];
  /** Set when the walk stopped at the file limit: files past it were not read. */
  truncated?: { limit: number };
} {
  const absRoot = path.resolve(root);
  const files: WalkedFile[] = [];
  let skipped = 0;
  const warnings: string[] = [];
  const limit = maxFiles();
  let truncated = false;

  function walk(dir: string): void {
    if (truncated) return;
    let entries: fs.Dirent[];
    try {
      // Sorted, so the same tree always yields the same files in the same order.
      entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    } catch {
      return;
    }
    for (const entry of entries) {
      if (truncated) return;
      if (entry.isDirectory()) {
        if (shouldSkipDir(entry.name)) continue;
        walk(path.join(dir, entry.name));
        continue;
      }
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (!SOURCE_EXTENSIONS.has(ext)) continue;
      const absPath = path.join(dir, entry.name);
      try {
        const st = fs.statSync(absPath);
        if (st.size > MAX_FILE_BYTES) {
          skipped += 1;
          continue;
        }
      } catch {
        skipped += 1;
        continue;
      }
      if (files.length >= limit) {
        truncated = true;
        return;
      }
      const relPath = path.relative(absRoot, absPath).split(path.sep).join("/");
      files.push({ absPath, relPath });
    }
  }

  walk(absRoot);
  return { files, skipped, warnings, ...(truncated ? { truncated: { limit } } : {}) };
}

export function readFileLines(absPath: string): string[] {
  const text = fs.readFileSync(absPath, "utf8");
  return text.split(/\r?\n/);
}
