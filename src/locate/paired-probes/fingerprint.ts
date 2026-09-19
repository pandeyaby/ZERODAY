/**
 * Decision / SARIF fingerprint for DIPTYCH FREEZEDRY grading (v0.2).
 *
 * Graded inputs (canonical JSON → sha256):
 *   ruleId, level, location uri, region start/end, fingerprints/partialFingerprints
 *
 * Ignored unless listed in meta.grade_sarif_keys:
 *   message.text, timings, generatedAt, extra SARIF properties
 */

import { createHash } from "node:crypto";
import type { DecisionFingerprint } from "./types";

export interface SarifLikeResult {
  ruleId?: string;
  level?: string;
  fingerprints?: Record<string, string>;
  partialFingerprints?: Record<string, string>;
  locations?: Array<{
    physicalLocation?: {
      artifactLocation?: { uri?: string };
      region?: { startLine?: number; endLine?: number };
    };
  }>;
}

export interface SarifLikeLog {
  runs?: Array<{ results?: SarifLikeResult[] }>;
}

export interface NormalizedFindingRow {
  ruleId: string;
  level: string;
  uri: string;
  startLine: number | null;
  endLine: number | null;
  fingerprints: Array<[string, string]>;
}

export const SARIF_FINGERPRINT_KEYS = [
  "ruleId",
  "level",
  "uri",
  "startLine",
  "endLine",
  "fingerprints",
  "partialFingerprints",
] as const;

function sortedEntries(
  obj: Record<string, string> | undefined,
): Array<[string, string]> {
  if (!obj || typeof obj !== "object") return [];
  return Object.keys(obj)
    .sort()
    .map((k) => [k, String(obj[k])] as [string, string]);
}

export function normalizeSarifFindings(
  sarif: SarifLikeLog,
): NormalizedFindingRow[] {
  const results = sarif.runs?.[0]?.results ?? [];
  const rows: NormalizedFindingRow[] = results.map((r) => {
    const loc = r.locations?.[0]?.physicalLocation;
    const uri = (loc?.artifactLocation?.uri ?? "").replace(/\\/g, "/");
    const startLine =
      typeof loc?.region?.startLine === "number" ? loc.region.startLine : null;
    const endLine =
      typeof loc?.region?.endLine === "number" ? loc.region.endLine : null;
    const fingerprints = [
      ...sortedEntries(r.fingerprints),
      ...sortedEntries(r.partialFingerprints),
    ].sort((a, b) =>
      a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0]),
    );
    return {
      ruleId: r.ruleId ?? "",
      level: r.level ?? "",
      uri,
      startLine,
      endLine,
      fingerprints,
    };
  });

  rows.sort((a, b) => {
    const ka = `${a.ruleId}\0${a.uri}\0${a.startLine ?? ""}\0${a.level}\0${JSON.stringify(a.fingerprints)}`;
    const kb = `${b.ruleId}\0${b.uri}\0${b.startLine ?? ""}\0${b.level}\0${JSON.stringify(b.fingerprints)}`;
    return ka.localeCompare(kb);
  });
  return rows;
}

export function ruleIdsFromFindings(rows: NormalizedFindingRow[]): string[] {
  const set = new Set<string>();
  for (const r of rows) {
    if (r.ruleId) set.add(r.ruleId);
  }
  return [...set].sort();
}

export function sha256Hex(canonical: string): DecisionFingerprint {
  const hex = createHash("sha256").update(canonical, "utf8").digest("hex");
  return `sha256:${hex}`;
}

export function decisionFingerprintFromSarif(sarif: SarifLikeLog): {
  fingerprint: DecisionFingerprint;
  rule_ids: string[];
  sarif_result_count: number;
  rows: NormalizedFindingRow[];
} {
  const rows = normalizeSarifFindings(sarif);
  return {
    fingerprint: sha256Hex(JSON.stringify(rows)),
    rule_ids: ruleIdsFromFindings(rows),
    sarif_result_count: rows.length,
    rows,
  };
}

/** Hash an arbitrary canonical decision packet (operator-specific channels). */
export function decisionFingerprintFromPacket(packet: unknown): DecisionFingerprint {
  return sha256Hex(JSON.stringify(packet));
}

/**
 * Inject clock/rng leak into SARIF partialFingerprints (FREEZEDRY violating).
 * Defensive localization only — no exploit content.
 */
export function leakClockRngIntoSarif(
  sarif: SarifLikeLog,
  leak: { clock: string; rng: string },
): SarifLikeLog {
  const clone = JSON.parse(JSON.stringify(sarif)) as SarifLikeLog;
  const results = clone.runs?.[0]?.results ?? [];
  for (const r of results) {
    r.partialFingerprints = {
      ...(r.partialFingerprints ?? {}),
      zeroday_clock_leak: leak.clock,
      zeroday_rng_leak: leak.rng,
    };
  }
  if (results.length === 0 && clone.runs?.[0]) {
    clone.runs[0].results = [
      {
        ruleId: "CWE-FREEZE",
        level: "note",
        partialFingerprints: {
          zeroday_clock_leak: leak.clock,
          zeroday_rng_leak: leak.rng,
        },
        locations: [
          {
            physicalLocation: {
              artifactLocation: { uri: "__freeze__/leak" },
            },
          },
        ],
      },
    ];
  }
  return clone;
}
