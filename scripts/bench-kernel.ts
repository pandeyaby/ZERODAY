/**
 * Linux kernel localization benchmark (bench/kernel/manifest.json).
 *
 *   npm run bench:kernel -- fetch                 # only the files of each entry's scope dir at the parent sha (no kernel clone)
 *   npm run bench:kernel -- run --arms rules      # keyless rules baseline (no GPU)
 *   npm run bench:kernel -- run --arms antares    # live Antares via ANTARES_ENDPOINT (GPU — operator only)
 *   npm run bench:kernel -- score --arm rules     # hit@1/3/5 on file and function
 *   options: --cves CVE-a,CVE-b · --out <dir> · --remote-inference · --model <id> · --tool-budget <n>
 *
 * Inputs per entry: the PRE-FIX tree (fix commit's parent, limited to the files
 * directly in the entry's `scope` directory), the CWE, and the public one-line description. The fix diff
 * is never fetched here and never sent to a model.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { locate } from "../src/locate/index";
import { rankedFromReport, scoreEntry, summarize, KS, type KernelEntry, type Summary } from "../bench/kernel/score";

const ROOT = path.resolve(__dirname, "..");
const [cmd = "help", ...args] = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const only = flag("--cves")?.split(",");
const outDir = path.resolve(flag("--out") ?? path.join(ROOT, "zeroday-reports/bench-kernel"));
const cacheDir = path.join(process.env.ZERODAY_CACHE_DIR ?? path.join(os.homedir(), ".cache", "zeroday"), "bench-kernel");
const plainBase = `${process.env.KERNEL_CGIT_URL ?? "https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git"}/plain`;
const treeApi = process.env.KERNEL_TREE_API ?? "https://api.github.com/repos/torvalds/linux/git/trees";
const manifestPath = path.resolve(flag("--manifest") ?? path.join(ROOT, "bench/kernel/manifest.json"));
const entries = (JSON.parse(fs.readFileSync(manifestPath, "utf8")) as { entries: KernelEntry[] }).entries.filter(
  (e) => !only || only.includes(e.cve),
);

const treeDir = (e: KernelEntry) => path.join(cacheDir, e.cve);

async function http(url: string, headers: Record<string, string> = {}, tries = 6): Promise<Buffer> {
  for (let t = 1; ; t++) {
    const res = await fetch(url, { headers: { "user-agent": "zeroday-bench-kernel", ...headers } }).catch((err: Error) => err);
    if (!(res instanceof Error) && res.ok) return Buffer.from(await res.arrayBuffer());
    if (t >= tries) throw new Error(`${res instanceof Error ? res.message : res.status} ${url}`);
    await new Promise((r) => setTimeout(r, 2000 * t));
  }
}

/** Git blob id of `content` — every downloaded file is checked against the tree listing. */
const blobSha = (content: Buffer) =>
  createHash("sha1").update(Buffer.concat([Buffer.from(`blob ${content.length}\0`), content])).digest("hex");

/**
 * The files directly in the entry's `scope` directory (not subdirectories) at the
 * parent commit, and nothing else: the file
 * list comes from the GitHub mirror's tree API (same commit ids as kernel.org;
 * GITHUB_TOKEN is used when set), each file from git.kernel.org, verified by blob id.
 */
async function fetchEntry(e: KernelEntry): Promise<string> {
  const dir = treeDir(e);
  const stamp = path.join(dir, ".zeroday-ready");
  if (fs.existsSync(stamp) && fs.readFileSync(stamp, "utf8") === e.parentCommit) return dir;
  fs.rmSync(dir, { recursive: true, force: true });
  const auth: Record<string, string> = process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {};
  const listing = JSON.parse(
    (await http(`${treeApi}/${e.parentCommit}:${e.scope}`, { accept: "application/vnd.github+json", ...auth })).toString("utf8"),
  ) as { truncated: boolean; tree: Array<{ path: string; type: string; sha: string }> };
  if (listing.truncated) throw new Error(`tree listing truncated for ${e.scope}`);
  const blobs = listing.tree.filter((t) => t.type === "blob" && !t.path.includes("/"));
  let next = 0;
  const worker = async () => {
    while (next < blobs.length) {
      const b = blobs[next++]!;
      const rel = `${e.scope}/${b.path}`;
      const content = await http(`${plainBase}/${rel}?id=${e.parentCommit}`);
      if (blobSha(content) !== b.sha) throw new Error(`blob mismatch for ${rel}`);
      fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
      fs.writeFileSync(path.join(dir, rel), content);
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  fs.writeFileSync(stamp, e.parentCommit);
  return dir;
}

async function run() {
  const arms = (flag("--arms") ?? "rules").split(",").map((a) => a.trim());
  const remoteInference = args.includes("--remote-inference") || process.env.ZERODAY_REMOTE_INFERENCE_ACK === "1";
  for (const arm of arms) {
    if (arm !== "rules" && arm !== "antares") throw new Error(`unknown arm ${arm} (rules | antares)`);
    for (const e of entries) {
      const repo = await fetchEntry(e);
      const outputDir = path.join(outDir, arm, e.cve);
      const t0 = Date.now();
      try {
        const { result } = await locate({
          repo,
          advisory: e.cwe,
          outputDir,
          offline: true,
          ...(arm === "rules"
            ? { rules: true }
            : {
                live: true,
                description: e.description,
                remoteInference,
                failOnIncomplete: false,
                ...(flag("--model") ? { model: flag("--model") } : {}),
                ...(flag("--tool-budget") ? { toolBudget: Number(flag("--tool-budget")) } : {}),
              }),
        });
        console.log(`${e.cve} ${arm}: ${result.rankedFiles.length} ranked file(s), ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      } catch (err) {
        fs.mkdirSync(outputDir, { recursive: true });
        fs.writeFileSync(path.join(outputDir, "error.txt"), String((err as Error).message));
        console.log(`${e.cve} ${arm}: ERROR ${(err as Error).message.slice(0, 200)}`);
      }
    }
  }
}

function loadReport(dir: string): unknown | null {
  for (const name of ["report.json", "results.sarif", "report.sarif"]) {
    const p = path.join(dir, name);
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, "utf8"));
  }
  return null;
}

function formatSummary(arm: string, s: Summary): string {
  const pct = (x: { hits: number; rate: number }) => `${x.hits}/${s.entries} (${(x.rate * 100).toFixed(1)}%)`;
  return [
    `${arm} — measured on ${s.entries} entries (${s.scored} with a report, ${s.missing} missing = miss)`,
    "",
    `| level | ${KS.map((k) => `hit@${k}`).join(" | ")} |`,
    `|---|${KS.map(() => "---").join("|")}|`,
    `| file | ${KS.map((k) => pct(s.file[`hit@${k}`])).join(" | ")} |`,
    `| function | ${KS.map((k) => pct(s.function[`hit@${k}`])).join(" | ")} |`,
  ].join("\n");
}

function score() {
  const arm = flag("--arm") ?? "rules";
  let notScanned = 0;
  const scores = entries.map((e) => {
    const doc = loadReport(path.join(outDir, arm, e.cve));
    if ((doc as { summary?: { unsupportedCwe?: boolean } } | null)?.summary?.unsupportedCwe) notScanned++;
    const read = (rel: string) => {
      try {
        return fs.readFileSync(path.join(treeDir(e), rel), "utf8");
      } catch {
        return null;
      }
    };
    return scoreEntry(e, doc == null ? null : rankedFromReport(doc, read));
  });
  const s = summarize(scores);
  fs.mkdirSync(path.join(outDir, arm), { recursive: true });
  fs.writeFileSync(path.join(outDir, arm, "summary.json"), JSON.stringify({ schema: "zeroday.kernel-bench.summary/v1", arm, notScanned, ...s }, null, 2) + "\n");
  console.log(formatSummary(arm, s));
  if (notScanned) console.log(`\n${notScanned}/${s.entries} report(s): NOT SCANNED — no rules for that CWE; a zero there is not a clean negative.`);
}

async function main() {
  if (cmd === "fetch") {
    for (const e of entries) {
      const t0 = Date.now();
      const dir = await fetchEntry(e);
      const files = fs.readdirSync(dir, { recursive: true, withFileTypes: true }).filter((d) => d.isFile()).length - 1;
      console.log(`${e.cve}: ${e.scope} @ ${e.parentCommit.slice(0, 12)} — ${files} files (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    }
  } else if (cmd === "run") await run();
  else if (cmd === "score") score();
  else console.log("usage: bench:kernel -- fetch | run --arms rules|antares | score --arm rules|antares");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
