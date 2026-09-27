/**
 * Advisory matching: "this advisory landed — which files matter?"
 *
 * advisory id → OSV package records → installed versions from lockfiles →
 * affected? → files importing the package → call sites of the vulnerable functions.
 */

import fs from "node:fs";
import path from "node:path";
import type { RuleHit } from "../rules/cwe-89";
import { walkSourceFiles } from "../rules/walk";
import { readDependencies, normalizePyPI, type Dependency } from "./lockfiles";
import { packageRecords, type OsvAffected, type OsvRecord } from "./osv";
import { vulnerableSymbols, type SymbolSet } from "./symbols";
import { compareVersions, fixedVersionFor, inRange } from "./versions";

export type AdvisoryVerdict = "affected" | "possibly-affected" | "not-affected" | "not-used" | "no-data";

export interface AdvisoryPackageMatch {
  ecosystem: string;
  name: string;
  installed: string;
  file: string;
  line: number;
  exact: boolean;
  affected: boolean;
  fixed?: string;
}

export interface AdvisoryMatch {
  advisoryIds: string[];
  summary?: string;
  cweIds: string[];
  verdict: AdvisoryVerdict;
  packages: AdvisoryPackageMatch[];
  symbols: string[];
  symbolSource: SymbolSet["source"];
  hits: RuleHit[];
  notes: string[];
}

/** PyPI distribution → import module names that differ from the normalized name. */
const PY_IMPORTS: Record<string, string[]> = {
  pyyaml: ["yaml"],
  pillow: ["PIL"],
  beautifulsoup4: ["bs4"],
  "python-dateutil": ["dateutil"],
  "scikit-learn": ["sklearn"],
  "opencv-python": ["cv2"],
  protobuf: ["google.protobuf"],
  pyjwt: ["jwt"],
  "psycopg2-binary": ["psycopg2"],
  "python-jose": ["jose"],
  attrs: ["attr"],
  djangorestframework: ["rest_framework"],
  pycryptodome: ["Crypto"],
  "python-multipart": ["multipart"],
};

function samePackage(eco: string, advisoryName: string, dep: Dependency): boolean {
  if (dep.ecosystem !== eco) return false;
  if (eco === "PyPI") return normalizePyPI(advisoryName) === dep.name;
  if (eco === "Go") return advisoryName === dep.name || advisoryName.startsWith(`${dep.name}/`);
  return advisoryName === dep.name;
}

function isAffected(a: OsvAffected, version: string): boolean {
  const eco = a.package!.ecosystem;
  if (a.versions?.includes(version)) return true;
  return (a.ranges ?? []).some((r) => inRange(eco, version, r));
}

interface Binding {
  /** How the file refers to the package / module (`_`, `yaml`, `http`), or null. */
  names: string[];
  /** Symbols imported directly by name (`{ template }`, `from yaml import load`). */
  direct: Map<string, string>;
  line: number;
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** How (if at all) `text` imports the package. */
function importsOf(eco: string, pkg: string, goImportPaths: string[], text: string): Binding | null {
  const b: Binding = { names: [], direct: new Map(), line: 0 };
  const hit = (idx: number) => {
    if (!b.line) b.line = text.slice(0, idx).split("\n").length;
  };
  if (eco === "npm") {
    const spec = `${escape(pkg)}(?:/([\\w.-]+))?`;
    for (const m of text.matchAll(new RegExp(`(?:const|let|var)\\s+(\\{[^}]*\\}|[\\w$]+)\\s*=\\s*require\\(\\s*['"]${spec}['"]\\s*\\)`, "g"))) {
      hit(m.index!);
      addJsBinding(b, m[1]!, m[2]);
    }
    for (const m of text.matchAll(new RegExp(`import\\s+([^;]+?)\\s+from\\s+['"]${spec}['"]`, "g"))) {
      hit(m.index!);
      for (const part of m[1]!.split(/,(?![^{]*\})/)) addJsBinding(b, part.trim().replace(/^\*\s+as\s+/, ""), m[2]);
    }
    for (const m of text.matchAll(new RegExp(`require\\(\\s*['"]${spec}['"]\\s*\\)`, "g"))) hit(m.index!);
  } else if (eco === "PyPI") {
    const mods = PY_IMPORTS[normalizePyPI(pkg)] ?? [normalizePyPI(pkg).replace(/-/g, "_")];
    for (const mod of mods) {
      const m1 = new RegExp(`^\\s*import\\s+(${escape(mod)})((?:\\.\\w+)*)(?:\\s+as\\s+(\\w+))?`, "gm");
      for (const m of text.matchAll(m1)) {
        hit(m.index!);
        b.names.push(m[3] ?? `${m[1]}${m[2]}`);
      }
      const m2 = new RegExp(`^\\s*from\\s+${escape(mod)}(?:\\.[\\w.]+)?\\s+import\\s+\\(?([^)\\n]+)`, "gm");
      for (const m of text.matchAll(m2)) {
        hit(m.index!);
        for (const part of m[1]!.split(",")) {
          const [name, alias] = part.trim().split(/\s+as\s+/);
          if (name && /^\w+$/.test(name)) b.direct.set(alias?.trim() || name, name);
        }
      }
    }
  } else if (eco === "Go") {
    const paths = goImportPaths.length ? goImportPaths : [pkg];
    for (const m of text.matchAll(/(?:^|\n)\s*(?:import\s+)?(?:(\w+)\s+)?"([^"]+)"/g)) {
      const p = m[2]!;
      if (!paths.some((ip) => p === ip || p.startsWith(`${ip}/`))) continue;
      if (!/\bimport\b/.test(text.slice(0, m.index! + 1)) && !text.slice(Math.max(0, m.index! - 200), m.index!).includes("import")) continue;
      hit(m.index!);
      b.names.push(m[1] && m[1] !== "_" ? m[1] : p.split("/").pop()!);
    }
  } else if (eco === "Maven") {
    const [group, artifact] = pkg.split(":");
    const token = artifact?.split("-").pop() ?? "";
    const prefix3 = group!.split(".").slice(0, 3).join(".");
    for (const m of text.matchAll(/^\s*import\s+(?:static\s+)?([\w.]+)(?:\.\*)?\s*;/gm)) {
      const imp = m[1]!;
      if (imp.startsWith(`${group}.`) || (imp.startsWith(`${prefix3}.`) && imp.includes(`.${token}`))) {
        hit(m.index!);
        b.names.push(imp.split(".").pop()!);
      }
    }
  }
  return b.line ? b : null;
}

function addJsBinding(b: Binding, spec: string, subpath: string | undefined): void {
  if (spec.startsWith("{")) {
    for (const part of spec.replace(/[{}]/g, "").split(",")) {
      const [name, alias] = part.trim().split(/\s+as\s+|\s*:\s*/);
      if (name) b.direct.set((alias ?? name).trim(), name.trim());
    }
  } else if (spec) {
    // `import template from "lodash/template"` → the binding *is* the symbol.
    if (subpath) b.direct.set(spec, subpath);
    else b.names.push(spec);
  }
}

/** Line numbers where the file calls one of the vulnerable symbols. */
function callSites(eco: string, text: string, b: Binding, symbols: Set<string>): Array<{ line: number; symbol: string }> {
  const out: Array<{ line: number; symbol: string }> = [];
  const lines = text.split("\n");
  const patterns: Array<{ re: RegExp; symbol: string }> = [];
  for (const s of symbols) {
    for (const n of b.names) patterns.push({ re: new RegExp(`\\b${escape(n)}\\s*\\.\\s*${escape(s)}\\s*\\(`), symbol: s });
    for (const [local, imported] of b.direct) if (imported === s) patterns.push({ re: new RegExp(`(?<![\\w$.])${escape(local)}\\s*\\(`), symbol: s });
    // Go / Java methods on values of the package's types (`srv.Serve(`, `logger.error(`)
    if (eco === "Go" || eco === "Maven") patterns.push({ re: new RegExp(`\\.${escape(s)}\\s*\\(`), symbol: s });
  }
  lines.forEach((line, i) => {
    if (/^\s*(?:\/\/|#|\*)/.test(line)) return;
    const p = patterns.find((x) => x.re.test(line));
    if (p) out.push({ line: i + 1, symbol: p.symbol });
  });
  return out;
}

function excerpt(text: string, line: number): string {
  const lines = text.split("\n");
  return lines.slice(Math.max(0, line - 2), line + 1).join("\n").slice(0, 400);
}

export async function matchAdvisory(
  advisoryId: string,
  root: string,
  opts: { offline: boolean },
): Promise<AdvisoryMatch> {
  const records = await packageRecords(advisoryId, { offline: opts.offline });
  const base: AdvisoryMatch = {
    advisoryIds: [],
    cweIds: [],
    verdict: "no-data",
    packages: [],
    symbols: [],
    symbolSource: "none",
    hits: [],
    notes: [],
  };
  if (records.length === 0) {
    base.notes.push(
      opts.offline
        ? `No advisory data for ${advisoryId} in the local OSV cache (offline). Dependency exposure not checked.`
        : `No package data for ${advisoryId} on api.osv.dev. Dependency exposure not checked.`,
    );
    return base;
  }

  const deps = readDependencies(root);
  const primary: OsvRecord = records[0]!;
  const match: AdvisoryMatch = {
    ...base,
    advisoryIds: records.map((r) => r.id),
    summary: primary.summary,
    cweIds: [...new Set(records.flatMap((r) => r.database_specific?.cwe_ids ?? []))],
  };

  const affectedPkgs: Array<{ a: OsvAffected; rec: OsvRecord; dep: Dependency }> = [];
  for (const rec of records) {
    for (const a of rec.affected ?? []) {
      const eco = a.package?.ecosystem;
      if (!eco || !a.package?.name) continue;
      for (const dep of deps.filter((d) => samePackage(eco, a.package!.name, d))) {
        const hit = isAffected(a, dep.version);
        const already = match.packages.find((p) => p.name === dep.name && p.file === dep.file && p.installed === dep.version);
        if (already) {
          already.affected ||= hit;
          continue;
        }
        match.packages.push({
          ecosystem: eco,
          name: dep.name,
          installed: dep.version,
          file: dep.file,
          line: dep.line,
          exact: dep.exact,
          affected: hit,
          fixed: fixedVersionFor(eco, dep.version, a.ranges ?? []),
        });
        if (hit) affectedPkgs.push({ a, rec, dep });
      }
    }
  }

  if (match.packages.length === 0) {
    match.verdict = "not-used";
    const names = [...new Set(records.flatMap((r) => (r.affected ?? []).map((a) => a.package?.name).filter(Boolean)))];
    match.notes.push(`None of the affected packages (${names.slice(0, 6).join(", ")}) appear in this repo's lockfiles or manifests.`);
    return match;
  }
  if (affectedPkgs.length === 0) {
    match.verdict = "not-affected";
    for (const p of match.packages) match.notes.push(`${p.name}@${p.installed} (${p.file}) is outside the affected ranges.`);
    return match;
  }
  match.verdict = affectedPkgs.some((x) => x.dep.exact) ? "affected" : "possibly-affected";

  // Symbols + usages per affected package
  const files = walkSourceFiles(root).files;
  const seenHit = new Set<string>();
  const syms = await vulnerableSymbols(records, { offline: opts.offline });
  match.symbols = [...syms.names];
  match.symbolSource = syms.source;
  for (const { a, rec, dep } of affectedPkgs) {
    const fixed = fixedVersionFor(a.package!.ecosystem, dep.version, a.ranges ?? []);
    const pin = `${dep.name}@${dep.version}`;
    const fixNote = fixed ? ` Upgrade to ${fixed} or later.` : "";

    const manifestKey = `${dep.file}:${dep.line}`;
    if (!seenHit.has(manifestKey)) {
      seenHit.add(manifestKey);
      const text = fs.readFileSync(path.join(root, dep.file), "utf8");
      match.hits.push({
        ruleId: "advisory/vulnerable-dependency",
        filePath: dep.file,
        startLine: dep.line,
        endLine: dep.line,
        title: `Vulnerable dependency ${pin}`,
        note: `${pin} is affected by ${rec.id}${dep.exact ? "" : " (declared version; no lockfile pin found)"}.${fixNote}`,
        excerpt: excerpt(text, dep.line),
        score: dep.exact ? 80 : 65,
      });
    }

    const goPaths = (a.ecosystem_specific?.imports ?? []).map((i) => i.path);
    for (const f of files) {
      let text: string;
      try {
        text = fs.readFileSync(f.absPath, "utf8");
      } catch {
        continue;
      }
      const b = importsOf(a.package!.ecosystem, a.package!.name, goPaths, text);
      if (!b) continue;
      const calls = syms.names.size ? callSites(a.package!.ecosystem, text, b, syms.names) : [];
      if (calls.length) {
        for (const c of calls.slice(0, 5)) {
          const key = `${f.relPath}:${c.line}`;
          if (seenHit.has(key)) continue;
          seenHit.add(key);
          match.hits.push({
            ruleId: "advisory/vulnerable-call",
            filePath: f.relPath,
            startLine: c.line,
            endLine: c.line,
            title: `Calls \`${c.symbol}\` from ${pin}`,
            note: `\`${c.symbol}\` is the vulnerable function named by ${rec.id} (${syms.source}).${fixNote}`,
            excerpt: excerpt(text, c.line),
            score: dep.exact ? 95 : 75,
          });
        }
      } else {
        const key = `${f.relPath}:${b.line}`;
        if (seenHit.has(key)) continue;
        seenHit.add(key);
        match.hits.push({
          ruleId: "advisory/imports-vulnerable-package",
          filePath: f.relPath,
          startLine: b.line,
          endLine: b.line,
          title: `Imports ${pin}`,
          note: syms.names.size
            ? `Imports the affected package; no call to ${[...syms.names].slice(0, 4).map((s) => `\`${s}\``).join(", ")} found here.`
            : `Imports the affected package (${rec.id} names no specific function).${fixNote}`,
          excerpt: excerpt(text, b.line),
          score: syms.names.size ? (dep.exact ? 55 : 45) : dep.exact ? 78 : 60,
        });
      }
    }
  }
  match.hits.sort((x, y) => y.score - x.score || x.filePath.localeCompare(y.filePath));
  match.packages.sort((x, y) => x.name.localeCompare(y.name) || compareVersions(x.ecosystem, x.installed, y.installed));
  return match;
}
