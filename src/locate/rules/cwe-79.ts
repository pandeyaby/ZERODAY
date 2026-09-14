/**
 * Optional thin CWE-79 (XSS) heuristics — cheap string patterns only.
 */

import type { TraceStep } from "../types";
import { readFileLines, type WalkedFile } from "./walk";
import type { RuleHit } from "./cwe-89";

const XSS_PATTERNS: Array<{
  id: string;
  re: RegExp;
  title: string;
  note: string;
  score: number;
}> = [
  {
    id: "innerhtml-assign",
    re: /\.innerHTML\s*=/,
    title: "DOM sink via innerHTML assignment",
    note: "innerHTML assignment — candidate for CWE-79 review (not exploit proof).",
    score: 70,
  },
  {
    id: "document-write",
    re: /document\.write\s*\(/,
    title: "document.write call site",
    note: "document.write — candidate for XSS localization review.",
    score: 65,
  },
  {
    id: "dangerously-set-html",
    re: /dangerouslySetInnerHTML/,
    title: "React dangerouslySetInnerHTML usage",
    note: "dangerouslySetInnerHTML — candidate for CWE-79 review.",
    score: 75,
  },
];

export function scanRepoForCwe79(files: WalkedFile[]): {
  hits: RuleHit[];
  trace: TraceStep[];
} {
  const hits: RuleHit[] = [];
  const trace: TraceStep[] = [
    {
      step: 1,
      tool: "grep",
      command: "rules:cwe-79 innerHTML|document.write|dangerouslySetInnerHTML",
      summary: "Applied thin optional CWE-79 DOM-sink patterns.",
    },
  ];

  for (const f of files) {
    let lines: string[];
    try {
      lines = readFileLines(f.absPath);
    } catch {
      continue;
    }
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      for (const pat of XSS_PATTERNS) {
        if (!pat.re.test(line)) continue;
        hits.push({
          ruleId: `cwe-79/${pat.id}`,
          filePath: f.relPath,
          startLine: i + 1,
          endLine: i + 1,
          title: pat.title,
          note: pat.note,
          excerpt: line.slice(0, 400),
          score: pat.score,
        });
        break;
      }
    }
  }

  hits.sort((a, b) => b.score - a.score || a.filePath.localeCompare(b.filePath));
  return { hits, trace };
}
