/**
 * SARIF 2.1 local-file parser for locate --from-sarif (Keyless K2).
 * File path only — no GitHub alerts API / network fetch.
 */

import fs from "node:fs";
import path from "node:path";
import type { EvidenceSpan, RankedFile } from "../types";
import { mapRuleToCwe } from "./cwe-map";

export interface ParsedSarifFinding {
  uri: string;
  ruleId: string;
  message: string;
  startLine?: number;
  endLine?: number;
  cweIds: string[];
  mapped: boolean;
  toolName?: string;
}

export interface ParseSarifResult {
  findings: ParsedSarifFinding[];
  warnings: string[];
  toolNames: string[];
  resultCount: number;
  version?: string;
}

interface SarifRuleMeta {
  id: string;
  properties?: Record<string, unknown>;
}

function asRecord(v: unknown): Record<string, unknown> | undefined {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : undefined;
}

function messageText(message: unknown): string {
  if (typeof message === "string") return message.trim();
  const rec = asRecord(message);
  if (rec && typeof rec.text === "string") return rec.text.trim();
  return "";
}

function normalizeUri(uri: string): string {
  let u = uri.trim().replace(/\\/g, "/");
  // Strip file:// and leading ./
  u = u.replace(/^file:\/\//i, "");
  // Drop absolute-looking prefixes for ranking (keep relative when possible)
  if (u.startsWith("/")) {
    // Keep basename path segments after common roots — still store trimmed form
    u = u.replace(/^\//, "");
  }
  u = u.replace(/^\.\//, "");
  return u;
}

/**
 * Parse a SARIF 2.1 document object into ranked-ready findings.
 */
export function parseSarifDocument(doc: unknown): ParseSarifResult {
  const warnings: string[] = [];
  const findings: ParsedSarifFinding[] = [];
  const toolNames: string[] = [];

  const root = asRecord(doc);
  if (!root) {
    throw new Error("Invalid SARIF: root must be a JSON object");
  }

  const version = typeof root.version === "string" ? root.version : undefined;
  if (version && !version.startsWith("2.1")) {
    warnings.push(
      `SARIF version "${version}" — parser targets 2.1.x; attempting best-effort ingest.`,
    );
  }

  const runs = Array.isArray(root.runs) ? root.runs : [];
  if (runs.length === 0) {
    warnings.push("SARIF has no runs[] — zero findings ingested.");
    return { findings, warnings, toolNames, resultCount: 0, version };
  }

  let resultCount = 0;

  for (const runRaw of runs) {
    const run = asRecord(runRaw);
    if (!run) continue;

    const tool = asRecord(run.tool);
    const driver = asRecord(tool?.driver);
    const toolName =
      typeof driver?.name === "string" ? driver.name : undefined;
    if (toolName) toolNames.push(toolName);

    const ruleById = new Map<string, SarifRuleMeta>();
    const rules = Array.isArray(driver?.rules) ? driver.rules : [];
    for (const r of rules) {
      const rr = asRecord(r);
      if (!rr || typeof rr.id !== "string") continue;
      ruleById.set(rr.id, {
        id: rr.id,
        properties: asRecord(rr.properties),
      });
    }

    const results = Array.isArray(run.results) ? run.results : [];
    for (const resRaw of results) {
      const res = asRecord(resRaw);
      if (!res) continue;
      resultCount += 1;

      const ruleId =
        typeof res.ruleId === "string"
          ? res.ruleId
          : typeof res.ruleIndex === "number" &&
              rules[res.ruleIndex] &&
              typeof asRecord(rules[res.ruleIndex])?.id === "string"
            ? String(asRecord(rules[res.ruleIndex])!.id)
            : "unknown-rule";

      const ruleMeta = ruleById.get(ruleId);
      const mapped = mapRuleToCwe({
        ruleId,
        resultProperties: asRecord(res.properties),
        ruleProperties: ruleMeta?.properties,
      });

      const locations = Array.isArray(res.locations) ? res.locations : [];
      const msg = messageText(res.message) || `${ruleId} (no message)`;

      if (locations.length === 0) {
        findings.push({
          uri: "(no-location)",
          ruleId: mapped.ruleId,
          message: msg,
          cweIds: mapped.cweIds,
          mapped: mapped.mapped,
          toolName,
        });
        continue;
      }

      for (const locRaw of locations) {
        const loc = asRecord(locRaw);
        const phys = asRecord(loc?.physicalLocation);
        const art = asRecord(phys?.artifactLocation);
        const region = asRecord(phys?.region);
        const uriRaw = typeof art?.uri === "string" ? art.uri : "";
        const uri = uriRaw ? normalizeUri(uriRaw) : "(no-uri)";
        const startLine =
          typeof region?.startLine === "number" ? region.startLine : undefined;
        const endLine =
          typeof region?.endLine === "number" ? region.endLine : undefined;

        findings.push({
          uri,
          ruleId: mapped.ruleId,
          message: msg,
          startLine,
          endLine,
          cweIds: mapped.cweIds,
          mapped: mapped.mapped,
          toolName,
        });
      }
    }
  }

  return {
    findings,
    warnings,
    toolNames: [...new Set(toolNames)],
    resultCount,
    version,
  };
}

/**
 * Read + parse a local SARIF file (no network).
 */
export function parseSarifFile(filePath: string): ParseSarifResult {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`SARIF file not found: ${resolved}`);
  }
  if (!fs.statSync(resolved).isFile()) {
    throw new Error(`SARIF path is not a file: ${resolved}`);
  }
  let raw: string;
  try {
    raw = fs.readFileSync(resolved, "utf8");
  } catch (e) {
    throw new Error(
      `Failed to read SARIF file ${resolved}: ${(e as Error).message}`,
    );
  }
  let doc: unknown;
  try {
    doc = JSON.parse(raw);
  } catch (e) {
    throw new Error(
      `Invalid SARIF JSON in ${resolved}: ${(e as Error).message}`,
    );
  }
  const parsed = parseSarifDocument(doc);
  parsed.warnings.unshift(`Ingested local SARIF file: ${resolved}`);
  return parsed;
}

/**
 * Collapse findings into RankedFile[] (one entry per unique uri, rank by order).
 * Optional cweFilter keeps only findings whose mapped CWE intersects the filter.
 */
export function findingsToRankedFiles(
  findings: ParsedSarifFinding[],
  opts?: { cweFilter?: string | null },
): { rankedFiles: RankedFile[]; warnings: string[]; filteredOut: number } {
  const warnings: string[] = [];
  const filter = opts?.cweFilter
    ? opts.cweFilter.toUpperCase().replace(/CWE-?0*/, "CWE-")
    : null;
  // Normalize CWE-089 → CWE-89
  const filterNorm = filter
    ? (() => {
        const m = filter.match(/CWE-(\d+)/i);
        return m ? `CWE-${Number(m[1])}` : filter;
      })()
    : null;

  let filteredOut = 0;
  const byUri = new Map<string, ParsedSarifFinding[]>();

  for (const f of findings) {
    if (filterNorm) {
      const hit =
        f.cweIds.some((c) => c === filterNorm) ||
        (!f.mapped && false); // unmapped never match CWE filter
      if (!hit) {
        filteredOut += 1;
        continue;
      }
    }
    const list = byUri.get(f.uri) ?? [];
    list.push(f);
    byUri.set(f.uri, list);
  }

  if (filterNorm && filteredOut > 0) {
    warnings.push(
      `CWE filter ${filterNorm}: dropped ${filteredOut} SARIF result(s) that did not map to that CWE.`,
    );
  }

  const rankedFiles: RankedFile[] = [];
  let rank = 1;
  for (const [uri, group] of byUri) {
    const cweIds = [...new Set(group.flatMap((g) => g.cweIds))];
    const unmapped = group.filter((g) => !g.mapped);
    if (unmapped.length && cweIds.length === 0) {
      warnings.push(
        `Unmapped ruleId(s) for ${uri}: ${[...new Set(unmapped.map((u) => u.ruleId))].join(", ")} — kept ruleId in evidence; no CWE invented.`,
      );
    }

    const evidence: EvidenceSpan[] = group.slice(0, 8).map((g) => ({
      filePath: uri,
      startLine: g.startLine,
      endLine: g.endLine,
      note: `[${g.ruleId}] ${g.message}`.slice(0, 500),
    }));

    const primary = group[0]!;
    const title =
      cweIds.length > 0
        ? `${cweIds.join(",")} via ${primary.ruleId}`
        : `Unmapped rule ${primary.ruleId}`;

    rankedFiles.push({
      filePath: uri,
      rank: rank++,
      cweIds,
      title: title.slice(0, 200),
      evidence,
    });
  }

  return { rankedFiles, warnings, filteredOut };
}
