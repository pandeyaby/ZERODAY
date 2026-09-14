/**
 * Map Desk B inventory / Desk A packet findings → harden recommendations.
 * Deterministic evidence map only — no free-text guessing.
 */

import type {
  HardenCategory,
  HardenCodeGuardRef,
  HardenEvidence,
  HardenPriority,
  HardenRecommendation,
} from "./types";

/** Raw finding shape shared by inventory + packet exports. */
export interface HardenSourceFinding {
  id: string;
  kind: string;
  path: string;
  title?: string;
  summary?: string;
  pattern?: string;
  repoId?: string;
  severity?: string;
  startLine?: number;
  classification?: string;
  tags?: string[];
}

interface KindRule {
  category: HardenCategory;
  priority: (f: HardenSourceFinding) => HardenPriority;
  title: (f: HardenSourceFinding) => string;
  recommendation: (f: HardenSourceFinding) => string;
  /** Optional CodeGuard mapping used only when --draft */
  codeguard?: (f: HardenSourceFinding) => HardenCodeGuardRef;
}

const CODEGUARD_SHELL: HardenCodeGuardRef = {
  ruleId: "codeguard-0-input-validation-injection",
  ruleFile: "codeguard-0-input-validation-injection.md",
  cweId: "CWE-78",
  guidance:
    "Do not invoke a shell with untrusted input. Prefer structured exec APIs with argv arrays; " +
    "allow-list arguments; validate early at trust boundaries. For agent/package harnesses: " +
    "disable remote-fetch and install-lifecycle shells unless an operator explicitly gates them.",
};

const CODEGUARD_SECRETS: HardenCodeGuardRef = {
  ruleId: "codeguard-0-framework-and-languages",
  ruleFile: "codeguard-0-framework-and-languages.md",
  guidance:
    "Keep secrets out of source and example files. Prefer platform secret stores / OIDC; " +
    "never log secret values; use empty or `<placeholder>` samples in `.env.example`.",
};

const KIND_RULES: Record<string, KindRule> = {
  agent_harness: {
    category: "agent-harness",
    priority: (f) =>
      f.pattern === "code-exec-hint" || f.pattern === "remote-fetch-hint"
        ? "high"
        : "medium",
    title: (f) =>
      `Harden agent/skill harness (\`${f.pattern ?? "shell-hint"}\`) at \`${f.path}\``,
    recommendation: (f) => {
      const pattern = f.pattern ?? "shell-hint";
      if (pattern === "remote-fetch-hint") {
        return (
          `Confirm operator allowlist before any live agent run that can fetch remote content. ` +
          `Prefer read-only list/grep/read tools; require an explicit ACK for network/fetch. ` +
          `Do not auto-apply agent config changes.`
        );
      }
      if (pattern === "code-exec-hint") {
        return (
          `Gate or remove code-exec patterns from agent/skill configs unless the operator ` +
          `explicitly authorizes them. Prefer sandboxed, allow-listed commands; keep ` +
          `needs_human / no auto-merge posture.`
        );
      }
      if (pattern === "package-exec-hint") {
        return (
          `Review package-exec hints (\`npx\` / \`npm exec\` / \`pip install\`) in agent skills. ` +
          `Pin versions, prefer local tooling, and require human approval before install/exec.`
        );
      }
      return (
        `Review agent/skill harness at \`${f.path}\` against an operator allowlist. ` +
        `Keep exploration read-only by default; no auto-apply of harness changes.`
      );
    },
    codeguard: () => CODEGUARD_SHELL,
  },
  dependency_harness: {
    category: "package-scripts",
    priority: (f) =>
      /preinstall|postinstall|prepare/i.test(f.pattern ?? f.title ?? "")
        ? "high"
        : "medium",
    title: (f) =>
      `Review package script harness \`${f.pattern ?? "scripts.*"}\` in \`${f.path}\``,
    recommendation: (f) =>
      `Human-review install/lifecycle script \`${f.pattern ?? "scripts.*"}\` in \`${f.path}\`. ` +
      `Prefer removing curl|bash / remote-shell patterns; pin dependencies; never auto-enable ` +
      `or auto-merge script changes. Localization only — not exploit confirmation.`,
    codeguard: () => CODEGUARD_SHELL,
  },
  ci_secret_pattern: {
    category: "secrets-hygiene",
    priority: () => "medium",
    title: (f) =>
      `Secrets hygiene for CI pattern \`${f.pattern ?? "secrets.*"}\` in \`${f.path}\``,
    recommendation: (f) =>
      `Confirm least-privilege for secret pattern \`${f.pattern ?? "secrets.*"}\` ` +
      `(name only; value never captured). Prefer OIDC / short-lived tokens; ensure workflows ` +
      `do not echo secret values into logs. No auto-apply of workflow edits.`,
    codeguard: () => CODEGUARD_SECRETS,
  },
  env_example_honesty: {
    category: "secrets-hygiene",
    priority: (f) => (f.severity === "warning" ? "high" : "low"),
    title: (f) =>
      f.severity === "warning"
        ? `Replace non-placeholder sample for \`${f.pattern ?? "KEY"}\` in \`${f.path}\``
        : `Keep \`${f.path}\` examples as placeholders only`,
    recommendation: (f) =>
      f.severity === "warning"
        ? `Key \`${f.pattern ?? "KEY"}\` in \`${f.path}\` may not be a placeholder (value redacted). ` +
          `Replace with empty / \`<placeholder>\` / localhost-only samples before sharing. ` +
          `Do not commit real secrets.`
        : `Documented env keys in \`${f.path}\` are localization surfaces only. ` +
          `Keep values empty or placeholder-shaped; never export secret values in reports.`,
    codeguard: () => CODEGUARD_SECRETS,
  },
  config_surface: {
    category: "config-surface",
    priority: () => "low",
    title: (f) =>
      `Track config surface \`${f.pattern ?? "surface"}\` at \`${f.path}\``,
    recommendation: (f) =>
      `Config surface \`${f.pattern ?? "surface"}\` at \`${f.path}\` is already localized. ` +
      `Add CODEOWNERS / review checklist coverage; harden only after human review. ` +
      `No auto-PR or auto-merge.`,
  },
};

/** Kinds that receive harden recommendations (evidence map only). */
export function isHardenFindingKind(kind: string): boolean {
  return kind in KIND_RULES;
}

function toEvidence(f: HardenSourceFinding): HardenEvidence {
  const severity =
    f.severity === "warning" || f.severity === "note" ? f.severity : undefined;
  return {
    findingId: f.id,
    kind: f.kind,
    path: f.path,
    repoId: f.repoId,
    pattern: f.pattern,
    classification: f.classification,
    severity,
    startLine: f.startLine,
  };
}

/**
 * Build deterministic harden recommendations from inventory/packet findings.
 * Unmapped kinds are skipped (no guessing).
 */
export function toHardenRecommendations(
  findings: HardenSourceFinding[],
  opts?: { includeDraftRefs?: boolean },
): HardenRecommendation[] {
  const out: HardenRecommendation[] = [];
  for (const f of findings) {
    const rule = KIND_RULES[f.kind];
    if (!rule) continue;
    const rec: HardenRecommendation = {
      id: `harden:${f.id}`,
      category: rule.category,
      priority: rule.priority(f),
      title: rule.title(f),
      recommendation: rule.recommendation(f),
      evidence: toEvidence(f),
    };
    if (opts?.includeDraftRefs && rule.codeguard) {
      rec.codeguard = rule.codeguard(f);
    }
    out.push(rec);
  }
  return out.sort(
    (a, b) =>
      priorityRank(a.priority) - priorityRank(b.priority) ||
      a.category.localeCompare(b.category) ||
      (a.evidence.repoId ?? "").localeCompare(b.evidence.repoId ?? "") ||
      a.evidence.path.localeCompare(b.evidence.path) ||
      a.id.localeCompare(b.id),
  );
}

function priorityRank(p: HardenPriority): number {
  if (p === "high") return 0;
  if (p === "medium") return 1;
  return 2;
}

export function emptyCategoryCounts(): Record<HardenCategory, number> {
  return {
    "agent-harness": 0,
    "package-scripts": 0,
    "secrets-hygiene": 0,
    "config-surface": 0,
  };
}
