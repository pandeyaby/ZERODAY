/**
 * Repo inventory for the Defense Factory loop.
 * Maps files + CODEOWNERS + package manifests into a durable artifact.
 * No cloud asset sync in v1.
 */

import fs from "node:fs";
import path from "node:path";
import type {
  CodeOwnersRule,
  InventoryArtifact,
  InventoryFile,
} from "./types";

const SKIP_DIR_NAMES = new Set([
  ".git",
  "node_modules",
  ".next",
  "dist",
  "build",
  "coverage",
  ".turbo",
  "zeroday-reports",
  "__pycache__",
  ".venv",
  "venv",
]);

const MANIFEST_NAMES = new Set([
  "package.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "Cargo.toml",
  "go.mod",
  "pyproject.toml",
  "requirements.txt",
  "Gemfile",
  "composer.json",
  "pom.xml",
  "build.gradle",
  "build.gradle.kts",
]);

const MAX_FILES = 50_000;

function classifyKind(rel: string, base: string): InventoryFile["kind"] {
  if (MANIFEST_NAMES.has(base)) return "manifest";
  if (
    /\.(md|rst|txt)$/i.test(base) ||
    rel.startsWith("docs/") ||
    base === "LICENSE" ||
    base === "CHANGELOG"
  ) {
    return "docs";
  }
  if (
    /\.(ya?ml|toml|ini|cfg|conf|json)$/i.test(base) ||
    rel.startsWith(".github/") ||
    base.startsWith(".")
  ) {
    return "config";
  }
  if (
    /\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|kt|rb|php|c|cc|cpp|h|hpp|cs|swift)$/i.test(
      base,
    )
  ) {
    return "source";
  }
  return "other";
}

function walkFiles(root: string): InventoryFile[] {
  const out: InventoryFile[] = [];
  const stack = [root];

  while (stack.length > 0) {
    const dir = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      if (ent.name === "." || ent.name === "..") continue;
      const abs = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (SKIP_DIR_NAMES.has(ent.name)) continue;
        stack.push(abs);
        continue;
      }
      if (!ent.isFile()) continue;
      const rel = path.relative(root, abs).split(path.sep).join("/");
      let bytes = 0;
      try {
        bytes = fs.statSync(abs).size;
      } catch {
        bytes = 0;
      }
      out.push({
        path: rel,
        bytes,
        kind: classifyKind(rel, ent.name),
      });
      if (out.length >= MAX_FILES) return out;
    }
  }
  return out;
}

/** Find CODEOWNERS at conventional paths. */
export function findCodeownersPath(repoRoot: string): string | null {
  const candidates = [
    "CODEOWNERS",
    ".github/CODEOWNERS",
    "docs/CODEOWNERS",
  ];
  for (const c of candidates) {
    const abs = path.join(repoRoot, c);
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) return c;
  }
  return null;
}

/**
 * Parse GitHub/GitLab-style CODEOWNERS (subset).
 * Ignores comments and blank lines. Pattern + owners.
 */
export function parseCodeowners(content: string): CodeOwnersRule[] {
  const rules: CodeOwnersRule[] = [];
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const parts = line.split(/\s+/);
    if (parts.length < 2) continue;
    const [pattern, ...owners] = parts;
    rules.push({ pattern, owners });
  }
  return rules;
}

export function buildInventory(repoRoot: string): InventoryArtifact {
  const root = path.resolve(repoRoot);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    throw new Error(`Inventory repo not found: ${root}`);
  }

  const files = walkFiles(root).sort((a, b) => a.path.localeCompare(b.path));
  const manifests = files.filter((f) => f.kind === "manifest").map((f) => f.path);
  const codeownersPath = findCodeownersPath(root);
  let codeownersRules: CodeOwnersRule[] = [];
  if (codeownersPath) {
    const text = fs.readFileSync(path.join(root, codeownersPath), "utf8");
    codeownersRules = parseCodeowners(text);
  }

  return {
    schemaVersion: "zeroday-factory-inventory/v1",
    repoRoot: root,
    generatedAt: new Date().toISOString(),
    fileCount: files.length,
    files,
    manifests,
    codeownersPath,
    codeownersRules,
    posture: {
      localizationOnly: true,
      notExploitProof: true,
      noAutoMerge: true,
      noPoC: true,
      localFirstDefault: true,
    },
  };
}

export function writeInventory(
  repoRoot: string,
  outputPath: string,
): InventoryArtifact {
  const artifact = buildInventory(repoRoot);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(artifact, null, 2));
  return artifact;
}
