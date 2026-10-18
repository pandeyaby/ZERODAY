/**
 * Kernel benchmark scorer: hit@1 / hit@3 / hit@5 on file and on function, from
 * ZERODAY report.json (zeroday.report/v1) or SARIF 2.1.0 output.
 *
 * Ranked files come from rank order. Ranked functions are the distinct
 * (file, function) pairs in that order, taken from evidence `function` /
 * SARIF logicalLocations, or — when only a line is given — from the C function
 * enclosing that line in the pre-fix source (`readSource`).
 */

import { enclosingCFunction, extractCFunctions, isCPath } from "../../src/locate/c-functions";

export interface KernelEntry {
  cve: string;
  cwe: string;
  description: string;
  fixCommit: string;
  fixesCommit: string;
  parentCommit: string;
  file: string;
  functions: string[];
  scope: string;
}

export interface Ranked {
  files: string[];
  /** `path::function`, distinct, in rank order. */
  functions: string[];
}

export const KS = [1, 3, 5] as const;

export interface EntryScore {
  cve: string;
  scored: boolean;
  fileRank: number | null;
  functionRank: number | null;
  rankedFiles: number;
  rankedFunctions: number;
}

export interface Summary {
  entries: number;
  scored: number;
  missing: number;
  file: Record<`hit@${(typeof KS)[number]}`, { hits: number; rate: number }>;
  function: Record<`hit@${(typeof KS)[number]}`, { hits: number; rate: number }>;
  perEntry: EntryScore[];
}

type SourceReader = (filePath: string) => string | null;

export function normalizePath(p: string): string {
  return p.replace(/\\/g, "/").replace(/^file:\/\/.*?\/snapshot\//, "").replace(/^\/?snapshot\//, "").replace(/^\.\//, "");
}

function functionAt(file: string, line: number | undefined, readSource?: SourceReader): string | undefined {
  if (typeof line !== "number" || !readSource || !isCPath(file)) return undefined;
  const src = readSource(file);
  return src == null ? undefined : enclosingCFunction(extractCFunctions(src), line)?.name;
}

function push(out: Ranked, file: string, fns: Array<string | undefined>) {
  if (!out.files.includes(file)) out.files.push(file);
  for (const fn of fns) {
    const key = fn ? `${file}::${fn}` : null;
    if (key && !out.functions.includes(key)) out.functions.push(key);
  }
}

interface ReportFile {
  filePath: string;
  rank?: number;
  evidence?: Array<{ startLine?: number; function?: string }>;
}
interface SarifResult {
  locations?: Array<{
    physicalLocation?: { artifactLocation?: { uri?: string }; region?: { startLine?: number } };
    logicalLocations?: Array<{ name?: string; kind?: string }>;
  }>;
  properties?: { submission_rank?: number; functions?: unknown };
}
interface AnyReport {
  rankedFiles?: ReportFile[];
  version?: string;
  runs?: Array<{ results?: SarifResult[] }>;
}

/** Ranked files / functions from a report.json or SARIF document. */
export function rankedFromReport(doc: unknown, readSource?: SourceReader): Ranked {
  const out: Ranked = { files: [], functions: [] };
  const d = (doc ?? {}) as AnyReport;
  if (Array.isArray(d.rankedFiles)) {
    const files = [...d.rankedFiles].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
    for (const f of files) {
      const file = normalizePath(String(f.filePath));
      const ev = Array.isArray(f.evidence) ? f.evidence : [];
      push(out, file, ev.map((e) => e.function ?? functionAt(file, e.startLine, readSource)));
    }
    return out;
  }
  if (d.version === "2.1.0" && Array.isArray(d.runs)) {
    const results = [...(d.runs[0]?.results ?? [])];
    results.sort((a, b) => (a.properties?.submission_rank ?? 0) - (b.properties?.submission_rank ?? 0));
    for (const r of results) {
      const loc = r.locations?.[0];
      const uri = loc?.physicalLocation?.artifactLocation?.uri;
      if (!uri) continue;
      const file = normalizePath(String(uri));
      const fromProps = Array.isArray(r.properties?.functions) ? (r.properties.functions as unknown[]).map(String) : [];
      const named = [
        ...(loc?.logicalLocations ?? []).filter((l) => l.name && (!l.kind || l.kind === "function")).map((l) => String(l.name)),
        ...fromProps,
      ];
      push(out, file, named.length ? named : [functionAt(file, loc?.physicalLocation?.region?.startLine, readSource)]);
    }
    return out;
  }
  throw new Error("not a zeroday.report/v1 or SARIF 2.1.0 document");
}

export function scoreEntry(entry: KernelEntry, ranked: Ranked | null): EntryScore {
  if (!ranked) return { cve: entry.cve, scored: false, fileRank: null, functionRank: null, rankedFiles: 0, rankedFunctions: 0 };
  const fi = ranked.files.indexOf(entry.file);
  const truth = new Set(entry.functions.map((f) => `${entry.file}::${f}`));
  const fni = ranked.functions.findIndex((k) => truth.has(k));
  return {
    cve: entry.cve,
    scored: true,
    fileRank: fi >= 0 ? fi + 1 : null,
    functionRank: fni >= 0 ? fni + 1 : null,
    rankedFiles: ranked.files.length,
    rankedFunctions: ranked.functions.length,
  };
}

/** Rates are over every manifest entry; an entry without a report counts as a miss. */
export function summarize(scores: EntryScore[]): Summary {
  const n = scores.length;
  const at = (rank: (s: EntryScore) => number | null) =>
    Object.fromEntries(
      KS.map((k) => {
        const hits = scores.filter((s) => {
          const r = rank(s);
          return r != null && r <= k;
        }).length;
        return [`hit@${k}`, { hits, rate: n ? Math.round((hits / n) * 1000) / 1000 : 0 }];
      }),
    ) as Summary["file"];
  const scored = scores.filter((s) => s.scored).length;
  return {
    entries: n,
    scored,
    missing: n - scored,
    file: at((s) => s.fileRank),
    function: at((s) => s.functionRank),
    perEntry: scores,
  };
}
