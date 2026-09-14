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
export const MAX_FILES = 5_000;

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
} {
  const absRoot = path.resolve(root);
  const files: WalkedFile[] = [];
  let skipped = 0;
  const warnings: string[] = [];

  function walk(dir: string): void {
    if (files.length >= MAX_FILES) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (files.length >= MAX_FILES) {
        warnings.push(
          `Rules walk stopped at ${MAX_FILES} files (remaining paths skipped).`,
        );
        return;
      }
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
      const relPath = path.relative(absRoot, absPath).split(path.sep).join("/");
      files.push({ absPath, relPath });
    }
  }

  walk(absRoot);
  return { files, skipped, warnings };
}

export function readFileLines(absPath: string): string[] {
  const text = fs.readFileSync(absPath, "utf8");
  return text.split(/\r?\n/);
}
