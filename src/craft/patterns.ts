/**
 * Desk D — distill defensive habit patterns from Desk B→A→C→E reports.
 * Evidence-backed only; no guessing; no attack procedures.
 */

import fs from "node:fs";
import path from "node:path";
import type {
  CraftHabitStage,
  CraftPatternSignal,
  CraftSourceRefs,
} from "./types";
import { CRAFT_HABIT_STAGES } from "./types";

export interface LoadedCraftSources {
  reportsDir: string;
  inventoryJsonPath: string | null;
  packetJsonPath: string | null;
  hardenJsonPath: string | null;
  classifyJsonPath: string | null;
  findingsJsonPath: string | null;
  caseNotePath: string | null;
  sarifPaths: string[];
}

function existsFile(p: string): boolean {
  try {
    return fs.existsSync(p) && fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function prefer(...candidates: string[]): string | null {
  for (const c of candidates) {
    if (existsFile(c)) return c;
  }
  return null;
}

function collectSarifPaths(dir: string): string[] {
  const preferred = [
    path.join(dir, "inventory.sarif"),
    path.join(dir, "desk-b-inventory.sarif"),
  ].filter(existsFile);

  if (preferred.length > 0) return preferred;

  try {
    return fs
      .readdirSync(dir)
      .filter((n) => n.endsWith(".sarif"))
      .map((n) => path.join(dir, n))
      .sort();
  } catch {
    return [];
  }
}

/**
 * Resolve Desk B/A/C/E artifacts under a reports dir (or nested desk folders).
 */
export function loadCraftSources(reportsDir: string): LoadedCraftSources {
  const abs = path.resolve(reportsDir);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) {
    throw new Error(`Reports directory not found: ${abs}`);
  }

  const inventoryJsonPath = prefer(
    path.join(abs, "inventory.json"),
    path.join(abs, "desk-b-inventory.json"),
  );
  const packetJsonPath = prefer(
    path.join(abs, "packet.json"),
    path.join(abs, "desk-a-packet", "packet.json"),
  );
  const hardenJsonPath = prefer(
    path.join(abs, "harden.json"),
    path.join(abs, "desk-c-harden", "harden.json"),
  );
  const classifyJsonPath = prefer(
    path.join(abs, "classify.json"),
    path.join(abs, "desk-e-classify", "classify.json"),
    path.join(abs, "ciso.json"),
    path.join(abs, "desk-e-classify", "ciso.json"),
  );
  const findingsJsonPath = prefer(
    path.join(abs, "findings.json"),
    path.join(abs, "desk-a-packet", "findings.json"),
  );
  const caseNotePath = prefer(
    path.join(abs, "case-note.md"),
    path.join(abs, "desk-b-case-note.md"),
  );
  const sarifPaths = [
    ...collectSarifPaths(abs),
    ...collectSarifPaths(path.join(abs, "desk-a-packet")),
  ].filter((p, i, arr) => arr.indexOf(p) === i);

  if (
    !inventoryJsonPath &&
    !packetJsonPath &&
    !hardenJsonPath &&
    !classifyJsonPath &&
    !findingsJsonPath &&
    sarifPaths.length === 0
  ) {
    throw new Error(
      `No Desk B/A/C/E reports under ${abs}. ` +
        `Expected inventory / packet / harden / classify artifacts ` +
        `(pass --from <dir> or --fixture for smoke).`,
    );
  }

  return {
    reportsDir: abs,
    inventoryJsonPath,
    packetJsonPath,
    hardenJsonPath,
    classifyJsonPath,
    findingsJsonPath,
    caseNotePath,
    sarifPaths,
  };
}

/** Always-on defensive habit baselines (encode even when a stage artifact is missing). */
const BASELINE_HABITS: Record<CraftHabitStage, string> = {
  inventory:
    "Inventory authorized local repos/config surfaces first (Actions, Docker, manifests, agent/skills). Names/patterns only — never secret values.",
  locate:
    "Locate with fixture or keyless operate; localization ≠ exploitability. Read-only list/grep/read inside the snapshot.",
  packet:
    "Package evidence into an offline security packet for human handoff — generate only, no Slack/GH/email auto-post.",
  harden:
    "Emit agent/package harden recommendations only — no auto-apply, no auto-PR, no auto-merge.",
  classify:
    "Classify crashes/incidents with evidence; ambiguous → needs_human. Classification ≠ exploitability; no auto-remediate.",
};

function pushUnique(
  out: CraftPatternSignal[],
  signal: CraftPatternSignal,
): void {
  if (out.some((s) => s.id === signal.id)) return;
  out.push(signal);
}

function stageFromInventoryKind(kind: string): CraftHabitStage | null {
  if (kind === "agent_harness" || kind === "config_surface") return "inventory";
  if (kind === "dependency_harness") return "inventory";
  if (kind === "ci_secret_pattern" || kind === "env_example_honesty") {
    return "inventory";
  }
  return null;
}

/**
 * Distill habit pattern signals from loaded Desk B→A→C→E reports.
 */
export function distillCraftPatterns(
  loaded: LoadedCraftSources,
): CraftPatternSignal[] {
  const out: CraftPatternSignal[] = [];

  // Baseline habits for every stage (deterministic scaffold content).
  for (const stage of CRAFT_HABIT_STAGES) {
    pushUnique(out, {
      id: `baseline:${stage}`,
      stage,
      habit: BASELINE_HABITS[stage],
      sourceArtifact: "baseline",
    });
  }

  // Desk B inventory findings → inventory habits
  if (loaded.inventoryJsonPath) {
    try {
      const raw = JSON.parse(
        fs.readFileSync(loaded.inventoryJsonPath, "utf8"),
      ) as {
        findings?: Array<{
          id?: string;
          kind?: string;
          path?: string;
          pattern?: string;
        }>;
      };
      const findings = Array.isArray(raw.findings) ? raw.findings : [];
      const kindsSeen = new Set<string>();
      for (const f of findings) {
        const kind = f.kind ?? "";
        const stage = stageFromInventoryKind(kind);
        if (!stage || kindsSeen.has(kind)) continue;
        kindsSeen.add(kind);
        pushUnique(out, {
          id: `inventory:${kind}`,
          stage,
          habit:
            kind === "agent_harness"
              ? "When inventory flags agent/skill harness hints, keep exploration read-only and require human review before any harness change."
              : kind === "dependency_harness"
                ? "When inventory flags install/lifecycle scripts, recommend pin/review — never auto-enable remote shell patterns."
                : kind === "ci_secret_pattern" || kind === "env_example_honesty"
                  ? "Treat secret *names* and env-example honesty as hygiene surfaces; never export values."
                  : "Track localized config surfaces with CODEOWNERS / review checklists; no auto-PR.",
          evidenceKind: kind,
          evidencePath: f.path,
          sourceArtifact: path.basename(loaded.inventoryJsonPath),
        });
      }
    } catch {
      // skip unreadable inventory
    }
  }

  // Desk A packet classifications
  if (loaded.packetJsonPath || loaded.findingsJsonPath) {
    const p = loaded.findingsJsonPath ?? loaded.packetJsonPath!;
    try {
      const raw = JSON.parse(fs.readFileSync(p, "utf8")) as {
        findings?: Array<{ classification?: string }>;
        classificationCounts?: Record<string, number>;
      };
      const counts = raw.classificationCounts ?? {};
      const labels =
        Object.keys(counts).length > 0
          ? Object.keys(counts)
          : [
              ...new Set(
                (raw.findings ?? [])
                  .map((f) => f.classification)
                  .filter((c): c is string => !!c),
              ),
            ];
      for (const label of labels.slice(0, 8)) {
        pushUnique(out, {
          id: `packet:${label}`,
          stage: "packet",
          habit: `Packet label \`${label}\` is evidence-backed only — share offline; never auto-post.`,
          evidenceKind: label,
          sourceArtifact: path.basename(p),
        });
      }
    } catch {
      // skip
    }
  }

  // Desk C harden categories
  if (loaded.hardenJsonPath) {
    try {
      const raw = JSON.parse(
        fs.readFileSync(loaded.hardenJsonPath, "utf8"),
      ) as {
        categoryCounts?: Record<string, number>;
      };
      const cats = Object.entries(raw.categoryCounts ?? {}).filter(
        ([, n]) => typeof n === "number" && n > 0,
      );
      for (const [cat] of cats) {
        pushUnique(out, {
          id: `harden:${cat}`,
          stage: "harden",
          habit: `Harden category \`${cat}\` → recommend-only notes; human applies changes.`,
          evidenceKind: cat,
          sourceArtifact: path.basename(loaded.hardenJsonPath),
        });
      }
    } catch {
      // skip
    }
  }

  // Desk E classify
  if (loaded.classifyJsonPath) {
    try {
      const raw = JSON.parse(
        fs.readFileSync(loaded.classifyJsonPath, "utf8"),
      ) as {
        classification?: string;
        needs_human?: boolean;
      };
      if (raw.classification) {
        pushUnique(out, {
          id: `classify:${raw.classification}`,
          stage: "classify",
          habit:
            raw.needs_human === true || raw.classification === "needs_human"
              ? "Prefer `needs_human` when signals are ambiguous — never invent breach."
              : `Record classify label \`${raw.classification}\` with evidence; human review required.`,
          evidenceKind: raw.classification,
          sourceArtifact: path.basename(loaded.classifyJsonPath),
        });
      }
    } catch {
      // skip
    }
  }

  // Locate habit always present via baseline; add explicit locate cue when SARIF exists
  if (loaded.sarifPaths.length > 0) {
    pushUnique(out, {
      id: "locate:sarif-present",
      stage: "locate",
      habit:
        "SARIF evidence present — treat as localization candidates for human triage, not exploit proof.",
      sourceArtifact: path.basename(loaded.sarifPaths[0]!),
    });
  }

  return out.sort(
    (a, b) =>
      CRAFT_HABIT_STAGES.indexOf(a.stage) -
        CRAFT_HABIT_STAGES.indexOf(b.stage) || a.id.localeCompare(b.id),
  );
}

export function toCraftSourceRefs(
  loaded: LoadedCraftSources,
  displayDir: string,
): CraftSourceRefs {
  return {
    reportsDir: displayDir,
    inventoryJson: loaded.inventoryJsonPath
      ? path.basename(loaded.inventoryJsonPath)
      : null,
    packetJson: loaded.packetJsonPath
      ? path.basename(loaded.packetJsonPath)
      : null,
    hardenJson: loaded.hardenJsonPath
      ? path.basename(loaded.hardenJsonPath)
      : null,
    classifyJson: loaded.classifyJsonPath
      ? path.basename(loaded.classifyJsonPath)
      : null,
    findingsJson: loaded.findingsJsonPath
      ? path.basename(loaded.findingsJsonPath)
      : null,
    caseNote: loaded.caseNotePath ? path.basename(loaded.caseNotePath) : null,
    sarifPaths: loaded.sarifPaths.map((p) => path.basename(p)),
  };
}

/** Prefer a short relative label over absolute machine paths. */
export function relativeReportsLabel(absDir: string): string {
  const abs = path.resolve(absDir);
  if (abs.endsWith(`${path.sep}docs${path.sep}reports`)) {
    return "docs/reports";
  }
  for (const nest of [
    "desk-a-packet",
    "desk-c-harden",
    "desk-e-classify",
    "desk-d-craft",
  ]) {
    if (abs.endsWith(`${path.sep}${nest}`)) {
      const parent = path.dirname(abs);
      if (parent.endsWith(`${path.sep}docs${path.sep}reports`)) {
        return `docs/reports/${nest}`;
      }
    }
  }
  const cwdRel = path.relative(process.cwd(), abs);
  if (cwdRel && !cwdRel.startsWith("..") && !path.isAbsolute(cwdRel)) {
    return cwdRel.split(path.sep).join("/");
  }
  return path.basename(abs);
}
