/**
 * Validate operator submissions — structural + no-exploit invariant.
 * Lightweight (no Ajv dependency): mirrors the JSON schema contract.
 */

import {
  assertNoExploitInvariant,
  checkNoExploitInvariant,
} from "../locate/invariant";
import type { OperatorSubmission } from "./types";

export interface ValidationIssue {
  path: string;
  message: string;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

export function validateOperatorSubmission(
  raw: unknown,
): { ok: true; submission: OperatorSubmission } | { ok: false; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];

  if (!isObj(raw)) {
    return { ok: false, issues: [{ path: "$", message: "Submission must be a JSON object" }] };
  }

  if (raw.schemaVersion !== "zeroday-operator-submission/v1") {
    issues.push({
      path: "schemaVersion",
      message: 'Must be "zeroday-operator-submission/v1"',
    });
  }

  if (!isObj(raw.advisory)) {
    issues.push({ path: "advisory", message: "Required object" });
  } else {
    const a = raw.advisory;
    if (!["cwe", "cve", "ghsa"].includes(String(a.kind))) {
      issues.push({ path: "advisory.kind", message: "Must be cwe|cve|ghsa" });
    }
    if (typeof a.id !== "string" || a.id.length < 3) {
      issues.push({ path: "advisory.id", message: "Required string" });
    }
    if (typeof a.cweId !== "string" || !/^CWE-\d+$/.test(a.cweId)) {
      issues.push({ path: "advisory.cweId", message: "Must match CWE-<n>" });
    }
  }

  if (raw.needs_human !== true) {
    issues.push({
      path: "needs_human",
      message: "Must be true (human review required)",
    });
  }

  if (!Array.isArray(raw.rankedFiles)) {
    issues.push({ path: "rankedFiles", message: "Must be an array" });
  } else {
    raw.rankedFiles.forEach((file, i) => {
      const p = `rankedFiles[${i}]`;
      if (!isObj(file)) {
        issues.push({ path: p, message: "Must be object" });
        return;
      }
      if (typeof file.filePath !== "string" || !file.filePath) {
        issues.push({ path: `${p}.filePath`, message: "Required" });
      }
      if (typeof file.rank !== "number" || file.rank < 1) {
        issues.push({ path: `${p}.rank`, message: "Integer ≥ 1" });
      }
      if (
        !Array.isArray(file.cweIds) ||
        file.cweIds.length < 1 ||
        !file.cweIds.every(
          (c) => typeof c === "string" && /^CWE-\d+$/.test(c),
        )
      ) {
        issues.push({ path: `${p}.cweIds`, message: "Non-empty CWE-id array" });
      }
      if (typeof file.title !== "string" || !file.title) {
        issues.push({ path: `${p}.title`, message: "Required" });
      }
      if (!["low", "medium", "high"].includes(String(file.confidence))) {
        issues.push({
          path: `${p}.confidence`,
          message: "Must be low|medium|high",
        });
      }
      if (!Array.isArray(file.evidence) || file.evidence.length < 1) {
        issues.push({
          path: `${p}.evidence`,
          message: "At least one evidence quote required",
        });
      } else {
        file.evidence.forEach((ev, j) => {
          const ep = `${p}.evidence[${j}]`;
          if (!isObj(ev)) {
            issues.push({ path: ep, message: "Must be object" });
            return;
          }
          if (typeof ev.filePath !== "string" || !ev.filePath) {
            issues.push({ path: `${ep}.filePath`, message: "Required" });
          }
          if (typeof ev.excerpt !== "string" || !ev.excerpt) {
            issues.push({ path: `${ep}.excerpt`, message: "Required quote" });
          }
          if (typeof ev.note !== "string" || !ev.note) {
            issues.push({ path: `${ep}.note`, message: "Required" });
          }
        });
      }
    });
  }

  // No-exploit invariant on all free text
  const texts: string[] = [];
  if (typeof raw.notes === "string") texts.push(raw.notes);
  if (Array.isArray(raw.rankedFiles)) {
    for (const f of raw.rankedFiles) {
      if (!isObj(f)) continue;
      if (typeof f.title === "string") texts.push(f.title);
      if (typeof f.filePath === "string") texts.push(f.filePath);
      if (Array.isArray(f.evidence)) {
        for (const e of f.evidence) {
          if (!isObj(e)) continue;
          if (typeof e.note === "string") texts.push(e.note);
          if (typeof e.excerpt === "string") texts.push(e.excerpt);
        }
      }
    }
  }
  if (Array.isArray(raw.explorationTrace)) {
    for (const t of raw.explorationTrace) {
      if (!isObj(t)) continue;
      if (typeof t.command === "string") texts.push(t.command);
      if (typeof t.summary === "string") texts.push(t.summary);
    }
  }
  const exploitHits = checkNoExploitInvariant(texts);
  for (const h of exploitHits) {
    issues.push({
      path: "no-exploit",
      message: `${h.id}: ${h.hint} (sample: ${h.sample})`,
    });
  }

  if (issues.length) return { ok: false, issues };

  // Assert again for throw-path consumers
  assertNoExploitInvariant(texts);

  return { ok: true, submission: raw as unknown as OperatorSubmission };
}
