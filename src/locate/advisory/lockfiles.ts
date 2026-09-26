/**
 * Installed / declared dependency versions from lockfiles and manifests.
 * Lockfiles give exact versions; manifests without a lockfile give declared
 * versions only (reported as such).
 */

import fs from "node:fs";
import path from "node:path";

export interface Dependency {
  ecosystem: "npm" | "PyPI" | "Go" | "Maven";
  /** Package name as OSV spells it (npm name, normalized PyPI name, Go module, Maven group:artifact). */
  name: string;
  version: string;
  /** Repo-relative file that pins it. */
  file: string;
  line: number;
  /** true when read from a lockfile / exact pin; false for a declared range. */
  exact: boolean;
}

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", "vendor", ".venv", "venv", "__pycache__", "target", ".next", "coverage"]);
const MAX_DEPTH = 6;

/** PEP 503 normalization: PyYAML → pyyaml, zope_interface → zope-interface. */
export function normalizePyPI(name: string): string {
  return name.toLowerCase().replace(/[-_.]+/g, "-");
}

function lineOf(text: string, index: number): number {
  return index < 0 ? 1 : text.slice(0, index).split("\n").length;
}

function findManifests(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string, depth: number) => {
    if (depth > MAX_DEPTH) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name) && !e.name.startsWith(".")) walk(path.join(dir, e.name), depth + 1);
      } else if (
        /^(?:package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml|package\.json|requirements[\w.-]*\.txt|poetry\.lock|Pipfile\.lock|uv\.lock|go\.mod|pom\.xml|gradle\.lockfile|build\.gradle(?:\.kts)?)$/.test(e.name)
      ) {
        out.push(path.join(dir, e.name));
      }
    }
  };
  walk(root, 0);
  return out;
}

function parsePackageLock(text: string, file: string): Dependency[] {
  const out: Dependency[] = [];
  let json: { packages?: Record<string, { version?: string }>; dependencies?: Record<string, unknown> };
  try {
    json = JSON.parse(text);
  } catch {
    return out;
  }
  if (json.packages) {
    for (const [key, v] of Object.entries(json.packages)) {
      if (!key || !v?.version) continue;
      const name = key.slice(key.lastIndexOf("node_modules/") + "node_modules/".length);
      out.push({ ecosystem: "npm", name, version: v.version, file, line: lineOf(text, text.indexOf(`"${key}"`)), exact: true });
    }
  } else if (json.dependencies) {
    const walk = (deps: Record<string, unknown>) => {
      for (const [name, raw] of Object.entries(deps)) {
        const v = raw as { version?: string; dependencies?: Record<string, unknown> };
        if (v?.version) out.push({ ecosystem: "npm", name, version: v.version, file, line: lineOf(text, text.indexOf(`"${name}"`)), exact: true });
        if (v?.dependencies) walk(v.dependencies);
      }
    };
    walk(json.dependencies);
  }
  return out;
}

function parseYarnLock(text: string, file: string): Dependency[] {
  const out: Dependency[] = [];
  // v1: `lodash@^4.17.15:` / `"@scope/x@^1", "@scope/x@^1.2":` then `  version "4.17.15"`
  // berry: `"lodash@npm:^4.17.15":` then `  version: 4.17.15`
  const re = /^"?((?:@[^@\s"/]+\/)?[^@\s",]+)@[^\n]*:\n(?:[ \t]+[^\n]*\n)*?[ \t]+version:?\s+"?([^"\s]+)"?/gm;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    out.push({ ecosystem: "npm", name: m[1]!, version: m[2]!, file, line: lineOf(text, m.index), exact: true });
  }
  return out;
}

function parsePnpmLock(text: string, file: string): Dependency[] {
  const out: Dependency[] = [];
  // `  /lodash@4.17.15:` (v6) · `  lodash@4.17.15:` (v9) · `  /lodash/4.17.15:` (v5)
  const re = /^ {2}'?\/?((?:@[^@/\s']+\/)?[^@/\s':]+)[@/](\d[^:(\s']*)/gm;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    out.push({ ecosystem: "npm", name: m[1]!, version: m[2]!, file, line: lineOf(text, m.index), exact: true });
  }
  return out;
}

function parsePackageJson(text: string, file: string): Dependency[] {
  const out: Dependency[] = [];
  let json: Record<string, Record<string, string> | undefined>;
  try {
    json = JSON.parse(text);
  } catch {
    return out;
  }
  for (const section of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
    for (const [name, range] of Object.entries(json[section] ?? {})) {
      const m = /(\d+\.\d+(?:\.\d+)?(?:-[\w.]+)?)/.exec(String(range));
      if (!m) continue;
      out.push({ ecosystem: "npm", name, version: m[1]!, file, line: lineOf(text, text.indexOf(`"${name}"`)), exact: /^\d/.test(String(range)) });
    }
  }
  return out;
}

function parseRequirements(text: string, file: string): Dependency[] {
  const out: Dependency[] = [];
  text.split("\n").forEach((raw, i) => {
    const line = raw.split("#")[0]!.trim();
    const m = /^([A-Za-z0-9][A-Za-z0-9._-]*)(?:\[[^\]]*\])?\s*(==|===|>=|~=|<=)\s*([0-9][^\s,;]*)/.exec(line);
    if (m) out.push({ ecosystem: "PyPI", name: normalizePyPI(m[1]!), version: m[3]!, file, line: i + 1, exact: m[2] === "==" || m[2] === "===" });
  });
  return out;
}

function parseTomlPackages(text: string, file: string): Dependency[] {
  // poetry.lock / uv.lock: [[package]] name = "x" version = "y"
  const out: Dependency[] = [];
  const re = /\[\[package\]\]\s*\nname\s*=\s*"([^"]+)"\s*\nversion\s*=\s*"([^"]+)"/g;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    out.push({ ecosystem: "PyPI", name: normalizePyPI(m[1]!), version: m[2]!, file, line: lineOf(text, m.index), exact: true });
  }
  return out;
}

function parsePipfileLock(text: string, file: string): Dependency[] {
  const out: Dependency[] = [];
  let json: Record<string, Record<string, { version?: string }> | undefined>;
  try {
    json = JSON.parse(text);
  } catch {
    return out;
  }
  for (const section of ["default", "develop"]) {
    for (const [name, v] of Object.entries(json[section] ?? {})) {
      const ver = v?.version?.replace(/^==/, "");
      if (ver) out.push({ ecosystem: "PyPI", name: normalizePyPI(name), version: ver, file, line: lineOf(text, text.indexOf(`"${name}"`)), exact: true });
    }
  }
  return out;
}

function parseGoMod(text: string, file: string): Dependency[] {
  const out: Dependency[] = [];
  const lines = text.split("\n");
  let inBlock = false;
  lines.forEach((raw, i) => {
    const line = raw.replace(/\/\/.*$/, "").trim();
    if (/^require\s*\($/.test(line)) return void (inBlock = true);
    if (inBlock && line === ")") return void (inBlock = false);
    const m = (inBlock ? /^(\S+)\s+(v\S+)/ : /^require\s+(\S+)\s+(v\S+)/).exec(line);
    if (m) out.push({ ecosystem: "Go", name: m[1]!, version: m[2]!.replace(/^v/, ""), file, line: i + 1, exact: true });
    // The Go toolchain version gates standard-library advisories.
    const g = /^(?:toolchain\s+go|go\s+)(\d+\.\d+(?:\.\d+)?)/.exec(line);
    if (g) out.push({ ecosystem: "Go", name: "stdlib", version: g[1]!, file, line: i + 1, exact: /^toolchain/.test(line) });
  });
  return out;
}

function parsePom(text: string, file: string): Dependency[] {
  const out: Dependency[] = [];
  const props = new Map<string, string>();
  const propsBlock = /<properties>([\s\S]*?)<\/properties>/.exec(text)?.[1] ?? "";
  for (const m of propsBlock.matchAll(/<([\w.-]+)>([^<]+)<\/\1>/g)) props.set(m[1]!, m[2]!.trim());
  const re = /<dependency>([\s\S]*?)<\/dependency>/g;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const body = m[1]!;
    const g = /<groupId>([^<]+)<\/groupId>/.exec(body)?.[1]?.trim();
    const a = /<artifactId>([^<]+)<\/artifactId>/.exec(body)?.[1]?.trim();
    let v = /<version>([^<]+)<\/version>/.exec(body)?.[1]?.trim();
    if (!g || !a || !v) continue;
    v = v.replace(/\$\{([^}]+)\}/g, (_, k: string) => props.get(k) ?? `\${${k}}`);
    if (v.includes("${")) continue;
    out.push({ ecosystem: "Maven", name: `${g}:${a}`, version: v, file, line: lineOf(text, m.index), exact: true });
  }
  return out;
}

function parseGradle(text: string, file: string, lock: boolean): Dependency[] {
  const out: Dependency[] = [];
  const re = lock ? /^([\w.-]+):([\w.-]+):([^=\s]+)=/gm : /['"]([\w.-]+):([\w.-]+):([\w.+-]+)['"]/g;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    out.push({ ecosystem: "Maven", name: `${m[1]}:${m[2]}`, version: m[3]!, file, line: lineOf(text, m.index), exact: lock || !/[+]/.test(m[3]!) });
  }
  return out;
}

/** All dependencies found under `root` (lockfiles preferred over manifests). */
export function readDependencies(root: string): Dependency[] {
  const deps: Dependency[] = [];
  for (const abs of findManifests(root)) {
    let text: string;
    try {
      text = fs.readFileSync(abs, "utf8");
    } catch {
      continue;
    }
    const file = path.relative(root, abs).split(path.sep).join("/");
    const base = path.basename(abs);
    if (base === "package-lock.json" || base === "npm-shrinkwrap.json") deps.push(...parsePackageLock(text, file));
    else if (base === "yarn.lock") deps.push(...parseYarnLock(text, file));
    else if (base === "pnpm-lock.yaml") deps.push(...parsePnpmLock(text, file));
    else if (base === "package.json") deps.push(...parsePackageJson(text, file));
    else if (base.startsWith("requirements")) deps.push(...parseRequirements(text, file));
    else if (base === "poetry.lock" || base === "uv.lock") deps.push(...parseTomlPackages(text, file));
    else if (base === "Pipfile.lock") deps.push(...parsePipfileLock(text, file));
    else if (base === "go.mod") deps.push(...parseGoMod(text, file));
    else if (base === "pom.xml") deps.push(...parsePom(text, file));
    else if (base === "gradle.lockfile") deps.push(...parseGradle(text, file, true));
    else if (base.startsWith("build.gradle")) deps.push(...parseGradle(text, file, false));
  }
  // Exact pins beat declared ranges for the same package in the same directory.
  const exactKeys = new Set(deps.filter((d) => d.exact).map((d) => `${d.ecosystem}|${d.name}|${path.dirname(d.file)}`));
  return deps.filter((d) => d.exact || !exactKeys.has(`${d.ecosystem}|${d.name}|${path.dirname(d.file)}`));
}
