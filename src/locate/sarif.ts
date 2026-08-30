/**
 * GitHub Code Scanning–compatible SARIF 2.1.0 emitter for Antares localizations.
 */

import type { LocalizationResult } from "./types";

export interface SarifLog {
  $schema: string;
  version: "2.1.0";
  runs: SarifRun[];
}

interface SarifRun {
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
        helpUri?: string;
        properties?: Record<string, unknown>;
      }>;
    };
  };
  results: Array<{
    ruleId: string;
    ruleIndex: number;
    level: "error" | "warning" | "note" | "none";
    message: { text: string };
    locations: Array<{
      physicalLocation: {
        artifactLocation: { uri: string; uriBaseId: string };
        region?: { startLine: number; endLine?: number };
      };
    }>;
    partialFingerprints?: Record<string, string>;
    properties: Record<string, unknown>;
  }>;
  originalUriBaseIds: {
    "%SRCROOT%": { uri: string };
  };
  properties: Record<string, unknown>;
}

function levelForRank(_rank: number): "error" | "warning" | "note" {
  // Antares CLI emits file-level findings at SARIF "note" severity.
  // ZERODAY preserves that contract; rank lives in properties.submission_rank.
  void _rank;
  return "note";
}

export function toSarif(result: LocalizationResult): SarifLog {
  const ruleIds = new Map<string, number>();
  const rules: SarifRun["tool"]["driver"]["rules"] = [];

  for (const file of result.rankedFiles) {
    for (const cwe of file.cweIds.length ? file.cweIds : [result.advisory.cweId]) {
      if (!ruleIds.has(cwe)) {
        ruleIds.set(cwe, rules.length);
        rules.push({
          id: cwe,
          name: cwe,
          shortDescription: {
            text: `${cwe} candidate file (Antares localization)`,
          },
          fullDescription: {
            text:
              `ZERODAY/Antares localized a candidate for ${cwe}. ` +
              `This is file-level localization for human review — not proof of exploitability. ` +
              `Reports do not include offensive demonstration code or attack procedures.`,
          },
          helpUri: `https://cwe.mitre.org/data/definitions/${cwe.replace(/^CWE-/i, "")}.html`,
          properties: {
            tags: ["security", "localization", cwe],
            precision: "medium",
          },
        });
      }
    }
  }

  // Ensure at least the requested CWE rule exists (empty findings still valid SARIF)
  if (rules.length === 0) {
    const cwe = result.advisory.cweId;
    ruleIds.set(cwe, 0);
    rules.push({
      id: cwe,
      name: cwe,
      shortDescription: { text: `${cwe} localization (no candidates)` },
      fullDescription: {
        text: `Antares completed localization for ${cwe} with no submitted vulnerable files.`,
      },
      helpUri: `https://cwe.mitre.org/data/definitions/${cwe.replace(/^CWE-/i, "")}.html`,
    });
  }

  const results: SarifRun["results"] = result.rankedFiles.map((file) => {
    const cwe = file.cweIds[0] ?? result.advisory.cweId;
    const ruleIndex = ruleIds.get(cwe) ?? 0;
    const primary = file.evidence[0];
    const evidenceNotes = file.evidence.map((e) => e.note).join("; ");
    const uri = file.filePath.replace(/\\/g, "/");

    return {
      ruleId: cwe,
      ruleIndex,
      level: levelForRank(file.rank),
      message: {
        text: `${file.title} — rank ${file.rank}. ${evidenceNotes} ` +
          `(Localization only; not exploitability proof.)`,
      },
      locations: [
        {
          physicalLocation: {
            artifactLocation: {
              uri,
              uriBaseId: "%SRCROOT%",
            },
            // File-level note. Omit region unless the source report had a real line —
            // never invent line-accurate regions for GitHub Code Scanning.
            ...(typeof primary?.startLine === "number"
              ? {
                  region: {
                    startLine: primary.startLine,
                    ...(typeof primary.endLine === "number"
                      ? { endLine: primary.endLine }
                      : {}),
                  },
                }
              : {}),
          },
        },
      ],
      partialFingerprints: {
        primaryLocationLineHash: `${cwe}|${uri}|${file.rank}`,
      },
      properties: {
        submission_rank: file.rank,
        cwe_ids: file.cweIds,
        advisory: result.advisory.id,
        mode: result.mode,
        likelihood_of_exploit: file.likelihoodOfExploit ?? "",
        exploration_steps: result.explorationTrace.length,
        zeroday_posture: result.posture,
        foundry_lane: "detector-candidate",
      },
    };
  });

  const repoUri = pathToFileUri(result.targetRepo);

  return {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "ZERODAY",
            version: "0.3.0",
            informationUri: "https://github.com/pandeyaby/ZERODAY",
            rules,
          },
        },
        results,
        originalUriBaseIds: {
          "%SRCROOT%": { uri: repoUri },
        },
        properties: {
          advisory: result.advisory,
          model: result.model,
          mode: result.mode,
          generatedAt: result.generatedAt,
          summary: result.summary,
          explorationTrace: result.explorationTrace,
          posture: result.posture,
          warnings: result.warnings,
        },
      },
    ],
  };
}

function pathToFileUri(p: string): string {
  const normalized = p.replace(/\\/g, "/");
  if (/^[a-zA-Z]:\//.test(normalized)) {
    return `file:///${normalized}`;
  }
  if (normalized.startsWith("/")) {
    return `file://${normalized}`;
  }
  return `file:///${normalized}`;
}

export function isValidSarifShape(doc: unknown): doc is SarifLog {
  if (!doc || typeof doc !== "object") return false;
  const d = doc as Record<string, unknown>;
  if (d.version !== "2.1.0") return false;
  if (!Array.isArray(d.runs) || d.runs.length < 1) return false;
  const run = d.runs[0] as Record<string, unknown>;
  if (!run.tool || typeof run.tool !== "object") return false;
  const tool = run.tool as { driver?: { name?: string; rules?: unknown } };
  if (!tool.driver?.name) return false;
  if (!Array.isArray(tool.driver.rules)) return false;
  if (!Array.isArray(run.results)) return false;
  return true;
}
