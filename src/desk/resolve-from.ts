/**
 * Desk path resolution — real cwd / --repo / --from first; fixtures only via --fixture.
 *
 * Precedence for packet / harden / craft / classify reports (when no --from):
 *   1. zeroday-reports/ under cwd (dir or newest usable child)
 *   2. docs/reports under cwd (if present — e.g. this monorepo)
 *   3. error → require --from or --fixture
 *
 * Inventory: cwd / --repo by default; --fixture → fixtures/inventory/desk-b.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DESK_REPO_ROOT = path.resolve(HERE, "../..");

export type DeskReportsSource =
  | "explicit"
  | "fixture"
  | "zeroday-reports"
  | "docs-reports";

export type DeskInventorySource =
  | "explicit-from"
  | "explicit-repo"
  | "fixture"
  | "cwd";

const REPORT_MARKERS = [
  "inventory.json",
  "desk-b-inventory.json",
  "packet.json",
  "findings.json",
  "harden.json",
  "classify.json",
  "ciso.json",
  "report.json",
] as const;

function existsDir(p: string): boolean {
  try {
    return fs.existsSync(p) && fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function existsFile(p: string): boolean {
  try {
    return fs.existsSync(p) && fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

/** True when a directory looks like Desk / locate report output. */
export function looksLikeDeskReportsDir(dir: string): boolean {
  const abs = path.resolve(dir);
  if (!existsDir(abs)) return false;

  for (const name of REPORT_MARKERS) {
    if (existsFile(path.join(abs, name))) return true;
  }

  // Nested desk-* samples (docs/reports layout)
  for (const nest of [
    "desk-a-packet",
    "desk-c-harden",
    "desk-d-craft",
    "desk-e-classify",
  ]) {
    const nested = path.join(abs, nest);
    if (!existsDir(nested)) continue;
    for (const name of REPORT_MARKERS) {
      if (existsFile(path.join(nested, name))) return true;
    }
  }

  try {
    if (fs.readdirSync(abs).some((n) => n.endsWith(".sarif"))) return true;
  } catch {
    /* ignore */
  }

  return false;
}

/**
 * Prefer the directory itself when usable; else newest immediate child that looks usable.
 */
export function findUsableReportsDir(baseDir: string): string | null {
  const abs = path.resolve(baseDir);
  if (!existsDir(abs)) return null;

  if (looksLikeDeskReportsDir(abs)) return abs;

  let best: { path: string; mtime: number } | null = null;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(abs, { withFileTypes: true });
  } catch {
    return null;
  }

  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    if (ent.name.startsWith(".")) continue;
    const child = path.join(abs, ent.name);
    if (!looksLikeDeskReportsDir(child)) continue;
    let mtime = 0;
    try {
      mtime = fs.statSync(child).mtimeMs;
    } catch {
      continue;
    }
    if (!best || mtime > best.mtime) {
      best = { path: child, mtime };
    }
  }

  return best?.path ?? null;
}

/** Checked-in Desk B→A→C→E sample reports (explicit --fixture). */
export function fixtureDeskReportsDir(repoRoot?: string): string {
  return path.join(repoRoot ?? DESK_REPO_ROOT, "docs", "reports");
}

/** Desk B fixture manifest (explicit --fixture). */
export function fixtureInventoryManifest(repoRoot?: string): string {
  return path.join(
    repoRoot ?? DESK_REPO_ROOT,
    "fixtures",
    "inventory",
    "desk-b",
    "manifest.json",
  );
}

/** Desk E fixture classify scenario (explicit --fixture). */
export function fixtureClassifyDir(repoRoot?: string): string {
  return path.join(
    repoRoot ?? DESK_REPO_ROOT,
    "fixtures",
    "classify",
    "software_defect",
  );
}

export interface ResolveDeskReportsOptions {
  fixture?: boolean;
  from?: string;
  /** Working directory for real-path defaults (default: process.cwd()). */
  cwd?: string;
  /** ZERODAY checkout root — used for --fixture paths. */
  repoRoot?: string;
  /** Command name for error messages. */
  command?: string;
}

export interface ResolvedDeskReports {
  path: string;
  source: DeskReportsSource;
}

/**
 * Resolve --from for packet / harden / craft (and classify when no scenario/telemetry).
 */
export function resolveDeskReportsFrom(
  opts: ResolveDeskReportsOptions,
): ResolvedDeskReports {
  const cwd = path.resolve(opts.cwd ?? process.cwd());
  const repoRoot = opts.repoRoot ?? DESK_REPO_ROOT;
  const cmd = opts.command ?? "desk";

  if (opts.fixture) {
    if (opts.from) {
      throw new Error(
        `${cmd}: refuse mixed --fixture and --from (pick one). ` +
          `Fixtures are opt-in smoke; real trees use --from / cwd defaults.`,
      );
    }
    return {
      path: fixtureDeskReportsDir(repoRoot),
      source: "fixture",
    };
  }

  if (opts.from && opts.from.trim().length > 0) {
    return {
      path: path.resolve(cwd, opts.from),
      source: "explicit",
    };
  }

  const zr = findUsableReportsDir(path.join(cwd, "zeroday-reports"));
  if (zr) {
    return { path: zr, source: "zeroday-reports" };
  }

  const docsReports = path.join(cwd, "docs", "reports");
  if (looksLikeDeskReportsDir(docsReports)) {
    return { path: docsReports, source: "docs-reports" };
  }

  throw new Error(
    `${cmd}: no reports dir found under ${path.join(cwd, "zeroday-reports")} ` +
      `or ${docsReports}. Run inventory first, pass --from <dir>, or use --fixture for smoke.`,
  );
}

/**
 * Classify --from resolution: same real-path precedence, but --fixture → fixtures/classify/software_defect.
 */
export function resolveClassifyFromPath(
  opts: ResolveDeskReportsOptions,
): ResolvedDeskReports {
  const cwd = path.resolve(opts.cwd ?? process.cwd());
  const repoRoot = opts.repoRoot ?? DESK_REPO_ROOT;

  if (opts.fixture) {
    if (opts.from) {
      throw new Error(
        `classify: refuse mixed --fixture and --from (pick one).`,
      );
    }
    return { path: fixtureClassifyDir(repoRoot), source: "fixture" };
  }

  if (opts.from && opts.from.trim().length > 0) {
    return {
      path: path.resolve(cwd, opts.from),
      source: "explicit",
    };
  }

  const zr = findUsableReportsDir(path.join(cwd, "zeroday-reports"));
  if (zr) {
    return { path: zr, source: "zeroday-reports" };
  }

  // Prefer Desk E sample when present (monorepo), else full docs/reports
  const deskE = path.join(cwd, "docs", "reports", "desk-e-classify");
  if (looksLikeDeskReportsDir(deskE)) {
    return { path: deskE, source: "docs-reports" };
  }
  const docsReports = path.join(cwd, "docs", "reports");
  if (looksLikeDeskReportsDir(docsReports)) {
    return { path: docsReports, source: "docs-reports" };
  }

  throw new Error(
    `classify: provide --from <dir|report.json>, --fixture, --scenario <name>, ` +
      `and/or --telemetry <file.json> (or place report.json under zeroday-reports/).`,
  );
}

export interface ResolveInventoryTargetOptions {
  fixture?: boolean;
  from?: string;
  repo?: string[];
  cwd?: string;
  repoRoot?: string;
}

export interface ResolvedInventoryTarget {
  /** Manifest path when using --from or --fixture. */
  from?: string;
  /** Repo paths when using --repo or cwd default. */
  repos: string[];
  source: DeskInventorySource;
}

/**
 * Inventory defaults to cwd (or --repo / --from). Fixtures only via --fixture.
 */
export function resolveInventoryTarget(
  opts: ResolveInventoryTargetOptions,
): ResolvedInventoryTarget {
  const cwd = path.resolve(opts.cwd ?? process.cwd());
  const repoRoot = opts.repoRoot ?? DESK_REPO_ROOT;
  const repos = (opts.repo ?? []).filter((r) => r && r.length > 0);

  if (opts.fixture) {
    if (opts.from || repos.length > 0) {
      throw new Error(
        `inventory: refuse mixed --fixture with --from/--repo (pick one). ` +
          `Fixtures are opt-in smoke; real trees use cwd / --repo / --from.`,
      );
    }
    return {
      from: fixtureInventoryManifest(repoRoot),
      repos: [],
      source: "fixture",
    };
  }

  if (opts.from && opts.from.trim().length > 0) {
    return {
      from: path.resolve(cwd, opts.from),
      repos: repos.map((r) => path.resolve(cwd, r)),
      source: "explicit-from",
    };
  }

  if (repos.length > 0) {
    return {
      repos: repos.map((r) => path.resolve(cwd, r)),
      source: "explicit-repo",
    };
  }

  return {
    repos: [cwd],
    source: "cwd",
  };
}
