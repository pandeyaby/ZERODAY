/**
 * Thin in-repo CWE-89 heuristics (SQL injection localization candidates).
 * Grep/path patterns only — not Semgrep, not Antares F1, not exploitability.
 */

import type { EvidenceSpan, RankedFile, TraceStep } from "../types";
import { readFileLines, type WalkedFile } from "./walk";

export interface RuleHit {
  ruleId: string;
  filePath: string;
  startLine: number;
  endLine: number;
  title: string;
  note: string;
  excerpt: string;
  score: number;
}

/** Patterns that look like SQL string construction with concatenation. */
const SQL_CONCAT_PATTERNS: Array<{
  id: string;
  re: RegExp;
  title: string;
  note: string;
  score: number;
}> = [
  {
    id: "sql-var-assign-select",
    // const sql = "SELECT …  OR  sql = 'SELECT …
    re: /(?:const|let|var)\s+\w+\s*=\s*(["'`])(?:SELECT|INSERT|UPDATE|DELETE)\b/i,
    title: "SQL query built via string concatenation",
    note: "SQL keyword assigned to a string variable — candidate for CWE-89 review (not exploit proof).",
    score: 90,
  },
  {
    id: "sql-plus-concat",
    // "…SELECT…" +  or  '…WHERE…' + name
    re: /(["'])[^"'\\\n]{0,120}(?:SELECT|INSERT|UPDATE|DELETE|WHERE)[^"'\\\n]{0,120}\1\s*\+/i,
    title: "SQL fragment concatenated with variable",
    note: "SQL string literal concatenated with an expression — localization candidate for injection review.",
    score: 95,
  },
  {
    id: "sql-plus-embed-classic",
    // classic: "…'" + name + "'…"
    re: /(?:SELECT|INSERT|UPDATE|DELETE|WHERE)[^;\n]{0,120}\+\s*\w+\s*\+/i,
    title: "SQL query built via string concatenation",
    note: "User-controlled identifier concatenated into SQL-like text — candidate for CWE-89 review.",
    score: 96,
  },
  {
    id: "sql-template-interp",
    // JS/TS template literals with SELECT…${…}
    re: /`[^`]*(?:SELECT|INSERT|UPDATE|DELETE|WHERE)[^`]*\$\{/i,
    title: "SQL built with template-literal interpolation",
    note: "Template literal embeds expression into SQL-like text — candidate for CWE-89 review.",
    score: 88,
  },
  {
    id: "sql-format-percent",
    // Python "…%s…" % / .format with SQL keywords
    re: /(?:SELECT|INSERT|UPDATE|DELETE|WHERE).{0,60}(?:%\s*\(|%\s*[sd]|\.format\s*\()/i,
    title: "SQL string formatted with untrusted placeholders",
    note: "SQL-like text uses % / .format formatting — candidate for parameterized-query review.",
    score: 80,
  },
  {
    id: "sql-fstring",
    re: /f(["'])(?:SELECT|INSERT|UPDATE|DELETE|WHERE)/i,
    title: "SQL built with Python f-string",
    note: "f-string starts a SQL keyword query — candidate for CWE-89 review.",
    score: 85,
  },
  {
    id: "sql-exec-concat",
    re: /(?:execute|query|raw)\s*\(\s*(["'`]).*(?:SELECT|INSERT|UPDATE|DELETE).*\1\s*\+/i,
    title: "DB execute/query with concatenated SQL",
    note: "Database call receives concatenated SQL string — localization candidate.",
    score: 92,
  },
];

function excerptAround(lines: string[], lineIdx: number, pad = 1): string {
  const start = Math.max(0, lineIdx - pad);
  const end = Math.min(lines.length - 1, lineIdx + pad);
  return lines.slice(start, end + 1).join("\n").slice(0, 400);
}

/**
 * Scan one file for CWE-89 heuristic hits.
 */
export function scanFileForCwe89(file: WalkedFile): RuleHit[] {
  let lines: string[];
  try {
    lines = readFileLines(file.absPath);
  } catch {
    return [];
  }
  const hits: RuleHit[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    // Cheap gate: skip lines without SQL-ish tokens
    if (!/(?:SELECT|INSERT|UPDATE|DELETE|WHERE|execute|query|FROM)\b/i.test(line)) {
      continue;
    }
    // Also peek at next line for multi-line concat (demo-app style)
    const window = [line, lines[i + 1] ?? ""].join("\n");
    for (const pat of SQL_CONCAT_PATTERNS) {
      if (!pat.re.test(line) && !pat.re.test(window)) continue;
      const key = `${file.relPath}:${i + 1}:${pat.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      hits.push({
        ruleId: `cwe-89/${pat.id}`,
        filePath: file.relPath,
        startLine: i + 1,
        endLine: Math.min(lines.length, i + 2),
        title: pat.title,
        note: pat.note,
        excerpt: excerptAround(lines, i),
        score: pat.score,
      });
      break; // one pattern per line is enough
    }
  }
  return hits;
}

export function scanRepoForCwe89(files: WalkedFile[]): {
  hits: RuleHit[];
  trace: TraceStep[];
} {
  const trace: TraceStep[] = [
    {
      step: 1,
      tool: "find",
      command: "rules-walk source extensions",
      summary: `Rules walk listed ${files.length} source file(s) for CWE-89 heuristics.`,
    },
    {
      step: 2,
      tool: "grep",
      command: "rules:cwe-89 sql-concat / template / format",
      summary: "Applied thin in-repo CWE-89 allowlisted patterns (no Semgrep).",
    },
  ];

  const hits: RuleHit[] = [];
  for (const f of files) {
    hits.push(...scanFileForCwe89(f));
  }

  hits.sort((a, b) => b.score - a.score || a.filePath.localeCompare(b.filePath));

  trace.push({
    step: 3,
    tool: "other",
    command: "rules:rank",
    summary:
      hits.length > 0
        ? `Ranked ${hits.length} CWE-89 heuristic hit(s) across unique files.`
        : "No CWE-89 heuristic hits in scanned sources.",
  });

  return { hits, trace };
}

/** Collapse hits to one RankedFile per path (best score wins evidence). */
export function hitsToRankedFiles(hits: RuleHit[], cweId: string): RankedFile[] {
  const byFile = new Map<string, RuleHit[]>();
  for (const h of hits) {
    const list = byFile.get(h.filePath) ?? [];
    list.push(h);
    byFile.set(h.filePath, list);
  }

  const ranked: Array<{ score: number; file: RankedFile }> = [];
  for (const [filePath, fileHits] of byFile) {
    fileHits.sort((a, b) => b.score - a.score);
    const best = fileHits[0]!;
    const evidence: EvidenceSpan[] = fileHits.slice(0, 3).map((h) => ({
      filePath: h.filePath,
      startLine: h.startLine,
      endLine: h.endLine,
      excerpt: h.excerpt,
      note: `${h.note} [rule ${h.ruleId}]`,
    }));
    ranked.push({
      score: best.score,
      file: {
        filePath,
        rank: 0,
        cweIds: [cweId],
        title: best.title,
        evidence,
      },
    });
  }

  ranked.sort((a, b) => b.score - a.score || a.file.filePath.localeCompare(b.file.filePath));
  return ranked.map((r, i) => ({ ...r.file, rank: i + 1 }));
}
