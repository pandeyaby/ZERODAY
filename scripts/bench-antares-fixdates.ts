/**
 * Record each benchmark case's fix-commit date in bench/antares/cases.json, so
 * the report can show that every fix postdates Antares-1B's training cutoff.
 * Fetches commit metadata only (no file contents); needs network to GitHub.
 *
 *   npm run bench:antares:fixdates
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = path.resolve(__dirname, "..");
const file = path.join(ROOT, "bench/antares/cases.json");
const data = JSON.parse(fs.readFileSync(file, "utf8")) as { cases: Array<{ id: string; repo: string; fixCommit: string; fixDate?: string }> };

function git(argv: string[], cwd: string): string {
  const r = spawnSync("git", argv, { cwd, encoding: "utf8", timeout: 300_000 });
  if (r.status !== 0) throw new Error(`git ${argv.join(" ")}: ${r.stderr.trim().slice(0, 300)}`);
  return r.stdout.trim();
}

let changed = 0;
for (const c of data.cases) {
  if (c.fixDate) continue;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zd-fixdate-"));
  try {
    git(["init", "-q"], dir);
    git(["fetch", "-q", "--depth=1", "--filter=blob:none", `${c.repo}.git`, c.fixCommit], dir);
    c.fixDate = git(["show", "-s", "--format=%cI", "FETCH_HEAD"], dir);
    changed++;
    console.log(`${c.id}  ${c.fixDate}`);
  } catch (e) {
    console.log(`${c.id}  failed: ${(e as Error).message}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
fs.writeFileSync(file, JSON.stringify(data, null, 1) + "\n");
const dates = data.cases.map((c) => c.fixDate).filter(Boolean).sort();
console.log(`\n${changed} added · ${dates.length}/${data.cases.length} cases have a fix date · earliest ${dates[0] ?? "—"}`);
