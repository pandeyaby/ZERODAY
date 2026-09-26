/**
 * Baseline + diff mode for CI: only new findings (or findings in changed files)
 * should block a pull request.
 *
 * Fingerprints are stable across unrelated edits: CWE + file + finding title +
 * the normalized text of the flagged line (not its line number).
 */

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { LocalizationResult, RankedFile } from "./types";

function lineText(repo: string, f: RankedFile): string {
  const ev = f.evidence[0];
  if (!ev) return "";
  try {
    const lines = fs.readFileSync(path.join(repo, f.filePath), "utf8").split(/\r?\n/);
    const t = lines[(ev.startLine ?? 1) - 1];
    if (t !== undefined) return t;
  } catch {
    /* ingest / recording: file may not exist locally */
  }
  return ev.excerpt ?? "";
}

export function fingerprintFor(repo: string, f: RankedFile): string {
  const text = lineText(repo, f).trim().replace(/\s+/g, " ");
  return createHash("sha256")
    .update([f.cweIds.join(","), f.filePath, f.title, text].join("\u0000"))
    .digest("hex")
    .slice(0, 24);
}

/** Add `fingerprint` to every ranked file. */
export function addFingerprints(result: LocalizationResult, repo: string): void {
  for (const f of result.rankedFiles) f.fingerprint ??= fingerprintFor(repo, f);
}

function rerank(result: LocalizationResult): void {
  result.rankedFiles.forEach((f, i) => (f.rank = i + 1));
  result.summary.findingCount = result.rankedFiles.length;
}

/** Files changed since `ref` (merge-base diff + uncommitted + untracked). Throws when git can't answer. */
export function changedFiles(repo: string, ref: string): Set<string> {
  const git = (args: string[]) => {
    const r = spawnSync("git", ["-C", repo, ...args], { encoding: "utf8" });
    if (r.status !== 0) {
      throw new Error(
        `--changed-since ${ref}: git ${args.join(" ")} failed (${(r.stderr || r.error?.message || "").trim().split("\n")[0]}). ` +
          "Run inside a git checkout with the ref fetched (CI: actions/checkout with fetch-depth: 0).",
      );
    }
    return r.stdout.split("\n").map((s) => s.trim()).filter(Boolean);
  };
  const top = git(["rev-parse", "--show-toplevel"])[0]!;
  const prefix = path.relative(top, path.resolve(repo)).split(path.sep).join("/");
  const toRepoRel = (p: string) => (prefix && p.startsWith(`${prefix}/`) ? p.slice(prefix.length + 1) : prefix ? null : p);
  const out = new Set<string>();
  for (const p of [
    ...git(["diff", "--name-only", `${ref}...HEAD`]),
    ...git(["diff", "--name-only", "HEAD"]),
    ...git(["ls-files", "--others", "--exclude-standard"]).map((p) => (prefix ? `${prefix}/${p}` : p)),
  ]) {
    const rel = toRepoRel(p);
    if (rel) out.add(rel);
  }
  return out;
}

/**
 * Keep findings in changed files — plus findings whose request input comes from a
 * changed file ("Request input from routes/x.js line 3 …").
 */
export function applyChangedSince(result: LocalizationResult, repo: string, ref: string): void {
  const changed = changedFiles(repo, ref);
  const before = result.rankedFiles.length;
  result.rankedFiles = result.rankedFiles.filter(
    (f) =>
      changed.has(f.filePath) ||
      f.evidence.some((e) => [...changed].some((c) => e.note?.includes(`Request input from ${c} `))),
  );
  rerank(result);
  result.summary.changedSince = { ref, changedFiles: changed.size, droppedFindings: before - result.rankedFiles.length };
  result.warnings.push(
    `Diff mode: ${changed.size} file(s) changed since ${ref}; kept ${result.rankedFiles.length} of ${before} finding(s).`,
  );
}

/** Mark findings new / unchanged against an earlier report.json (or its directory). */
export function applyBaseline(result: LocalizationResult, repo: string, baselinePath: string): void {
  const file = fs.existsSync(baselinePath) && fs.statSync(baselinePath).isDirectory()
    ? path.join(baselinePath, "report.json")
    : baselinePath;
  let prior: Pick<LocalizationResult, "rankedFiles">;
  try {
    prior = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    throw new Error(`--baseline: cannot read ${file} (${(e as Error).message}). Pass a report.json from an earlier locate run.`);
  }
  const known = new Set<string>();
  for (const f of prior.rankedFiles ?? []) known.add(f.fingerprint ?? fingerprintFor(repo, f));
  addFingerprints(result, repo);
  let fresh = 0;
  const current = new Set<string>();
  for (const f of result.rankedFiles) {
    current.add(f.fingerprint!);
    f.baselineState = known.has(f.fingerprint!) ? "unchanged" : "new";
    if (f.baselineState === "new") fresh++;
  }
  // New findings first, then by original rank.
  result.rankedFiles.sort((a, b) => Number(b.baselineState === "new") - Number(a.baselineState === "new") || a.rank - b.rank);
  rerank(result);
  const absent = [...known].filter((k) => !current.has(k)).length;
  result.summary.baseline = { file, new: fresh, unchanged: result.rankedFiles.length - fresh, absent };
  result.warnings.push(`Baseline ${file}: ${fresh} new, ${result.rankedFiles.length - fresh} unchanged, ${absent} no longer found.`);
}
