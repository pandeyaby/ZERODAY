/**
 * Curate the Linux kernel localization benchmark (bench/kernel/manifest.json)
 * from public data only:
 *   - kernel CNA records: security/vulns.git (mainline fix sha per CVE)
 *   - the fix commit on git.kernel.org (Fixes: trailer, changed files, parent)
 *   - CWE from the CVE record's ADP container, else NVD
 *
 * An entry qualifies when the mainline fix has exactly one Fixes: trailer, a
 * single parent, changes exactly one .c file, and every changed line sits in
 * one or two C functions of the pre-fix file. Ground-truth functions come from
 * the same extractor the scorer uses (src/locate/c-functions.ts). The fix diff
 * is read here only to derive ground truth; it is never stored or sent to a model.
 *
 * Fixes authored on or before --after (default 2025-04-10, the Antares-1B
 * training-data cutoff per its model card) are skipped, so the model cannot
 * have seen the labelled fix.
 *
 *   npx tsx scripts/bench-kernel-curate.ts [--years 2025,2026] [--stride 23] [--target 24] [--after 2025-04-10]
 */

import fs from "node:fs";
import path from "node:path";
import { extractCFunctions, enclosingCFunction } from "../src/locate/c-functions";

const ROOT = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
const flag = (name: string, dflt: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1]! : dflt;
};
const YEARS = flag("--years", "2025,2026").split(",").map((y) => y.trim());
const STRIDE = Number(flag("--stride", "23"));
const AFTER = flag("--after", "2025-04-10");
const TARGET = Number(flag("--target", "24"));
const OUT = path.resolve(flag("--out", path.join(ROOT, "bench/kernel/manifest.json")));

const VULNS = "https://git.kernel.org/pub/scm/linux/security/vulns.git";
const LINUX = "https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git";
const SKIP_TOP = /^(?:tools|samples|scripts|Documentation|usr)\//;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function get(url: string, tries = 3): Promise<string> {
  for (let t = 1; ; t++) {
    try {
      const res = await fetch(url, { headers: { "user-agent": "zeroday-bench-curate" } });
      if (res.ok) return await res.text();
      if (res.status === 404) throw new Error(`404 ${url}`);
      throw new Error(`${res.status} ${url}`);
    } catch (e) {
      if (t >= tries || String(e).includes("404")) throw e;
      await sleep(3000 * t);
    }
  }
}

let lastNvd = 0;
async function cweFor(cve: string): Promise<{ cwe: string; source: string } | null> {
  const rec = JSON.parse(await get(`https://cveawg.mitre.org/api/cve/${cve}`));
  for (const adp of rec.containers?.adp ?? []) {
    for (const pt of adp.problemTypes ?? []) {
      for (const d of pt.descriptions ?? []) {
        const m = /^CWE-\d+$/.exec(d.cweId ?? "") ?? /^(CWE-\d+)\b/.exec(d.description ?? "");
        if (m) return { cwe: m[1] ?? m[0], source: "cve-adp" };
      }
    }
  }
  const wait = lastNvd + 6500 - Date.now(); // NVD public rate limit: 5 requests / 30 s
  if (wait > 0) await sleep(wait);
  lastNvd = Date.now();
  const nvd = JSON.parse(await get(`https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=${cve}`));
  for (const w of nvd.vulnerabilities?.[0]?.cve?.weaknesses ?? []) {
    for (const d of w.description ?? []) if (/^CWE-\d+$/.test(d.value)) return { cwe: d.value, source: "nvd" };
  }
  return null;
}

/** Pre-fix line numbers the fix touches (removed lines; insertion points for added lines). */
function touchedOldLines(diff: string): number[] {
  const lines: number[] = [];
  let old = 0;
  let start = 0;
  for (const l of diff.split("\n")) {
    if (l === "-- ") break; // mail signature after the last hunk
    const h = /^@@ -(\d+)(?:,\d+)? \+\d+(?:,\d+)? @@/.exec(l);
    if (h) {
      old = start = Number(h[1]);
      continue;
    }
    if (!old) continue;
    if (l.startsWith("-") && !l.startsWith("---")) lines.push(old++);
    else if (l.startsWith("+") && !l.startsWith("+++")) lines.push(Math.max(start, old - 1));
    else if (l.startsWith(" ")) old++;
  }
  return lines;
}

interface Entry {
  cve: string;
  cwe: string;
  cweSource: string;
  description: string;
  fixCommit: string;
  fixDate: string;
  fixesCommit: string;
  parentCommit: string;
  file: string;
  functions: string[];
  scope: string;
}

async function inspect(cve: string): Promise<Entry | string> {
  const fix = (await get(`${VULNS}/plain/cve/published/${cve.split("-")[1]}/${cve}.sha1`)).trim().split(/\s+/)[0]!;
  if (!/^[0-9a-f]{40}$/.test(fix)) return "no mainline sha";
  const patch = await get(`${LINUX}/patch/?id=${fix}`);
  const fixes = [...new Set([...patch.matchAll(/^Fixes:\s*([0-9a-f]{8,40})\b/gim)].map((m) => m[1]!.toLowerCase()))];
  const date = new Date(/^Date: (.*)$/m.exec(patch)?.[1] ?? "");
  if (Number.isNaN(date.getTime())) return "no Date: header";
  if (date <= new Date(`${AFTER}T23:59:59Z`)) return `fix authored on or before ${AFTER}`;
  if (fixes.length !== 1) return `${fixes.length} Fixes: trailers`;
  const files = [...patch.matchAll(/^diff --git a\/(\S+) b\/(\S+)$/gm)].map((m) => m[2]!);
  if (files.length !== 1) return `${files.length} files changed`;
  const file = files[0]!;
  if (!file.endsWith(".c") || SKIP_TOP.test(file)) return `not a kernel .c file (${file})`;
  const page = await get(`${LINUX}/commit/?id=${fix}`);
  const parents = [...page.matchAll(/<th>parent<\/th><td[^>]*><a href='[^']*\?id=([0-9a-f]{40})'/g)].map((m) => m[1]!);
  if (parents.length !== 1) return `${parents.length} parents`;
  const parent = parents[0]!;
  const fixesPage = await get(`${LINUX}/commit/?id=${fixes[0]}`);
  const fixesFull = /<th>commit<\/th><td[^>]*><a href='[^']*\?id=([0-9a-f]{40})'/.exec(fixesPage)?.[1];
  if (!fixesFull) return "Fixes: sha not found in mainline";
  const pre = await get(`${LINUX}/plain/${file}?id=${parent}`);
  const fns = extractCFunctions(pre);
  const touched = touchedOldLines(patch.slice(patch.indexOf("diff --git")));
  if (!touched.length) return "no touched lines";
  const names = new Set<string>();
  for (const line of touched) {
    const fn = enclosingCFunction(fns, line);
    if (!fn) return `change outside a function (line ${line})`;
    names.add(fn.name);
  }
  if (names.size > 2) return `${names.size} functions changed`;
  const cwe = await cweFor(cve);
  if (!cwe) return "no CWE";
  const rec = JSON.parse(await get(`https://cveawg.mitre.org/api/cve/${cve}`));
  const title = String(rec.containers?.cna?.title ?? /^Subject: (.*)$/m.exec(patch)?.[1] ?? "").trim();
  return {
    cve,
    cwe: cwe.cwe,
    cweSource: cwe.source,
    description: title.slice(0, 160),
    fixCommit: fix,
    fixDate: date.toISOString().slice(0, 10),
    fixesCommit: fixesFull,
    parentCommit: parent,
    file,
    functions: [...names].sort(),
    scope: path.posix.dirname(file),
  };
}

async function main() {
  const found = new Set<string>();
  for (const year of YEARS) {
    const listing = await get(`${VULNS}/tree/cve/published/${year}`);
    for (const m of listing.matchAll(/(CVE-\d{4}-\d+)\.sha1/g)) found.add(m[1]!);
  }
  const ids = [...found].sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
  console.log(`${ids.length} published ${YEARS.join("+")} kernel CVEs; stride ${STRIDE}, target ${TARGET}`);
  const entries: Entry[] = [];
  const rejected: Record<string, number> = {};
  const scopes = new Set<string>();
  let examined = 0;
  for (let i = 0; i < ids.length && entries.length < TARGET; i += STRIDE) {
    const cve = ids[i]!;
    examined++;
    let r: Entry | string;
    try {
      r = await inspect(cve);
    } catch (e) {
      r = `fetch error: ${(e as Error).message.slice(0, 80)}`;
    }
    if (typeof r !== "string" && scopes.has(r.scope)) r = `duplicate scope ${r.scope}`;
    if (typeof r === "string") {
      const key = r.replace(/\(.*\)|\d+(?:-\d+)*/g, "#").replace(/https?:\S+/, "<url>").trim();
      rejected[key] = (rejected[key] ?? 0) + 1;
      console.log(`  - ${cve}: ${r}`);
    } else {
      entries.push(r);
      scopes.add(r.scope);
      console.log(`  + ${cve}: ${r.file} :: ${r.functions.join(", ")} (${r.cwe})`);
    }
    await sleep(500);
  }
  const manifest = {
    schema: "zeroday.kernel-bench.manifest/v1",
    source: "Linux kernel CNA (security/vulns.git) + torvalds/linux on git.kernel.org; CWE from CVE ADP or NVD",
    selection: {
      years: YEARS.map(Number),
      stride: STRIDE,
      fixAuthoredAfter: AFTER,
      target: TARGET,
      examined,
      rules: [
        "mainline fix commit from vulns.git <CVE>.sha1",
        `fix authored after ${AFTER} (Antares-1B training-data cutoff)`,
        "exactly one Fixes: trailer, resolvable in mainline",
        "single parent; exactly one changed file, a .c outside tools/ samples/ scripts/ Documentation/ usr/",
        "every changed line inside 1-2 functions of the pre-fix file (src/locate/c-functions.ts)",
        "a numeric CWE (CVE ADP container, else NVD)",
        "one entry per directory (scope)",
      ],
      rejected,
    },
    groundTruth: "file and function(s) changed by the fix; input tree = parent commit, limited to the files directly in `scope`",
    entries,
  };
  fs.writeFileSync(OUT, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`\n${entries.length} entries from ${examined} examined → ${path.relative(ROOT, OUT)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
