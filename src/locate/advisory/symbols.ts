/**
 * Vulnerable symbols for an advisory, from (best first):
 *  1. OSV `ecosystem_specific.imports[].symbols` (Go vulndb lists exact functions)
 *  2. Functions touched by the fix commit (git hunk headers), when reachable
 *  3. Identifiers the advisory text names in backticks ("via the `template` function")
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { OsvAffected, OsvRecord } from "./osv";

export interface SymbolSet {
  /** Bare names to look for at call sites (`template`, `ServeConn`, `full_load`). */
  names: Set<string>;
  /** Where each name came from, for evidence notes. */
  source: "osv-symbols" | "fix-commit" | "advisory-text" | "none";
}

const NOISE = new Set([
  "true", "false", "null", "none", "undefined", "npm", "pip", "yarn", "go", "java", "http", "https",
  "json", "yaml", "xml", "html", "string", "object", "function", "class", "import", "require", "latest",
  "variable", "imports", "prototype", "option", "options", "value", "values", "input", "data", "key", "keys",
  "argument", "arguments", "parameter", "parameters", "property", "properties", "method", "module", "package",
]);

function isIdent(s: string): boolean {
  return /^[A-Za-z_$][\w$]*$/.test(s) && s.length >= 3 && !NOISE.has(s.toLowerCase());
}

function fromOsvSymbols(affected: OsvAffected[]): Set<string> {
  const out = new Set<string>();
  for (const a of affected) {
    for (const imp of a.ecosystem_specific?.imports ?? []) {
      for (const s of imp.symbols ?? []) {
        const last = s.split(".").pop()!;
        if (isIdent(last)) out.add(last);
      }
    }
  }
  return out;
}

function fromText(rec: OsvRecord, packageNames: string[]): Set<string> {
  const out = new Set<string>();
  const pkgs = new Set(packageNames.map((p) => p.toLowerCase().split(/[/:]/).pop()!));
  const text = `${rec.summary ?? ""}\n${rec.details ?? ""}`;
  const found = [
    ...[...text.matchAll(/`([A-Za-z_$][\w$.]*?)(?:\(\))?`/g)].map((m) => m[1]!),
    // "through the full_load method", "via the template function"
    ...[...text.matchAll(/\b(?:the|via|in)\s+`?([A-Za-z_$][\w$.]*)`?(?:\(\))?\s+(?:function|method|API|call)s?\b/g)].map((m) => m[1]!),
  ];
  for (const raw of found) {
    const last = raw.split(".").pop()!;
    if (!isIdent(last) || pkgs.has(last.toLowerCase())) continue;
    if (/^[A-Z0-9_]+$/.test(last)) continue; // CONSTANTS / env vars are rarely the vulnerable call
    out.add(last);
  }
  return out;
}

const TEST_PATH = /(?:^|\/)(?:tests?|__tests__|spec|testing)\/|(?:^|\/)test_[^/]*\.py$|_test\.(?:go|py)$|\.(?:test|spec)\.[jt]sx?$|Test\.java$/;

/** Function names from git diff hunk headers: `@@ -1,2 +1,2 @@ function template(string, options) {`. */
export function functionsFromPatch(patch: string): Set<string> {
  const out = new Set<string>();
  let inTest = false;
  for (const m of patch.matchAll(/^(?:diff --git a\/\S+ b\/(\S+)|@@[^@]*@@\s*(.*))$/gm)) {
    if (m[1] !== undefined) {
      // Tests added by the fix name the regression test, not the vulnerable API.
      inTest = TEST_PATH.test(m[1]);
      continue;
    }
    if (inTest) continue;
    const ctx = m[2]!;
    const named =
      /\b(?:function|def|func)\s+(?:\([^)]*\)\s*)?([A-Za-z_$][\w$]*)/.exec(ctx) ??
      /([A-Za-z_$][\w$]*)\s*(?:=|:)\s*(?:async\s+)?function\b/.exec(ctx) ??
      /([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*(?:throws [\w., ]+)?\s*\{?\s*$/.exec(ctx);
    if (named && isIdent(named[1]!) && !/^(?:test_|Test[A-Z_])/.test(named[1]!)) out.add(named[1]!);
  }
  return out;
}

async function fromFixCommits(rec: OsvRecord, offline: boolean): Promise<Set<string>> {
  const out = new Set<string>();
  if (offline || process.env.ZERODAY_OFFLINE === "1") return out;
  const commits = (rec.references ?? [])
    .map((r) => /github\.com\/([^/]+)\/([^/]+)\/commit\/([0-9a-f]{7,40})/.exec(r.url))
    .filter((m): m is RegExpExecArray => !!m)
    .slice(0, 3);
  const dir = path.join(process.env.ZERODAY_CACHE_DIR ?? path.join(os.homedir(), ".cache", "zeroday"), "fix-commits");
  for (const [, owner, repo, sha] of commits) {
    const cacheFile = path.join(dir, `${owner}_${repo}_${sha}.patch`);
    let patch: string | null = null;
    try {
      patch = fs.readFileSync(cacheFile, "utf8");
    } catch {
      /* not cached */
    }
    if (patch === null) {
      for (const url of [`https://github.com/${owner}/${repo}/commit/${sha}.patch`]) {
        try {
          const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
          if (res.ok) {
            patch = await res.text();
            break;
          }
        } catch {
          /* try next */
        }
      }
      if (patch !== null) {
        try {
          fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(cacheFile, patch);
        } catch {
          /* best-effort cache */
        }
      }
    }
    if (patch) for (const f of functionsFromPatch(patch)) out.add(f);
  }
  return out;
}

/** Symbols for one advisory, combining every linked record (GHSA + GO + PYSEC …). */
export async function vulnerableSymbols(records: OsvRecord[], opts: { offline: boolean }): Promise<SymbolSet> {
  const affected = records.flatMap((r) => r.affected ?? []);
  const osv = fromOsvSymbols(affected);
  if (osv.size) return { names: osv, source: "osv-symbols" };
  const fix = new Set<string>();
  for (const r of records) for (const f of await fromFixCommits(r, opts.offline)) fix.add(f);
  const text = new Set<string>();
  for (const r of records) for (const t of fromText(r, affected.map((a) => a.package?.name ?? ""))) text.add(t);
  if (fix.size) {
    // Prefer functions the advisory also names; otherwise every function the fix touched.
    const both = [...fix].filter((f) => text.has(f));
    return { names: new Set(both.length ? both : fix), source: "fix-commit" };
  }
  if (text.size) return { names: text, source: "advisory-text" };
  return { names: new Set(), source: "none" };
}
