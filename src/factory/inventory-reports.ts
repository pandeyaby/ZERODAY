/**
 * Desk B inventory reports — SARIF + case-note markdown.
 * Always redacts absolute paths and secret-shaped tokens.
 */

import fs from "node:fs";
import path from "node:path";
import { redactInventoryText } from "./inventory-evidence";
import { ZERODAY_VERSION } from "../version";
import type {
  InventoryArtifact,
  InventoryFinding,
  MultiRepoInventoryArtifact,
} from "./types";

export interface InventorySarifLog {
  $schema: string;
  version: "2.1.0";
  runs: Array<{
    tool: {
      driver: {
        name: string;
        version: string;
        informationUri: string;
        rules: Array<{
          id: string;
          name: string;
          shortDescription: { text: string };
          fullDescription: { text: string };
          properties?: Record<string, unknown>;
        }>;
      };
    };
    results: Array<{
      ruleId: string;
      ruleIndex: number;
      level: "note" | "warning";
      message: { text: string };
      locations: Array<{
        physicalLocation: {
          artifactLocation: { uri: string; uriBaseId: string };
          region?: { startLine: number };
        };
      }>;
      properties: Record<string, unknown>;
    }>;
    originalUriBaseIds: { "%SRCROOT%": { uri: string } };
    properties: Record<string, unknown>;
  }>;
}

function ruleMeta(kind: InventoryFinding["kind"]): {
  id: string;
  name: string;
  short: string;
  full: string;
} {
  switch (kind) {
    case "ci_secret_pattern":
      return {
        id: "ZERODAY-INV-CI-SECRET-PATTERN",
        name: "CI secret pattern",
        short: "CI workflow references a secret *name* (value not captured)",
        full:
          "Inventory localized a CI secret pattern reference. " +
          "This is evidence for human review — not proof of exposure or exploitability.",
      };
    case "env_example_honesty":
      return {
        id: "ZERODAY-INV-ENV-EXAMPLE",
        name: "Env example honesty",
        short: ".env.example key surface / placeholder honesty",
        full:
          "Inventory reviewed .env.example keys. Values are never exported. " +
          "Warnings mean a value may not look like a placeholder.",
      };
    case "dependency_harness":
      return {
        id: "ZERODAY-INV-DEP-HARNESS",
        name: "Dependency harness",
        short: "package.json install/remote-shell harness pattern",
        full:
          "Inventory localized a dependency/script harness pattern for human review. " +
          "Not exploit confirmation. No command body is reproduced.",
      };
    case "agent_harness":
      return {
        id: "ZERODAY-INV-AGENT-HARNESS",
        name: "Agent/skill harness",
        short: "Agent or skill config mentions an execution/fetch hint",
        full:
          "Inventory localized an agent/skill harness hint. " +
          "Confirm operator allowlists before live agent use. No PoC.",
      };
    case "config_surface":
    default:
      return {
        id: "ZERODAY-INV-CONFIG-SURFACE",
        name: "Config surface",
        short: "Config hotspot for locate planning",
        full:
          "Inventory listed a defensive config surface (Actions, Docker, manifests, agent/skills). " +
          "Feeds locate — not vulnerability proof.",
      };
  }
}

function flattenFindings(
  multi: MultiRepoInventoryArtifact | InventoryArtifact,
): Array<InventoryFinding & { repoId: string }> {
  if ("repos" in multi && Array.isArray(multi.repos)) {
    return multi.findings;
  }
  const single = multi as InventoryArtifact;
  const repoId = single.repoId ?? path.basename(single.repoRoot);
  return single.findings.map((f) => ({ ...f, repoId }));
}

export function toInventorySarif(
  artifact: MultiRepoInventoryArtifact | InventoryArtifact,
  opts?: { includeConfigSurfaces?: boolean },
): InventorySarifLog {
  const includeSurfaces = opts?.includeConfigSurfaces === true;
  const findings = flattenFindings(artifact).filter(
    (f) => includeSurfaces || f.kind !== "config_surface",
  );

  const rules: InventorySarifLog["runs"][0]["tool"]["driver"]["rules"] = [];
  const ruleIndex = new Map<string, number>();
  const results: InventorySarifLog["runs"][0]["results"] = [];

  const roots =
    "repos" in artifact
      ? artifact.repos.map((r) => r.repoRoot)
      : [(artifact as InventoryArtifact).repoRoot];

  for (const f of findings) {
    const meta = ruleMeta(f.kind);
    if (!ruleIndex.has(meta.id)) {
      ruleIndex.set(meta.id, rules.length);
      rules.push({
        id: meta.id,
        name: meta.name,
        shortDescription: { text: meta.short },
        fullDescription: { text: meta.full },
        properties: {
          tags: ["security", "inventory", "localization", f.kind],
          precision: "medium",
        },
      });
    }
    const idx = ruleIndex.get(meta.id)!;
    const msg = redactInventoryText(
      `${f.title} — ${f.summary} (repo=${f.repoId}; localization only; not exploit proof)`,
      roots,
    );
    results.push({
      ruleId: meta.id,
      ruleIndex: idx,
      level: f.severity,
      message: { text: msg },
      locations: [
        {
          physicalLocation: {
            artifactLocation: {
              uri: `${f.repoId}/${f.path}`.replace(/\\/g, "/"),
              uriBaseId: "%SRCROOT%",
            },
            ...(f.startLine ? { region: { startLine: f.startLine } } : {}),
          },
        },
      ],
      properties: {
        kind: f.kind,
        pattern: f.pattern ?? null,
        repoId: f.repoId,
        inventory_only: true,
        not_exploit_proof: true,
        no_poc: true,
      },
    });
  }

  const repoCount =
    "repoCount" in artifact ? artifact.repoCount : 1;

  return {
    $schema:
      "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "ZERODAY-Inventory",
            version: ZERODAY_VERSION,
            informationUri: "https://github.com/pandeyaby/ZERODAY",
            rules,
          },
        },
        results,
        originalUriBaseIds: {
          "%SRCROOT%": { uri: "file:///inventory/" },
        },
        properties: {
          schemaVersion:
            "schemaVersion" in artifact
              ? artifact.schemaVersion
              : "zeroday-factory-inventory/v1",
          repoCount,
          findingCount: results.length,
          posture: {
            localizationOnly: true,
            notExploitProof: true,
            noPoC: true,
            inventoryOnly: true,
            secretsRedacted: true,
          },
        },
      },
    ],
  };
}

export function toInventoryCaseNote(
  artifact: MultiRepoInventoryArtifact | InventoryArtifact,
): string {
  const isMulti = "repos" in artifact && Array.isArray(artifact.repos);
  const multi = isMulti
    ? (artifact as MultiRepoInventoryArtifact)
    : null;
  const roots = multi
    ? multi.repos.map((r) => r.repoRoot)
    : [(artifact as InventoryArtifact).repoRoot];

  const lines: string[] = [];
  lines.push("# ZERODAY Desk B — inventory case note");
  lines.push("");
  lines.push(
    "> Fixture/static defensive inventory. Localization + evidence only. " +
      "**No PoC / exploit / payload.** Secret *values* redacted; patterns/names only. " +
      "Source never leaves the machine on this path.",
  );
  lines.push("");
  lines.push("| | |");
  lines.push("|--|--|");
  lines.push(`| Generated | ${artifact.generatedAt} |`);
  if (multi) {
    lines.push(`| Repos scanned | **${multi.repoCount}** |`);
    lines.push(
      `| Skipped | ${multi.skipped.map((s) => `\`${s.id}\` (${s.reason})`).join("; ") || "—"} |`,
    );
    lines.push(`| Findings | **${multi.findings.filter((f) => f.kind !== "config_surface").length}** (excl. raw surfaces) |`);
    lines.push(`| Config hotspots | ${multi.rankedHotspots.length} |`);
  } else {
    const s = artifact as InventoryArtifact;
    lines.push(`| Repo | \`${s.repoId ?? path.basename(s.repoRoot)}\` |`);
    lines.push(`| Findings | **${s.findings.length}** |`);
  }
  lines.push("| Posture | inventory only · needs human · no auto-merge |");
  lines.push("");

  if (multi) {
    lines.push("## Repos");
    lines.push("");
    lines.push("| Id | Files | Languages | Hotspots | Findings |");
    lines.push("|----|------:|-----------|---------:|---------:|");
    for (const r of multi.repos) {
      const id = r.repoId ?? path.basename(r.repoRoot);
      const langs = r.languages
        .slice(0, 3)
        .map((l) => l.language)
        .join(", ");
      const fc = r.findings.filter((f) => f.kind !== "config_surface").length;
      lines.push(
        `| \`${id}\` | ${r.fileCount} | ${langs || "—"} | ${r.configHotspots.length} | ${fc} |`,
      );
    }
    lines.push("");
  }

  lines.push("## Findings list (stranger-readable)");
  lines.push("");
  const findings = flattenFindings(artifact).filter(
    (f) => f.kind !== "config_surface",
  );
  if (findings.length === 0) {
    lines.push("_No non-surface findings (secret patterns / env honesty / harness)._");
  } else {
    lines.push("| Severity | Kind | Repo | Path | Pattern |");
    lines.push("|----------|------|------|------|---------|");
    for (const f of findings.slice(0, 80)) {
      lines.push(
        `| ${f.severity} | \`${f.kind}\` | \`${f.repoId}\` | \`${f.path}\` | \`${f.pattern ?? "—"}\` |`,
      );
    }
    if (findings.length > 80) {
      lines.push("");
      lines.push(`_… ${findings.length - 80} more (see inventory.json)._`);
    }
  }
  lines.push("");

  lines.push("## Locate hints");
  lines.push("");
  if (multi) {
    for (const h of multi.locateHints) {
      lines.push(`- **\`${h.repoId}\`:** ${h.paths.slice(0, 5).map((p) => `\`${p}\``).join(", ")}`);
    }
  } else {
    const s = artifact as InventoryArtifact;
    for (const p of s.rankedPaths.slice(0, 8)) {
      lines.push(`- \`${p.path}\` (score ${p.score})`);
    }
  }
  lines.push("");

  lines.push("## Hard limits");
  lines.push("");
  lines.push("- Inventory / localization / evidence / harden notes only");
  lines.push("- No PoC, exploit, payload, or attack procedure");
  lines.push("- No live Antares / RunPod spend on this desk");
  lines.push("- Never exfiltrate source; redact secrets in exports");
  lines.push("- `npm run mvp` remains the stranger door");
  lines.push("");

  return redactInventoryText(lines.join("\n"), roots);
}

export function writeInventoryReports(
  artifact: MultiRepoInventoryArtifact | InventoryArtifact,
  outputDir: string,
  opts?: { includeConfigSurfacesInSarif?: boolean },
): { sarifPath: string; caseNotePath: string } {
  fs.mkdirSync(outputDir, { recursive: true });
  const sarif = toInventorySarif(artifact, {
    includeConfigSurfaces: opts?.includeConfigSurfacesInSarif,
  });
  const sarifPath = path.join(outputDir, "inventory.sarif");
  const caseNotePath = path.join(outputDir, "case-note.md");
  fs.writeFileSync(sarifPath, JSON.stringify(sarif, null, 2));
  fs.writeFileSync(caseNotePath, toInventoryCaseNote(artifact));
  return { sarifPath, caseNotePath };
}

/** Strip absolute repoRoot paths for checked-in / shared exports. */
export function sanitizeInventoryExport<
  T extends MultiRepoInventoryArtifact | InventoryArtifact,
>(artifact: T): T {
  const clone = JSON.parse(JSON.stringify(artifact)) as T;
  const roots: string[] = [];
  if ("repos" in clone && Array.isArray(clone.repos)) {
    for (const r of clone.repos) {
      roots.push(r.repoRoot);
      const id = r.repoId ?? path.basename(r.repoRoot);
      r.repoRoot = `<repo:${id}>`;
    }
    for (const h of clone.rankedHotspots) {
      h.repoRoot = `<repo:${h.repoId}>`;
    }
    for (const h of clone.locateHints) {
      h.repoRoot = `<repo:${h.repoId}>`;
    }
  } else {
    const s = clone as InventoryArtifact;
    roots.push(s.repoRoot);
    const id = s.repoId ?? path.basename(s.repoRoot);
    s.repoRoot = `<repo:${id}>`;
  }
  const blob = redactInventoryText(JSON.stringify(clone), roots);
  return JSON.parse(blob) as T;
}
