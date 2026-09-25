/**
 * Accuracy benchmark for the `locate --rules` engine.
 *
 * Suites (third-party, GPL — downloaded on demand into .cache/benchmarks, never committed):
 *   owasp-java    OWASP Benchmark for Java    https://github.com/OWASP-Benchmark/BenchmarkJava
 *   owasp-python  OWASP Benchmark for Python  https://github.com/OWASP-Benchmark/BenchmarkPython
 * Suite (in repo, maintainer-written):
 *   corpus        bench/corpus/<CWE>/<lang>/{vuln,safe}-*.{js,ts,py,java,go}
 *
 * Usage:
 *   npm run bench                          # all suites (downloads OWASP suites if missing)
 *   npm run bench -- --suite corpus        # one suite
 *   npm run bench -- --json out.json       # also write machine-readable results
 *   npm run bench -- --markdown out.md     # also write a markdown table
 *   npm run bench -- --min-score 85        # count only request-input findings (high confidence)
 *
 * A test case counts as flagged when the engine reports ≥1 hit for the case's CWE.
 * Score = TPR − FPR (Youden's J, the OWASP Benchmark metric): 0 = no better than
 * flagging everything or nothing; 100 = perfect.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeSource } from "../src/locate/engine/analyze.ts";
import { langForPath } from "../src/locate/engine/grammar.ts";
import { RULES_SUPPORTED_CWES } from "../src/locate/rules/index.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cacheDir = path.join(root, ".cache", "benchmarks");

interface Case {
  file: string;
  cwe: string;
  vulnerable: boolean;
}

interface Suite {
  id: string;
  name: string;
  language: string;
  source: string;
  license: string;
  cases: () => Case[];
}

function ensureClone(repo: string): string {
  const dir = path.join(cacheDir, repo.split("/")[1]!);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
    console.error(`Downloading ${repo} → ${path.relative(root, dir)} …`);
    execFileSync("git", ["clone", "--quiet", "--depth", "1", `https://github.com/${repo}.git`, dir], {
      stdio: "inherit",
    });
  }
  return dir;
}

function commitOf(dir: string): string {
  try {
    return execFileSync("git", ["-C", dir, "rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function owaspCases(dir: string, codeDir: string, ext: string): Case[] {
  const csv = fs.readdirSync(dir).find((f) => /^expectedresults-.*\.csv$/.test(f));
  if (!csv) throw new Error(`No expectedresults-*.csv in ${dir}`);
  const supported = new Set<string>(RULES_SUPPORTED_CWES);
  const cases: Case[] = [];
  for (const line of fs.readFileSync(path.join(dir, csv), "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const [name, , real, cwe] = line.split(",");
    const cweId = `CWE-${cwe?.trim()}`;
    if (!name || !supported.has(cweId)) continue;
    cases.push({ file: path.join(dir, codeDir, `${name.trim()}${ext}`), cwe: cweId, vulnerable: real?.trim() === "true" });
  }
  return cases;
}

const SUITES: Suite[] = [
  {
    id: "owasp-java",
    name: "OWASP Benchmark (Java)",
    language: "Java",
    source: "OWASP-Benchmark/BenchmarkJava",
    license: "GPL-2.0 (downloaded, not redistributed)",
    cases: () =>
      owaspCases(ensureClone("OWASP-Benchmark/BenchmarkJava"), "src/main/java/org/owasp/benchmark/testcode", ".java"),
  },
  {
    id: "owasp-python",
    name: "OWASP Benchmark (Python)",
    language: "Python",
    source: "OWASP-Benchmark/BenchmarkPython",
    license: "GPL-3.0 (downloaded, not redistributed)",
    cases: () => owaspCases(ensureClone("OWASP-Benchmark/BenchmarkPython"), "testcode", ".py"),
  },
  {
    id: "corpus",
    name: "ZERODAY corpus (maintainer-written)",
    language: "JS/TS, Python, Java, Go",
    source: "bench/corpus",
    license: "Apache-2.0 (this repo)",
    cases: () => {
      const base = path.join(root, "bench", "corpus");
      const cases: Case[] = [];
      if (!fs.existsSync(base)) return cases;
      for (const cwe of fs.readdirSync(base)) {
        for (const lang of fs.readdirSync(path.join(base, cwe))) {
          for (const f of fs.readdirSync(path.join(base, cwe, lang))) {
            const m = /^(vuln|safe)-/.exec(f);
            if (!m) continue;
            cases.push({ file: path.join(base, cwe, lang, f), cwe, vulnerable: m[1] === "vuln" });
          }
        }
      }
      return cases;
    },
  },
];

interface Row {
  suite: string;
  cwe: string;
  tp: number;
  fp: number;
  tn: number;
  fn: number;
}

const pct = (n: number, d: number) => (d === 0 ? 0 : Math.round((1000 * n) / d) / 10);

export function metrics(r: Row) {
  const tpr = pct(r.tp, r.tp + r.fn);
  const fpr = pct(r.fp, r.fp + r.tn);
  return {
    cases: r.tp + r.fp + r.tn + r.fn,
    precision: pct(r.tp, r.tp + r.fp),
    recall: tpr,
    fpr,
    score: Math.round((tpr - fpr) * 10) / 10,
  };
}

async function runSuite(suite: Suite, minScore: number): Promise<{ rows: Row[]; misses: string[]; version: string }> {
  const cases = suite.cases();
  const rows = new Map<string, Row>();
  const misses: string[] = [];
  for (const c of cases) {
    const lang = langForPath(c.file);
    if (!lang || !fs.existsSync(c.file)) continue;
    const hits = await analyzeSource(lang, fs.readFileSync(c.file, "utf8"), new Set([c.cwe]));
    const flagged = hits.some((h) => h.cwe === c.cwe && h.score >= minScore);
    const row = rows.get(c.cwe) ?? { suite: suite.id, cwe: c.cwe, tp: 0, fp: 0, tn: 0, fn: 0 };
    if (c.vulnerable && flagged) row.tp++;
    else if (c.vulnerable) {
      row.fn++;
      misses.push(`FN ${c.cwe} ${path.relative(root, c.file)}`);
    } else if (flagged) {
      row.fp++;
      misses.push(`FP ${c.cwe} ${path.relative(root, c.file)}`);
    } else row.tn++;
    rows.set(c.cwe, row);
  }
  const version = suite.id === "corpus" ? "in-repo" : commitOf(path.join(cacheDir, suite.source.split("/")[1]!));
  const sorted = [...rows.values()].sort((a, b) => Number(a.cwe.slice(4)) - Number(b.cwe.slice(4)));
  return { rows: sorted, misses, version };
}

function markdown(results: Array<{ suite: Suite; rows: Row[]; version: string }>): string {
  const out: string[] = [];
  for (const { suite, rows, version } of results) {
    out.push(`### ${suite.name}`);
    out.push("");
    out.push(`Source: \`${suite.source}\` @ \`${version}\` · ${suite.license}`);
    out.push("");
    out.push("| CWE | Cases | Precision | Recall (TPR) | False-positive rate | Score (TPR − FPR) |");
    out.push("|-----|------:|----------:|-------------:|--------------------:|------------------:|");
    const total: Row = { suite: suite.id, cwe: "All", tp: 0, fp: 0, tn: 0, fn: 0 };
    for (const r of rows) {
      const m = metrics(r);
      out.push(`| ${r.cwe} | ${m.cases} | ${m.precision}% | ${m.recall}% | ${m.fpr}% | **${m.score}** |`);
      total.tp += r.tp;
      total.fp += r.fp;
      total.tn += r.tn;
      total.fn += r.fn;
    }
    const m = metrics(total);
    out.push(`| **All** | ${m.cases} | ${m.precision}% | ${m.recall}% | ${m.fpr}% | **${m.score}** |`);
    out.push("");
  }
  return out.join("\n");
}

async function main() {
  const args = process.argv.slice(2);
  const opt = (name: string) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const only = opt("--suite");
  const suites = SUITES.filter((s) => !only || s.id === only);
  if (suites.length === 0) throw new Error(`Unknown suite ${only}; choose ${SUITES.map((s) => s.id).join(", ")}`);

  const results = [];
  for (const suite of suites) {
    const started = Date.now();
    const r = await runSuite(suite, Number(opt("--min-score") ?? 0));
    results.push({ suite, ...r });
    console.error(`${suite.id}: ${r.rows.reduce((n, x) => n + x.tp + x.fp + x.tn + x.fn, 0)} cases in ${((Date.now() - started) / 1000).toFixed(1)}s`);
    if (args.includes("--misses")) for (const m of r.misses) console.error(`  ${m}`);
  }

  const md = markdown(results);
  console.log(md);
  const mdPath = opt("--markdown");
  if (mdPath) fs.writeFileSync(mdPath, md + "\n");
  const jsonPath = opt("--json");
  if (jsonPath) {
    fs.writeFileSync(
      jsonPath,
      JSON.stringify(
        {
          schemaVersion: "zeroday-bench/v1",
          generatedAt: new Date().toISOString(),
          suites: results.map(({ suite, rows, version }) => ({
            id: suite.id,
            name: suite.name,
            source: suite.source,
            version,
            rows: rows.map((r) => ({ ...r, ...metrics(r) })),
          })),
        },
        null,
        2,
      ) + "\n",
    );
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
