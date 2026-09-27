/**
 * Version comparison per ecosystem + OSV range evaluation.
 * https://ossf.github.io/osv-schema/#affectedranges-field
 */

export type Ecosystem = "npm" | "PyPI" | "Go" | "Maven" | "crates.io" | "RubyGems" | "NuGet" | "Packagist";

type Part = number | string;

/** SemVer 2.0 (npm, Go, crates.io): pre-release sorts before release. */
function parseSemver(v: string): { nums: number[]; pre: Part[] } {
  const clean = v.trim().replace(/^v/, "").split("+")[0]!;
  const dash = clean.indexOf("-");
  const core = dash >= 0 ? clean.slice(0, dash) : clean;
  const pre = dash >= 0 ? clean.slice(dash + 1) : "";
  const nums = core.split(".").map((x) => Number.parseInt(x, 10) || 0);
  while (nums.length < 3) nums.push(0);
  return { nums, pre: pre ? pre.split(".").map((x) => (/^\d+$/.test(x) ? Number(x) : x)) : [] };
}

function cmpParts(a: Part[], b: Part[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i];
    const y = b[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    if (typeof x === "number" && typeof y === "number") {
      if (x !== y) return x < y ? -1 : 1;
    } else if (typeof x === "number") return -1;
    else if (typeof y === "number") return 1;
    else if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

function cmpSemver(a: string, b: string): number {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  for (let i = 0; i < Math.max(pa.nums.length, pb.nums.length); i++) {
    const d = (pa.nums[i] ?? 0) - (pb.nums[i] ?? 0);
    if (d) return d < 0 ? -1 : 1;
  }
  if (!pa.pre.length && !pb.pre.length) return 0;
  if (!pa.pre.length) return 1;
  if (!pb.pre.length) return -1;
  return cmpParts(pa.pre, pb.pre);
}

/** PEP 440 (simplified): release, then a < b < rc < final < post; dev sorts first. */
function pep440Key(v: string): number[] {
  const m = /^v?(\d+(?:\.\d+)*)(?:[-_.]?(a|alpha|b|beta|c|rc|pre|preview)[-_.]?(\d*))?(?:[-_.]?(?:post|rev|r)[-_.]?(\d*))?(?:[-_.]?dev[-_.]?(\d*))?/i.exec(v.trim().toLowerCase());
  if (!m) return [0];
  const release = m[1]!.split(".").map(Number);
  while (release.length < 4) release.push(0);
  const preRank = m[2] ? ({ a: 1, alpha: 1, b: 2, beta: 2, c: 3, rc: 3, pre: 3, preview: 3 } as Record<string, number>)[m[2]]! : m[5] !== undefined ? 0 : 4;
  const preNum = m[2] ? Number(m[3] || 0) : 0;
  const post = m[4] !== undefined ? Number(m[4] || 0) + 1 : 0;
  const dev = m[5] !== undefined ? Number(m[5] || 0) : Number.MAX_SAFE_INTEGER;
  return [...release, preRank, preNum, post, dev];
}

/** Maven ComparableVersion (simplified): alpha < beta < milestone < rc < snapshot < release < sp. */
function mavenKey(v: string): Part[] {
  const rank: Record<string, number> = { alpha: -5, a: -5, beta: -4, b: -4, milestone: -3, m: -3, rc: -2, cr: -2, snapshot: -1, "": 0, ga: 0, final: 0, release: 0, sp: 1 };
  const out: Part[] = [];
  for (const tok of v.trim().toLowerCase().split(/[.-]|(?<=\d)(?=[a-z])|(?<=[a-z])(?=\d)/)) {
    if (tok === "") continue;
    if (/^\d+$/.test(tok)) out.push(Number(tok));
    else out.push(tok in rank ? rank[tok]! - 10 : tok);
  }
  while (out.length && out[out.length - 1] === 0) out.pop();
  return out;
}

export function compareVersions(eco: string, a: string, b: string): number {
  if (a === b) return 0;
  if (eco === "PyPI") {
    return cmpParts(pep440Key(a), pep440Key(b));
  }
  if (eco === "Maven") {
    const ka = mavenKey(a);
    const kb = mavenKey(b);
    // Missing trailing parts count as 0 (release): 2.15 == 2.15.0, 2.15-rc1 < 2.15.
    for (let i = 0; i < Math.max(ka.length, kb.length); i++) {
      const x = ka[i] ?? 0;
      const y = kb[i] ?? 0;
      const c = cmpParts([x], [y]);
      if (c) return c;
    }
    return 0;
  }
  return cmpSemver(a, b);
}

export interface OsvEvent {
  introduced?: string;
  fixed?: string;
  last_affected?: string;
  limit?: string;
}

export interface OsvRange {
  type: "SEMVER" | "ECOSYSTEM" | "GIT";
  events: OsvEvent[];
}

/** Is `version` inside an OSV SEMVER / ECOSYSTEM range? */
export function inRange(eco: string, version: string, range: OsvRange): boolean {
  if (range.type === "GIT") return false;
  const key = (e: OsvEvent) => e.introduced ?? e.fixed ?? e.last_affected ?? e.limit ?? "0";
  const sorted = [...range.events].sort((x, y) => {
    const kx = key(x);
    const ky = key(y);
    if (kx === "0") return -1;
    if (ky === "0") return 1;
    return compareVersions(eco, kx, ky);
  });
  let affected = false;
  for (const e of sorted) {
    if (e.introduced !== undefined) {
      if (e.introduced === "0" || compareVersions(eco, version, e.introduced) >= 0) affected = true;
    } else if (e.fixed !== undefined) {
      if (compareVersions(eco, version, e.fixed) >= 0) affected = false;
    } else if (e.last_affected !== undefined) {
      if (compareVersions(eco, version, e.last_affected) > 0) affected = false;
    } else if (e.limit !== undefined) {
      if (compareVersions(eco, version, e.limit) >= 0) affected = false;
    }
  }
  return affected;
}

/** Lowest `fixed` version above `version` in the ranges (the version to upgrade to). */
export function fixedVersionFor(eco: string, version: string, ranges: OsvRange[]): string | undefined {
  const fixes = ranges
    .flatMap((r) => r.events.map((e) => e.fixed))
    .filter((f): f is string => !!f && compareVersions(eco, f, version) > 0)
    .sort((a, b) => compareVersions(eco, a, b));
  return fixes[0];
}
