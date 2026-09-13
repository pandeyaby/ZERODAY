/**
 * Repo / multi-repo inventory for the Defense Factory loop (Desk slice B).
 * Lists paths + config surfaces (Actions, Docker/compose, manifests, agent/skills)
 * and emits ranked hints for locate. No cloud asset sync. No exploit scanning.
 */

import fs from "node:fs";
import path from "node:path";
import type {
  CodeOwnersRule,
  ConfigHotspot,
  ConfigSurfaceKind,
  InventoryArtifact,
  InventoryFile,
  InventoryManifest,
  LanguageStat,
  MultiRepoInventoryArtifact,
  RankedInventoryPath,
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

const AGENT_CONFIG_BASES = new Set([
  "AGENTS.md",
  "CLAUDE.md",
  "GEMINI.md",
  "AGENT.md",
  ".cursorrules",
  "copilot-instructions.md",
]);

const MAX_FILES = 50_000;

const EXT_LANGUAGE: Record<string, string> = {
  ".ts": "TypeScript",
  ".tsx": "TypeScript",
  ".js": "JavaScript",
  ".jsx": "JavaScript",
  ".mjs": "JavaScript",
  ".cjs": "JavaScript",
  ".py": "Python",
  ".go": "Go",
  ".rs": "Rust",
  ".java": "Java",
  ".kt": "Kotlin",
  ".rb": "Ruby",
  ".php": "PHP",
  ".c": "C",
  ".cc": "C++",
  ".cpp": "C++",
  ".h": "C/C++ headers",
  ".hpp": "C++",
  ".cs": "C#",
  ".swift": "Swift",
  ".yml": "YAML",
  ".yaml": "YAML",
  ".toml": "TOML",
  ".json": "JSON",
  ".md": "Markdown",
  ".sh": "Shell",
  ".bash": "Shell",
  ".dockerfile": "Dockerfile",
};

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
    base.startsWith(".") ||
    /^Dockerfile(\.|$)/i.test(base) ||
    /^docker-compose/i.test(base) ||
    base === "compose.yaml" ||
    base === "compose.yml"
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

/** Classify a relative path into a defensive config surface (or null). */
export function detectConfigSurface(
  rel: string,
): { surface: ConfigSurfaceKind; score: number; reason: string } | null {
  const base = path.posix.basename(rel);
  const lower = rel.toLowerCase();

  if (
    lower.startsWith(".github/workflows/") &&
    /\.ya?ml$/i.test(base)
  ) {
    return {
      surface: "github_actions",
      score: 90,
      reason: "GitHub Actions workflow — CI/CD config surface",
    };
  }
  if (lower.startsWith(".github/actions/") && (base === "action.yml" || base === "action.yaml")) {
    return {
      surface: "github_actions",
      score: 85,
      reason: "Composite/local GitHub Action definition",
    };
  }
  if (
    /^Dockerfile(\.|$)/i.test(base) ||
    base.toLowerCase() === "dockerfile"
  ) {
    return {
      surface: "docker",
      score: 80,
      reason: "Dockerfile — container build surface",
    };
  }
  if (
    /^docker-compose/i.test(base) ||
    base === "compose.yaml" ||
    base === "compose.yml"
  ) {
    return {
      surface: "compose",
      score: 78,
      reason: "Compose file — multi-service runtime surface",
    };
  }
  if (MANIFEST_NAMES.has(base)) {
    const primary = !/lock/i.test(base);
    return {
      surface: "package_manifest",
      score: primary ? 70 : 40,
      reason: primary
        ? "Package / language manifest"
        : "Lockfile (dependency pin surface)",
    };
  }
  if (
    AGENT_CONFIG_BASES.has(base) ||
    lower === ".cursor/rules" ||
    lower.endsWith("/agents.md") ||
    lower.startsWith(".cursor/rules/") ||
    lower.startsWith(".claude/") ||
    lower.startsWith(".github/copilot-")
  ) {
    return {
      surface: "agent_config",
      score: 75,
      reason: "Agent / coding-assistant operator config",
    };
  }
  if (
    (lower.includes("/skills/") || lower.startsWith("skills/")) &&
    (base === "SKILL.md" || base.toLowerCase() === "skill.md")
  ) {
    return {
      surface: "skill_config",
      score: 72,
      reason: "Agent skill definition",
    };
  }
  if (
    base === "CODEOWNERS" ||
    lower.endsWith("/codeowners")
  ) {
    return {
      surface: "codeowners",
      score: 65,
      reason: "CODEOWNERS ownership map",
    };
  }
  if (
    lower.startsWith(".github/") &&
    /\.ya?ml$/i.test(base)
  ) {
    return {
      surface: "ci_config",
      score: 60,
      reason: "GitHub config YAML",
    };
  }
  if (
    /^(jenkinsfile|\.gitlab-ci\.yml|azure-pipelines\.ya?ml|buildkite\.ya?ml|circle\.ya?ml)$/i.test(
      base,
    ) ||
    lower === ".circleci/config.yml"
  ) {
    return {
      surface: "ci_config",
      score: 70,
      reason: "CI pipeline config",
    };
  }
  return null;
}

export function collectConfigHotspots(files: InventoryFile[]): ConfigHotspot[] {
  const hotspots: ConfigHotspot[] = [];
  for (const f of files) {
    const hit = detectConfigSurface(f.path);
    if (!hit) continue;
    hotspots.push({
      path: f.path,
      surface: hit.surface,
      score: hit.score,
      reason: hit.reason,
    });
  }
  return hotspots.sort(
    (a, b) => b.score - a.score || a.path.localeCompare(b.path),
  );
}

export function collectLanguages(files: InventoryFile[]): LanguageStat[] {
  const map = new Map<string, LanguageStat>();
  for (const f of files) {
    if (f.kind !== "source" && f.kind !== "config") continue;
    const ext = path.posix.extname(f.path).toLowerCase();
    const base = path.posix.basename(f.path);
    let lang = EXT_LANGUAGE[ext];
    if (!lang && /^Dockerfile/i.test(base)) lang = "Dockerfile";
    if (!lang) continue;
    const cur = map.get(lang) ?? { language: lang, fileCount: 0, bytes: 0 };
    cur.fileCount += 1;
    cur.bytes += f.bytes;
    map.set(lang, cur);
  }
  return [...map.values()].sort(
    (a, b) => b.fileCount - a.fileCount || a.language.localeCompare(b.language),
  );
}

/**
 * Rank paths for locate planning: config hotspots first, then source files.
 * Scores are inventory priority hints — not vulnerability severity.
 */
export function rankInventoryPaths(
  files: InventoryFile[],
  hotspots: ConfigHotspot[],
): RankedInventoryPath[] {
  const byPath = new Map(hotspots.map((h) => [h.path, h]));
  const ranked: RankedInventoryPath[] = [];

  for (const h of hotspots) {
    ranked.push({
      path: h.path,
      rank: 0,
      score: h.score,
      surface: h.surface,
      reason: h.reason,
    });
  }

  for (const f of files) {
    if (byPath.has(f.path)) continue;
    if (f.kind !== "source") continue;
    // Prefer app/src entrypoints slightly for locate starting points
    let score = 25;
    const base = path.posix.basename(f.path).toLowerCase();
    if (/^(app|index|main|server|users)\./.test(base)) score = 45;
    else if (f.path.startsWith("src/")) score = 35;
    ranked.push({
      path: f.path,
      rank: 0,
      score,
      surface: "source",
      reason: "Source file — candidate locate target path",
    });
  }

  ranked.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
  return ranked.map((r, i) => ({ ...r, rank: i + 1 }));
}

export function buildInventory(
  repoRoot: string,
  opts?: { repoId?: string },
): InventoryArtifact {
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

  const configHotspots = collectConfigHotspots(files);
  const languages = collectLanguages(files);
  const rankedPaths = rankInventoryPaths(files, configHotspots);

  return {
    schemaVersion: "zeroday-factory-inventory/v1",
    repoRoot: root,
    ...(opts?.repoId ? { repoId: opts.repoId } : {}),
    generatedAt: new Date().toISOString(),
    fileCount: files.length,
    files,
    manifests,
    codeownersPath,
    codeownersRules,
    languages,
    configHotspots,
    rankedPaths,
    posture: {
      localizationOnly: true,
      notExploitProof: true,
      noAutoMerge: true,
      noPoC: true,
      localFirstDefault: true,
    },
  };
}

export function inventoryMarkdown(inv: InventoryArtifact): string {
  const lines: string[] = [];
  lines.push("# ZERODAY inventory");
  lines.push("");
  lines.push(
    "> Defensive localization inventory only. Not exploitability proof. No PoC / payload scanning.",
  );
  lines.push("");
  lines.push("| | |");
  lines.push("|--|--|");
  lines.push(`| Repo | \`${inv.repoRoot}\` |`);
  if (inv.repoId) lines.push(`| Id | \`${inv.repoId}\` |`);
  lines.push(`| Files | **${inv.fileCount}** |`);
  lines.push(`| Manifests | ${inv.manifests.length} |`);
  lines.push(`| Config hotspots | ${inv.configHotspots.length} |`);
  lines.push(`| CODEOWNERS | \`${inv.codeownersPath ?? "none"}\` |`);
  lines.push(`| Generated | ${inv.generatedAt} |`);
  lines.push("");

  lines.push("## Languages");
  lines.push("");
  if (inv.languages.length === 0) {
    lines.push("_No classified source/config languages._");
  } else {
    lines.push("| Language | Files | Bytes |");
    lines.push("|----------|------:|------:|");
    for (const l of inv.languages) {
      lines.push(`| ${l.language} | ${l.fileCount} | ${l.bytes} |`);
    }
  }
  lines.push("");

  lines.push("## Config hotspots");
  lines.push("");
  if (inv.configHotspots.length === 0) {
    lines.push("_None detected._");
  } else {
    lines.push("| Score | Surface | Path | Reason |");
    lines.push("|------:|---------|------|--------|");
    for (const h of inv.configHotspots) {
      lines.push(
        `| ${h.score} | \`${h.surface}\` | \`${h.path}\` | ${h.reason} |`,
      );
    }
  }
  lines.push("");

  lines.push("## Ranked locate hints");
  lines.push("");
  lines.push(
    "Higher score = better starting path for **locate** (inventory priority, not vuln rank).",
  );
  lines.push("");
  const top = inv.rankedPaths.slice(0, 25);
  if (top.length === 0) {
    lines.push("_No ranked paths._");
  } else {
    lines.push("| Rank | Score | Surface | Path |");
    lines.push("|-----:|------:|---------|------|");
    for (const r of top) {
      lines.push(
        `| ${r.rank} | ${r.score} | \`${r.surface}\` | \`${r.path}\` |`,
      );
    }
  }
  lines.push("");
  lines.push("## Hard limits");
  lines.push("");
  lines.push("- Inventory / localization / evidence only");
  lines.push("- No exploit, PoC, payload, or attack procedure");
  lines.push("- Localization ≠ exploitability · needs human review");
  lines.push("");
  return lines.join("\n");
}

export function multiInventoryMarkdown(
  multi: MultiRepoInventoryArtifact,
): string {
  const lines: string[] = [];
  lines.push("# ZERODAY multi-repo inventory");
  lines.push("");
  lines.push(
    "> Desk slice B — repos/paths + config surfaces for locate planning. " +
      "Defensive only. Not exploitability proof.",
  );
  lines.push("");
  lines.push("| | |");
  lines.push("|--|--|");
  lines.push(`| Repos | **${multi.repoCount}** |`);
  lines.push(`| Ranked hotspots | ${multi.rankedHotspots.length} |`);
  lines.push(`| Generated | ${multi.generatedAt} |`);
  lines.push("");

  lines.push("## Repos");
  lines.push("");
  lines.push("| Id | Path | Files | Languages | Hotspots |");
  lines.push("|----|------|------:|-----------|---------:|");
  for (const r of multi.repos) {
    const id = r.repoId ?? path.basename(r.repoRoot);
    const langs = r.languages
      .slice(0, 4)
      .map((l) => l.language)
      .join(", ");
    lines.push(
      `| \`${id}\` | \`${r.repoRoot}\` | ${r.fileCount} | ${langs || "—"} | ${r.configHotspots.length} |`,
    );
  }
  lines.push("");

  lines.push("## Global ranked config hotspots");
  lines.push("");
  if (multi.rankedHotspots.length === 0) {
    lines.push("_None detected._");
  } else {
    lines.push("| Rank | Score | Repo | Surface | Path |");
    lines.push("|-----:|------:|------|---------|------|");
    for (const h of multi.rankedHotspots.slice(0, 40)) {
      lines.push(
        `| ${h.rank} | ${h.score} | \`${h.repoId}\` | \`${h.surface}\` | \`${h.path}\` |`,
      );
    }
  }
  lines.push("");

  lines.push("## Locate hints (per repo)");
  lines.push("");
  for (const hint of multi.locateHints) {
    lines.push(`### \`${hint.repoId}\``);
    lines.push("");
    lines.push(`${hint.reason}`);
    lines.push("");
    for (const p of hint.paths) {
      lines.push(`- \`${p}\``);
    }
    lines.push("");
  }

  lines.push("## Hard limits");
  lines.push("");
  lines.push("- Inventory only — feeds locate; does not prove exploitability");
  lines.push("- No PoC / exploit / payload / attack procedure");
  lines.push("- No auto-merge · local-first / keyless default");
  lines.push("");
  return lines.join("\n");
}

export function writeInventory(
  repoRoot: string,
  outputPath: string,
  opts?: { repoId?: string; markdownPath?: string },
): InventoryArtifact {
  const artifact = buildInventory(repoRoot, { repoId: opts?.repoId });
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(artifact, null, 2));
  const mdPath =
    opts?.markdownPath ??
    path.join(path.dirname(outputPath), "inventory.md");
  fs.writeFileSync(mdPath, inventoryMarkdown(artifact));
  return artifact;
}

/**
 * Parse a multi-repo inventory manifest (JSON or minimal YAML subset).
 * YAML support is intentionally tiny: `repos:` list with `path` / `id` keys.
 */
export function parseInventoryManifest(content: string, fromPath?: string): InventoryManifest {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error("Inventory manifest is empty");
  }

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    const parsed = JSON.parse(trimmed) as InventoryManifest | InventoryManifestRepo[];
    if (Array.isArray(parsed)) {
      return { repos: parsed };
    }
    if (!parsed.repos || !Array.isArray(parsed.repos)) {
      throw new Error("Inventory manifest JSON must include repos[]");
    }
    return parsed;
  }

  // Minimal YAML: repos: / - path: / id:
  const repos: InventoryManifest["repos"] = [];
  let current: { path?: string; id?: string } | null = null;
  for (const raw of trimmed.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "");
    if (!line.trim()) continue;
    const pathMatch = line.match(/^\s*-\s*path:\s*(.+)\s*$/);
    const idMatch = line.match(/^\s*id:\s*(.+)\s*$/);
    const barePath = line.match(/^\s*-\s+([^\s:]+)\s*$/);
    if (pathMatch) {
      if (current?.path) repos.push({ path: current.path, id: current.id });
      current = { path: unquote(pathMatch[1]!) };
      continue;
    }
    if (barePath && !line.includes(":")) {
      if (current?.path) repos.push({ path: current.path, id: current.id });
      current = { path: unquote(barePath[1]!) };
      continue;
    }
    if (idMatch && current) {
      current.id = unquote(idMatch[1]!);
      continue;
    }
  }
  if (current?.path) repos.push({ path: current.path, id: current.id });

  if (repos.length === 0) {
    throw new Error(
      `Could not parse inventory manifest${fromPath ? ` (${fromPath})` : ""}. ` +
        "Use JSON `{ \"repos\": [{ \"path\": \"...\" }] }` or YAML `repos:` list.",
    );
  }
  return { repos };
}

function unquote(s: string): string {
  const t = s.trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    return t.slice(1, -1);
  }
  return t;
}

export function loadInventoryManifest(manifestPath: string): InventoryManifest {
  const abs = path.resolve(manifestPath);
  if (!fs.existsSync(abs)) {
    throw new Error(`Inventory manifest not found: ${abs}`);
  }
  return parseInventoryManifest(fs.readFileSync(abs, "utf8"), abs);
}

export function buildMultiRepoInventory(
  entries: Array<{ path: string; id?: string }>,
  opts?: { baseDir?: string },
): MultiRepoInventoryArtifact {
  if (entries.length === 0) {
    throw new Error("At least one repo path is required for inventory");
  }
  const base = opts?.baseDir ? path.resolve(opts.baseDir) : process.cwd();
  const repos: InventoryArtifact[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;
    const repoPath = path.isAbsolute(entry.path)
      ? entry.path
      : path.resolve(base, entry.path);
    const id = entry.id || path.basename(repoPath) || `repo-${i + 1}`;
    repos.push(buildInventory(repoPath, { repoId: id }));
  }

  const rankedHotspots: MultiRepoInventoryArtifact["rankedHotspots"] = [];
  for (const r of repos) {
    const repoId = r.repoId ?? path.basename(r.repoRoot);
    for (const h of r.configHotspots) {
      rankedHotspots.push({
        ...h,
        repoRoot: r.repoRoot,
        repoId,
        rank: 0,
      });
    }
  }
  rankedHotspots.sort(
    (a, b) =>
      b.score - a.score ||
      a.repoId.localeCompare(b.repoId) ||
      a.path.localeCompare(b.path),
  );
  rankedHotspots.forEach((h, i) => {
    h.rank = i + 1;
  });

  const locateHints = repos.map((r) => {
    const repoId = r.repoId ?? path.basename(r.repoRoot);
    const paths = r.rankedPaths.slice(0, 12).map((p) => p.path);
    return {
      repoId,
      repoRoot: r.repoRoot,
      paths,
      reason:
        "Top inventory-ranked paths (config hotspots + source) for locate planning",
    };
  });

  return {
    schemaVersion: "zeroday-config-inventory/v1",
    generatedAt: new Date().toISOString(),
    repoCount: repos.length,
    repos,
    rankedHotspots,
    locateHints,
    posture: {
      localizationOnly: true,
      notExploitProof: true,
      noAutoMerge: true,
      noPoC: true,
      localFirstDefault: true,
      inventoryOnly: true,
    },
  };
}

export function writeMultiRepoInventory(
  entries: Array<{ path: string; id?: string }>,
  outputDir: string,
  opts?: { baseDir?: string },
): {
  multi: MultiRepoInventoryArtifact;
  jsonPath: string;
  mdPath: string;
} {
  const multi = buildMultiRepoInventory(entries, opts);
  fs.mkdirSync(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, "inventory.json");
  const mdPath = path.join(outputDir, "inventory.md");
  fs.writeFileSync(jsonPath, JSON.stringify(multi, null, 2));
  fs.writeFileSync(mdPath, multiInventoryMarkdown(multi));

  // Also write per-repo side artifacts for factory/locate composition
  for (const r of multi.repos) {
    const id = r.repoId ?? path.basename(r.repoRoot);
    const safe = id.replace(/[^a-zA-Z0-9._-]+/g, "_");
    const sub = path.join(outputDir, "repos", safe);
    fs.mkdirSync(sub, { recursive: true });
    fs.writeFileSync(path.join(sub, "inventory.json"), JSON.stringify(r, null, 2));
    fs.writeFileSync(path.join(sub, "inventory.md"), inventoryMarkdown(r));
  }

  return { multi, jsonPath, mdPath };
}
