/**
 * Desk B inventory evidence — localize CI secret *patterns*, .env.example
 * honesty, and dependency/agent harness risks. Never captures secret values
 * or writes exploit/PoC guidance.
 */

import fs from "node:fs";
import path from "node:path";
import type {
  ConfigHotspot,
  InventoryFile,
  InventoryFinding,
} from "./types";

const MAX_READ_BYTES = 256_000;

/** Patterns that name secrets in CI — capture the name, never a value. */
const CI_SECRET_PATTERNS: Array<{ re: RegExp; label: (m: RegExpMatchArray) => string }> = [
  {
    re: /\$\{\{\s*secrets\.([A-Z0-9_]+)\s*\}\}/gi,
    label: (m) => `secrets.${m[1]}`,
  },
  {
    re: /\bsecrets\.([A-Z0-9_]+)\b/gi,
    label: (m) => `secrets.${m[1]}`,
  },
  {
    re: /\b(GITHUB_TOKEN|NPM_TOKEN|AWS_SECRET_ACCESS_KEY|AZURE_CLIENT_SECRET|HF_TOKEN|HUGGING_FACE_HUB_TOKEN|OPENAI_API_KEY|ANTHROPIC_API_KEY)\b/g,
    label: (m) => m[1]!,
  },
];

function readTextLimited(abs: string): string | null {
  try {
    const st = fs.statSync(abs);
    if (!st.isFile() || st.size > MAX_READ_BYTES) return null;
    return fs.readFileSync(abs, "utf8");
  } catch {
    return null;
  }
}

function looksLikeSecretValue(raw: string): boolean {
  const v = raw.trim().replace(/^["']|["']$/g, "");
  if (!v || v === '""' || v === "''") return false;
  if (/^(true|false|null|local|localhost|example|changeme|todo|replace.?me|<[^>]+>|\$\{?[A-Z0-9_]+\}?)$/i.test(v)) {
    return false;
  }
  if (/^https?:\/\/(localhost|127\.0\.0\.1|example\.com)/i.test(v)) return false;
  if (/<(pod-id|runpod-proxy|your-|xxx)/i.test(v)) return false;
  // Long opaque tokens / sk- keys — flag honesty, never echo value
  if (/^(sk|rk|ghp|gho|ghu|ghs|ghr|hf)_[A-Za-z0-9]{8,}/.test(v)) return true;
  if (v.length >= 32 && /^[A-Za-z0-9/+=_-]+$/.test(v) && !/[<>{}]/.test(v)) {
    return true;
  }
  return false;
}

function collectCiSecretPatternFindings(
  root: string,
  files: InventoryFile[],
): InventoryFinding[] {
  const out: InventoryFinding[] = [];
  const seen = new Set<string>();

  for (const f of files) {
    if (!/\.(ya?ml|yml)$/i.test(f.path) && !f.path.startsWith(".github/")) {
      continue;
    }
    if (!/\.(ya?ml|yml)$/i.test(f.path)) continue;
    const text = readTextLimited(path.join(root, f.path));
    if (!text) continue;
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      // Skip comments
      if (/^\s*#/.test(line)) continue;
      for (const { re, label } of CI_SECRET_PATTERNS) {
        re.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(line)) !== null) {
          const pattern = label(m);
          const key = `${f.path}:${pattern}:${i + 1}`;
          if (seen.has(key)) continue;
          seen.add(key);
          out.push({
            id: `ci-secret:${f.path}:${pattern}:${i + 1}`,
            kind: "ci_secret_pattern",
            severity: "note",
            path: f.path,
            startLine: i + 1,
            pattern,
            title: `CI secret pattern \`${pattern}\``,
            summary:
              `Workflow references secret pattern \`${pattern}\` (name only; value not captured). ` +
              `Human review: confirm least-privilege + no plaintext secret in logs.`,
            tags: ["inventory", "ci", "secret-pattern"],
          });
        }
      }
    }
  }
  return out;
}

function collectEnvExampleFindings(
  root: string,
  files: InventoryFile[],
): InventoryFinding[] {
  const out: InventoryFinding[] = [];
  const envFiles = files.filter(
    (f) =>
      /(^|\/)\.env\.example$/i.test(f.path) ||
      /(^|\/)\.env\.sample$/i.test(f.path) ||
      /(^|\/)\.env\.template$/i.test(f.path),
  );

  for (const f of envFiles) {
    const text = readTextLimited(path.join(root, f.path));
    if (!text) continue;
    const keys: string[] = [];
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (!line.trim() || /^\s*#/.test(line)) continue;
      const km = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!km) continue;
      const key = km[1]!;
      const val = km[2] ?? "";
      keys.push(key);
      if (looksLikeSecretValue(val)) {
        out.push({
          id: `env-honesty:${f.path}:${key}:${i + 1}`,
          kind: "env_example_honesty",
          severity: "warning",
          path: f.path,
          startLine: i + 1,
          pattern: key,
          title: `.env.example key \`${key}\` may not be a placeholder`,
          summary:
            `Key \`${key}\` in \`${f.path}\` looks like a non-placeholder value (value redacted). ` +
            `Honesty check: examples should use empty / \`<placeholder>\` / localhost-only samples.`,
          tags: ["inventory", "env-example", "honesty"],
        });
      }
    }
    out.push({
      id: `env-surface:${f.path}`,
      kind: "env_example_honesty",
      severity: "note",
      path: f.path,
      title: `.env.example surface (${keys.length} key(s))`,
      summary:
        keys.length === 0
          ? `\`${f.path}\` present but no KEY= entries parsed.`
          : `\`${f.path}\` documents keys: ${keys
              .slice(0, 24)
              .map((k) => `\`${k}\``)
              .join(", ")}${keys.length > 24 ? ", …" : ""}. Values not exported.`,
      tags: ["inventory", "env-example"],
    });
  }
  return out;
}

function collectDependencyHarnessFindings(
  root: string,
  files: InventoryFile[],
): InventoryFinding[] {
  const out: InventoryFinding[] = [];
  for (const f of files) {
    if (path.posix.basename(f.path) !== "package.json") continue;
    const text = readTextLimited(path.join(root, f.path));
    if (!text) continue;
    let pkg: { scripts?: Record<string, string> };
    try {
      pkg = JSON.parse(text) as { scripts?: Record<string, string> };
    } catch {
      continue;
    }
    const scripts = pkg.scripts ?? {};
    for (const [name, body] of Object.entries(scripts)) {
      const harness =
        /^(preinstall|postinstall|prepare|prepublish|install)$/i.test(name) ||
        /curl[^\n]*\|\s*(?:ba)?sh/i.test(body) ||
        /wget[^\n]*\|\s*(?:ba)?sh/i.test(body) ||
        /invoke-expression|iex\s*\(/i.test(body);
      if (!harness) continue;
      out.push({
        id: `dep-harness:${f.path}:${name}`,
        kind: "dependency_harness",
        severity: /preinstall|postinstall|prepare/i.test(name)
          ? "warning"
          : "note",
        path: f.path,
        pattern: `scripts.${name}`,
        title: `Dependency/script harness \`${name}\``,
        summary:
          `package.json script \`${name}\` matches an install/remote-shell harness pattern ` +
          `(command body not reproduced). Localize for human review — not exploit confirmation.`,
        tags: ["inventory", "dependency", "harness"],
      });
    }
  }
  return out;
}

function collectAgentHarnessFindings(
  root: string,
  files: InventoryFile[],
): InventoryFinding[] {
  const out: InventoryFinding[] = [];
  for (const f of files) {
    const base = path.posix.basename(f.path);
    const isAgent =
      /^(AGENTS|CLAUDE|GEMINI|AGENT)\.md$/i.test(base) ||
      f.path.startsWith(".cursor/") ||
      (f.path.includes("skills/") && /skill\.md$/i.test(base));
    if (!isAgent) continue;
    const text = readTextLimited(path.join(root, f.path));
    if (!text) continue;
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (
        !/(curl|wget|npm\s+exec|npx|pip\s+install|chmod\s+\+x|eval\s*\(|subprocess|os\.system)/i.test(
          line,
        )
      ) {
        continue;
      }
      // Pattern class only — do not echo the line (may contain URLs/tokens)
      let pattern = "shell-hint";
      if (/curl|wget/i.test(line)) pattern = "remote-fetch-hint";
      else if (/npm\s+exec|npx|pip\s+install/i.test(line)) pattern = "package-exec-hint";
      else if (/eval|subprocess|os\.system/i.test(line)) pattern = "code-exec-hint";
      out.push({
        id: `agent-harness:${f.path}:${pattern}:${i + 1}`,
        kind: "agent_harness",
        severity: "note",
        path: f.path,
        startLine: i + 1,
        pattern,
        title: `Agent/skill harness hint (\`${pattern}\`)`,
        summary:
          `Agent/skill config at \`${f.path}\` mentions a \`${pattern}\` pattern (line text redacted). ` +
          `Inventory only — confirm operator allowlist before any live agent run.`,
        tags: ["inventory", "agent", "harness"],
      });
    }
  }
  return out;
}

function hotspotsAsFindings(hotspots: ConfigHotspot[]): InventoryFinding[] {
  return hotspots.map((h) => ({
    id: `surface:${h.surface}:${h.path}`,
    kind: "config_surface" as const,
    severity: "note" as const,
    path: h.path,
    pattern: h.surface,
    title: `Config surface \`${h.surface}\``,
    summary: h.reason,
    tags: ["inventory", "config-surface", h.surface],
  }));
}

/**
 * Collect defensive inventory findings for a repo.
 * Secret *values* are never included — patterns/names only.
 */
export function collectInventoryFindings(
  repoRoot: string,
  files: InventoryFile[],
  hotspots: ConfigHotspot[],
): InventoryFinding[] {
  const root = path.resolve(repoRoot);
  const findings = [
    ...hotspotsAsFindings(hotspots),
    ...collectCiSecretPatternFindings(root, files),
    ...collectEnvExampleFindings(root, files),
    ...collectDependencyHarnessFindings(root, files),
    ...collectAgentHarnessFindings(root, files),
  ];
  return findings.sort(
    (a, b) =>
      a.path.localeCompare(b.path) ||
      a.kind.localeCompare(b.kind) ||
      a.id.localeCompare(b.id),
  );
}

/** Redact absolute / home paths from free text for export. */
export function redactInventoryText(text: string, repoRoots: string[] = []): string {
  let out = text;
  for (const root of repoRoots) {
    const abs = path.resolve(root);
    if (abs.length > 1) {
      out = out.split(abs).join("<repo>");
      out = out.split(abs.replace(/\\/g, "/")).join("<repo>");
    }
  }
  out = out.replace(/\/Users\/[^/\s"']+/g, "<home>");
  out = out.replace(/\/home\/[^/\s"']+/g, "<home>");
  out = out.replace(/\/workspace\b/g, "<repo>");
  // Belt-and-suspenders: never leave sk-/ghp- shaped tokens in exports
  out = out.replace(
    /\b(sk|rk|ghp|gho|ghu|ghs|ghr|hf)_[A-Za-z0-9_]{6,}\b/g,
    "[REDACTED]",
  );
  return out;
}
