/**
 * Optional thin CWE-22 (path traversal) heuristics — cheap patterns only.
 */

import type { TraceStep } from "../types";
import { readFileLines, type WalkedFile } from "./walk";
import type { RuleHit } from "./cwe-89";

/**
 * Filesystem APIs where a ../ literal reaches the disk: fs.* calls, Express
 * sendFile, and a bare open( (Python / C) — not window.open or path.join
 * (path.join(__dirname, "../views") is a normal static-dir idiom).
 */
const FS_CALL =
  "(?:\\bfs\\w*\\.(?:read|write|append|create|open|unlink|readdir|stat|access|rm)\\w*|\\bsendFile|(?<![.\\w])open)";

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
    re: /(?:readFile(?:Sync)?|createReadStream|openSync)\s*\(\s*[^,)]*\+/i,
    title: "Filesystem read with concatenated path",
    note: "File read uses string concatenation for path — candidate for path-traversal review.",
    score: 70,
  },
  {
    id: "resolve-req",
    re: /path\.resolve\s*\([^)]*(?:req\.|request\.|params\.|query\.|body\.)/i,
    title: "path.resolve with request-derived segment",
    note: "path.resolve mixes a filesystem root with request input — candidate for CWE-22 review.",
    score: 70,
  },
  {
    // ../ only counts inside a filesystem call — not in any string literal.
    id: "dotdot-in-fs-call",
    re: new RegExp(
      `${FS_CALL}\\s*\\([^)]*["'\`][^"'\`]*\\.\\.[\\\\/]`,
      "i",
    ),
    title: "Filesystem call with ../ path segment",
    note: "Filesystem call includes a ../ segment — localization candidate for path-traversal review.",
    score: 40,
  },
];

/**
 * Module loading (require / import / export … from / Python import) resolves
 * relative paths at build time, not from user input — never a CWE-22 signal.
 */
const MODULE_LOAD_LINE =
  /^\s*(?:import\b|export\b[^;]*\bfrom\b|from\s+\S+\s+import\b)|\brequire\s*\(\s*["'`]|\bimport\s*\(\s*["'`]/;

export function scanRepoForCwe22(files: WalkedFile[]): {
  hits: RuleHit[];
  trace: TraceStep[];
} {
  const hits: RuleHit[] = [];
  const trace: TraceStep[] = [
    {
      step: 1,
      tool: "grep",
      command: "rules:cwe-22 path.join/resolve(req)|readFile concat|fs-call ../",
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
      if (MODULE_LOAD_LINE.test(line)) continue;
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
