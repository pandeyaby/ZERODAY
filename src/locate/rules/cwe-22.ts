/**
 * Optional thin CWE-22 (path traversal) heuristics — cheap patterns only.
 */

import type { TraceStep } from "../types";
import { readFileLines, type WalkedFile } from "./walk";
import type { RuleHit } from "./cwe-89";

const PATH_PATTERNS: Array<{
  id: string;
  re: RegExp;
  title: string;
  note: string;
  score: number;
}> = [
  {
    id: "path-join-req",
    re: /path\.join\s*\([^)]*(?:req\.|request\.|params\.|query\.|body\.)/i,
    title: "path.join with request-derived segment",
    note: "path.join mixes filesystem root with request input — candidate for CWE-22 review.",
    score: 75,
  },
  {
    id: "readfile-concat",
    re: /(?:readFile|createReadStream|openSync)\s*\(\s*[^,)]*\+/i,
    title: "Filesystem read with concatenated path",
    note: "File read uses string concatenation for path — candidate for path-traversal review.",
    score: 70,
  },
  {
    id: "dotdot-in-path-expr",
    re: /["'`].*\.\.\/.*["'`]|path\.resolve\s*\([^)]*(?:req\.|params\.)/i,
    title: "Path expression with ../ or request resolve",
    note: "Path expression involves ../ or request-derived resolve — localization candidate.",
    score: 60,
  },
];

export function scanRepoForCwe22(files: WalkedFile[]): {
  hits: RuleHit[];
  trace: TraceStep[];
} {
  const hits: RuleHit[] = [];
  const trace: TraceStep[] = [
    {
      step: 1,
      tool: "grep",
      command: "rules:cwe-22 path.join|readFile concat|../",
      summary: "Applied thin optional CWE-22 path-traversal patterns.",
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
      for (const pat of PATH_PATTERNS) {
        if (!pat.re.test(line)) continue;
        hits.push({
          ruleId: `cwe-22/${pat.id}`,
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
