/**
 * Lightweight C function extractor (ctags-style, no parser dependency).
 *
 * Finds top-level function definitions and their line spans so C results can be
 * ranked and scored per function, not only per file. Comments, string / char
 * literals and preprocessor lines are blanked first, then braces are matched.
 * Heuristic by design: good enough for kernel-style C, not a C front end.
 */

import fs from "node:fs";
import path from "node:path";

export interface CFunction {
  name: string;
  /** 1-based first line of the definition (return type / signature). */
  startLine: number;
  /** 1-based line of the closing brace. */
  endLine: number;
}

const C_EXTENSIONS = new Set([".c", ".h"]);

export function isCPath(filePath: string): boolean {
  return C_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

/** Parenthesised groups that are attributes / annotations, never the parameter list. */
const ATTRIBUTE_CALLS = /^(?:__attribute__|__attribute|__declspec|__aligned|__section|__printf|__scanf|__must_hold|__acquires|__releases|__cond_acquires|__cond_releases|__no_sanitize\w*|__diagnose_as|__alloc_size|__realloc_size|alignas|_Alignas)$/;
/** Kernel definer macros whose first argument names the function (SYSCALL_DEFINE3(open, ...)). */
const DEFINER_MACRO = /^(?:COMPAT_)?SYSCALL_DEFINE\d$|^BPF_CALL_\d$/;
const NOT_A_NAME = /^(?:if|for|while|switch|return|sizeof|typeof|__typeof__|do|else|case)$/;

/**
 * Keep only the first branch of each #if / #ifdef block: `#else` / `#elif`
 * branches are blanked so duplicated `{` lines across branches stay balanced.
 */
function keepFirstBranch(source: string): string {
  const lines = source.split("\n");
  const stack: boolean[] = []; // per open conditional: is this level skipping?
  for (let i = 0; i < lines.length; i++) {
    const d = /^\s*#\s*(if|ifdef|ifndef|elif|else|endif)\b/.exec(lines[i]!)?.[1];
    const skipping = stack.includes(true);
    if (d === "if" || d === "ifdef" || d === "ifndef") stack.push(false);
    else if ((d === "elif" || d === "else") && stack.length) stack[stack.length - 1] = true;
    else if (d === "endif") stack.pop();
    if (!d && skipping) lines[i] = lines[i]!.replace(/[^\s]/g, " ");
  }
  return lines.join("\n");
}

/** Replace comments, literals and preprocessor lines with spaces (newlines kept). */
export function blankCNoise(raw: string): string {
  const source = keepFirstBranch(raw);
  const out = source.split("");
  const n = source.length;
  let i = 0;
  let lineStart = true;
  const blank = (from: number, to: number) => {
    for (let k = from; k < to; k++) if (out[k] !== "\n") out[k] = " ";
  };
  while (i < n) {
    const c = source[i]!;
    if (lineStart && c === "#") {
      // Preprocessor directive, including backslash continuations.
      let j = i;
      while (j < n && !(source[j] === "\n" && source[j - 1] !== "\\")) j++;
      blank(i, j);
      i = j;
      continue;
    }
    if (c === "/" && source[i + 1] === "*") {
      const end = source.indexOf("*/", i + 2);
      const j = end < 0 ? n : end + 2;
      blank(i, j);
      i = j;
      lineStart = false;
      continue;
    }
    if (c === "/" && source[i + 1] === "/") {
      let j = i;
      while (j < n && source[j] !== "\n") j++;
      blank(i, j);
      i = j;
      continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && source[j] !== c && source[j] !== "\n") j += source[j] === "\\" ? 2 : 1;
      blank(i, Math.min(j + 1, n));
      i = j + 1;
      lineStart = false;
      continue;
    }
    if (c === "\n") lineStart = true;
    else if (c !== " " && c !== "\t") lineStart = false;
    i++;
  }
  return out.join("");
}

/** Name of the function a top-level header (text before `{`) defines, or null. */
function functionName(header: string): string | null {
  if (!header.includes("(")) return null;
  let depth = 0;
  let groupStart = -1;
  for (let i = 0; i < header.length; i++) {
    const c = header[i];
    if (c === "(") {
      if (depth === 0) groupStart = i;
      depth++;
    } else if (c === ")") {
      depth--;
      if (depth === 0 && groupStart >= 0) {
        const before = /([A-Za-z_]\w*)\s*$/.exec(header.slice(0, groupStart));
        const ident = before?.[1];
        if (!ident || ATTRIBUTE_CALLS.test(ident)) continue;
        if (NOT_A_NAME.test(ident)) return null;
        if (DEFINER_MACRO.test(ident)) {
          return /^\(\s*([A-Za-z_]\w*)/.exec(header.slice(groupStart))?.[1] ?? ident;
        }
        return ident;
      }
    } else if (c === "=" && depth === 0) {
      return null; // initializer: `struct ops x = {`
    }
  }
  return null;
}

/** Top-level C function definitions with 1-based line spans, in file order. */
export function extractCFunctions(source: string): CFunction[] {
  const text = blankCNoise(source);
  const fns: CFunction[] = [];
  let depth = 0;
  let line = 1;
  let headerStart = 0;
  let open: { name: string | null; startLine: number } | null = null;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "\n") {
      line++;
      continue;
    }
    if (c === "{") {
      if (depth === 0) {
        const header = text.slice(headerStart, i);
        const lead = header.length - header.trimStart().length;
        const startLine = line - (header.slice(lead).match(/\n/g)?.length ?? 0);
        open = { name: functionName(header.trim()), startLine };
      }
      depth++;
    } else if (c === "}") {
      depth = Math.max(0, depth - 1);
      if (depth === 0) {
        if (open?.name) fns.push({ name: open.name, startLine: open.startLine, endLine: line });
        open = null;
        headerStart = i + 1;
      }
    } else if (c === ";" && depth === 0) {
      headerStart = i + 1;
    }
  }
  return fns;
}

/** The function whose span contains `line` (1-based), if any. */
export function enclosingCFunction(fns: CFunction[], line: number): CFunction | undefined {
  return fns.find((f) => line >= f.startLine && line <= f.endLine);
}

/**
 * Tag evidence in C files with the enclosing function (`evidence[].function`),
 * so reports and SARIF rank functions as well as files. Unreadable files and
 * evidence without a line are left as they are.
 */
export function annotateCFunctions(
  result: { rankedFiles: Array<{ filePath: string; evidence: Array<{ startLine?: number; function?: string }> }> },
  root: string,
): void {
  for (const file of result.rankedFiles) {
    if (!isCPath(file.filePath) || !file.evidence.some((e) => typeof e.startLine === "number")) continue;
    let fns: CFunction[];
    try {
      fns = extractCFunctions(fs.readFileSync(path.join(root, file.filePath), "utf8"));
    } catch {
      continue;
    }
    for (const e of file.evidence) {
      if (typeof e.startLine !== "number" || e.function) continue;
      const fn = enclosingCFunction(fns, e.startLine);
      if (fn) e.function = fn.name;
    }
  }
}
