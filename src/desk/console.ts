/**
 * Desk Console — in-process runners for the local Operator /play UI.
 * Wraps existing locate / factory / packet / harden / classify / craft libs.
 * Not an Antares CLI shell wrapper. No live endpoint / RunPod / spend.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertPathAllowed,
  getAllowedRoots,
  PathPolicyError,
  resolveOutputDir,
} from "../lib/path-policy";
import { locate, defaultFixtureRepo } from "../locate/index";
import type { LocalizationResult } from "../locate/types";
import {
  resolveDeskReportsFrom,
  resolveInventoryTarget,
  DESK_REPO_ROOT,
} from "./resolve-from";
import { runClassify } from "../classify/index";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "../..");

export const DESK_ACTIONS = [
  "catalog",
  "rules",
  "from-sarif",
  "inventory",
  "packet",
  "harden",
  "classify",
  "craft",
] as const;

export type DeskAction = (typeof DESK_ACTIONS)[number];

const HONESTY_BANNER =
  "needs_human · no PoC · localization ≠ exploitability · no auto-merge · Desk Console wraps libs in-process";

export interface DeskRankedFile {
  rank: number;
  filePath: string;
  title: string;
  cweIds: string[];
}

export interface DeskCatalog {
  kind: "catalog";
  mode: "desk";
  actions: Array<{
    id: DeskAction;
    label: string;
    description: string;
  }>;
  allowedRoots: string[];
  defaults: {
    cwe: string;
    rulesRepo: string;
    sarifPath: string;
    inventoryRepo: string;
  };
  honesty: string[];
}

export interface DeskLocateResult {
  kind: "locate";
  mode: LocalizationResult["mode"];
  action: "rules" | "from-sarif";
  advisory: string;
  cweId: string;
  findingCount: number;
  rankedFiles: DeskRankedFile[];
  outputDir: string;
  paths: {
    json: string;
    sarif: string;
    report: string;
  };
  warnings: string[];
  needs_human: true;
  honesty: string;
}

export interface DeskInventoryResult {
  kind: "inventory";
  mode: "inventory";
  action: "inventory";
  source: string;
  repoRoot: string;
  fileCount: number;
  findingCount: number;
  languages: string[];
  outputDir: string;
  paths: {
    json: string;
    markdown: string;
    sarif: string;
    caseNote: string;
  };
  rankedFiles: DeskRankedFile[];
  needs_human: true;
  honesty: string;
}

export interface DeskPacketResult {
  kind: "packet";
  mode: "packet";
  action: "packet";
  findingCount: number;
  outputDir: string;
  paths: Record<string, string>;
  needs_human: true;
  honesty: string;
}

export interface DeskHardenResult {
  kind: "harden";
  mode: "harden";
  action: "harden";
  recommendationCount: number;
  outputDir: string;
  paths: Record<string, string>;
  needs_human: true;
  honesty: string;
}

export interface DeskClassifyResult {
  kind: "classify";
  mode: "classify";
  action: "classify";
  classification: string;
  confidence: number;
  needs_human: true;
  outputDir: string;
  paths: Record<string, string>;
  honesty: string;
}

export interface DeskCraftResult {
  kind: "craft";
  mode: "craft";
  action: "craft";
  scaffoldKind: string;
  outputDir: string;
  paths: Record<string, string>;
  needs_human: true;
  honesty: string;
}

export type DeskResult =
  | DeskCatalog
  | DeskLocateResult
  | DeskInventoryResult
  | DeskPacketResult
  | DeskHardenResult
  | DeskClassifyResult
  | DeskCraftResult;

export interface DeskRunRequest {
  action: DeskAction;
  /** Repo / target path (rules, inventory). */
  repo?: string;
  /** CWE / CVE / GHSA for rules locate. */
  cwe?: string;
  /** SARIF file path for from-sarif. */
  sarif?: string;
  /** Reports dir / from path for packet / harden / classify / craft. */
  from?: string;
  /** Output directory (sandboxed). */
  output?: string;
  /** Use checked-in fixtures (inventory / packet / harden / classify / craft). */
  fixture?: boolean;
  /** Craft scaffold kind. */
  craftKind?: "skill" | "plugin" | "both";
  craftName?: string;
  cwd?: string;
}

function rankedFromLocate(result: LocalizationResult): DeskRankedFile[] {
  return result.rankedFiles.map((f) => ({
    rank: f.rank,
    filePath: f.filePath,
    title: f.title,
    cweIds: f.cweIds,
  }));
}

export function deskCatalog(options?: { cwd?: string }): DeskCatalog {
  const cwd = path.resolve(options?.cwd ?? process.cwd());
  return {
    kind: "catalog",
    mode: "desk",
    actions: [
      {
        id: "rules",
        label: "Locate --rules",
        description:
          "Keyless real-repo heuristics (mode=rules). Same as zeroday locate --rules.",
      },
      {
        id: "from-sarif",
        label: "Locate --from-sarif",
        description:
          "Ingest local SARIF → mode=ingest. Same as zeroday locate --from-sarif.",
      },
      {
        id: "inventory",
        label: "Desk inventory",
        description: "Desk B multi-repo + config inventory (feeds packet).",
      },
      {
        id: "packet",
        label: "Desk packet",
        description: "Desk A offline security packet from inventory reports.",
      },
      {
        id: "harden",
        label: "Desk harden",
        description: "Desk C recommend-only harden from reports.",
      },
      {
        id: "classify",
        label: "Desk classify",
        description: "Desk E crash classify + evidence (≠ exploitability).",
      },
      {
        id: "craft",
        label: "Desk craft",
        description: "Desk D defensive SKILL/plugin scaffolds (generate-only).",
      },
    ],
    allowedRoots: getAllowedRoots({ cwd }),
    defaults: {
      cwe: "CWE-89",
      rulesRepo: path.join("fixtures", "locate", "rules-sample"),
      sarifPath: path.join(
        "fixtures",
        "locate",
        "ingest-sample",
        "sample.sarif",
      ),
      inventoryRepo: path.join("fixtures", "inventory", "sidecar-app"),
    },
    honesty: [
      "Desk Console wraps existing libs in-process — not an Antares CLI shell product",
      "needs_human is always true — localization ≠ exploitability",
      "No PoCs · no auto-merge · no live Antares / RunPod spend UI",
      "Paths must stay under cwd (or ZERODAY_UI_ROOTS)",
      "Fixture playground remains a separate smoke action via /api/playground",
    ],
  };
}

export async function runDeskRules(
  req: DeskRunRequest,
): Promise<DeskLocateResult> {
  const cwd = path.resolve(req.cwd ?? process.cwd());
  const repoRel = req.repo?.trim() || deskCatalog({ cwd }).defaults.rulesRepo;
  const repo = assertPathAllowed(repoRel, {
    cwd,
    mustExist: true,
    kind: "dir",
    label: "repo",
  });
  const advisory = (req.cwe || "CWE-89").trim();
  const outputDir = resolveOutputDir(req.output, `desk-rules-${Date.now()}`, {
    cwd,
  });

  const artifacts = await locate({
    repo,
    advisory,
    rules: true,
    outputDir,
  });

  return {
    kind: "locate",
    mode: artifacts.result.mode,
    action: "rules",
    advisory: artifacts.result.advisory.id,
    cweId: artifacts.result.advisory.cweId,
    findingCount: artifacts.result.summary.findingCount,
    rankedFiles: rankedFromLocate(artifacts.result),
    outputDir: artifacts.outputDir,
    paths: {
      json: artifacts.jsonPath,
      sarif: artifacts.sarifPath,
      report: artifacts.reportPath,
    },
    warnings: artifacts.result.warnings,
    needs_human: true,
    honesty: HONESTY_BANNER,
  };
}

export async function runDeskFromSarif(
  req: DeskRunRequest,
): Promise<DeskLocateResult> {
  const cwd = path.resolve(req.cwd ?? process.cwd());
  const sarifRel =
    req.sarif?.trim() || deskCatalog({ cwd }).defaults.sarifPath;
  const sarif = assertPathAllowed(sarifRel, {
    cwd,
    mustExist: true,
    kind: "file",
    label: "sarif",
  });
  const outputDir = resolveOutputDir(
    req.output,
    `desk-ingest-${Date.now()}`,
    { cwd },
  );

  // Ingest uses repo only for context labels; sandbox to cwd or sample dir
  const repo = assertPathAllowed(
    req.repo?.trim() || path.dirname(sarif),
    { cwd, mustExist: true, kind: "dir", label: "repo" },
  );

  const artifacts = await locate({
    repo,
    advisory: req.cwe?.trim() || "",
    fromSarif: sarif,
    outputDir,
  });

  return {
    kind: "locate",
    mode: artifacts.result.mode,
    action: "from-sarif",
    advisory: artifacts.result.advisory.id,
    cweId: artifacts.result.advisory.cweId,
    findingCount: artifacts.result.summary.findingCount,
    rankedFiles: rankedFromLocate(artifacts.result),
    outputDir: artifacts.outputDir,
    paths: {
      json: artifacts.jsonPath,
      sarif: artifacts.sarifPath,
      report: artifacts.reportPath,
    },
    warnings: artifacts.result.warnings,
    needs_human: true,
    honesty: HONESTY_BANNER,
  };
}

export async function runDeskInventory(
  req: DeskRunRequest,
): Promise<DeskInventoryResult> {
  const cwd = path.resolve(req.cwd ?? process.cwd());
  const {
    writeInventory,
    writeMultiRepoInventory,
    loadInventoryManifest,
  } = await import("../factory/index.ts");

  const fixture = req.fixture === true;
  let repos: string[] = [];
  let from: string | undefined;

  if (fixture) {
    const target = resolveInventoryTarget({
      fixture: true,
      cwd,
      repoRoot: REPO_ROOT,
    });
    from = target.from;
  } else if (req.repo?.trim()) {
    repos = [
      assertPathAllowed(req.repo.trim(), {
        cwd,
        mustExist: true,
        kind: "dir",
        label: "repo",
      }),
    ];
  } else {
    repos = [
      assertPathAllowed(deskCatalog({ cwd }).defaults.inventoryRepo, {
        cwd,
        mustExist: true,
        kind: "dir",
        label: "repo",
      }),
    ];
  }

  if (from) {
    from = assertPathAllowed(from, {
      cwd,
      mustExist: true,
      kind: "file",
      label: "from",
    });
  }

  const outputDir = resolveOutputDir(
    req.output,
    `desk-inventory-${Date.now()}`,
    { cwd },
  );
  fs.mkdirSync(outputDir, { recursive: true });

  const entries: Array<{ path: string; id?: string; optional?: boolean }> = [];
  const skipped: Array<{ id: string; reason: string }> = [];
  let source = fixture ? "fixture" : "explicit-repo";

  if (from) {
    const manifest = loadInventoryManifest(from);
    const baseDir = path.dirname(from);
    for (const r of manifest.repos) {
      const p = path.isAbsolute(r.path)
        ? r.path
        : path.resolve(baseDir, r.path);
      const optional = r.optional === true;
      if (optional && !fs.existsSync(p)) {
        skipped.push({
          id: r.id || r.path,
          reason: "optional path missing",
        });
        continue;
      }
      entries.push({
        path: assertPathAllowed(p, {
          cwd,
          mustExist: true,
          kind: "dir",
          label: `manifest repo ${r.id || r.path}`,
        }),
        id: r.id,
        optional,
      });
    }
    skipped.push(...(manifest.skip ?? []));
    source = "explicit-from";
  }
  for (const r of repos) {
    entries.push({ path: r });
  }

  if (entries.length === 0) {
    throw new Error("inventory: no target repo under sandbox");
  }

  if (entries.length === 1 && skipped.length === 0) {
    const only = entries[0]!;
    const jsonPath = path.join(outputDir, "inventory.json");
    const inv = writeInventory(only.path, jsonPath, {
      repoId: only.id,
      markdownPath: path.join(outputDir, "inventory.md"),
      writeReports: true,
    });
    const findingCount = inv.findings.filter(
      (f) => f.kind !== "config_surface",
    ).length;
    const rankedFiles: DeskRankedFile[] = inv.findings
      .filter((f) => f.kind !== "config_surface")
      .slice(0, 20)
      .map((f, i) => ({
        rank: i + 1,
        filePath: f.path,
        title: f.title || f.kind,
        cweIds: [],
      }));

    return {
      kind: "inventory",
      mode: "inventory",
      action: "inventory",
      source,
      repoRoot: inv.repoRoot,
      fileCount: inv.fileCount,
      findingCount,
      languages: inv.languages.map((l) => l.language),
      outputDir,
      paths: {
        json: jsonPath,
        markdown: path.join(outputDir, "inventory.md"),
        sarif: path.join(outputDir, "inventory.sarif"),
        caseNote: path.join(outputDir, "case-note.md"),
      },
      rankedFiles,
      needs_human: true,
      honesty: HONESTY_BANNER,
    };
  }

  const { multi, jsonPath, mdPath, sarifPath, caseNotePath } =
    writeMultiRepoInventory(entries, outputDir, {
      skipped,
      writeReports: true,
    });
  const findingCount = multi.findings.filter(
    (f) => f.kind !== "config_surface",
  ).length;
  const rankedFiles: DeskRankedFile[] = multi.findings
    .filter((f) => f.kind !== "config_surface")
    .slice(0, 20)
    .map((f, i) => ({
      rank: i + 1,
      filePath: f.path,
      title: f.title || f.kind,
      cweIds: [],
    }));

  return {
    kind: "inventory",
    mode: "inventory",
    action: "inventory",
    source,
    repoRoot: multi.repos.map((r) => r.repoRoot).join(", "),
    fileCount: multi.repos.reduce((n, r) => n + r.fileCount, 0),
    findingCount,
    languages: [
      ...new Set(multi.repos.flatMap((r) => r.languages.map((l) => l.language))),
    ],
    outputDir,
    paths: {
      json: jsonPath,
      markdown: mdPath,
      sarif: sarifPath || path.join(outputDir, "inventory.sarif"),
      caseNote: caseNotePath || path.join(outputDir, "case-note.md"),
    },
    rankedFiles,
    needs_human: true,
    honesty: HONESTY_BANNER,
  };
}

async function resolveFromDir(
  req: DeskRunRequest,
  command: string,
): Promise<string> {
  const cwd = path.resolve(req.cwd ?? process.cwd());
  if (req.fixture) {
    const resolved = resolveDeskReportsFrom({
      fixture: true,
      cwd,
      repoRoot: REPO_ROOT,
      command,
    });
    return assertPathAllowed(resolved.path, {
      cwd,
      mustExist: true,
      kind: "dir",
      label: "from",
    });
  }
  if (req.from?.trim()) {
    return assertPathAllowed(req.from.trim(), {
      cwd,
      mustExist: true,
      kind: "any",
      label: "from",
    });
  }
  // Prefer docs/reports under sandbox when present (this monorepo)
  const docsReports = path.join(cwd, "docs", "reports");
  if (fs.existsSync(docsReports)) {
    return assertPathAllowed(docsReports, {
      cwd,
      mustExist: true,
      kind: "dir",
      label: "from",
    });
  }
  const resolved = resolveDeskReportsFrom({
    fixture: false,
    cwd,
    repoRoot: DESK_REPO_ROOT,
    command,
  });
  return assertPathAllowed(resolved.path, {
    cwd,
    mustExist: true,
    kind: "dir",
    label: "from",
  });
}

export async function runDeskPacket(
  req: DeskRunRequest,
): Promise<DeskPacketResult> {
  const cwd = path.resolve(req.cwd ?? process.cwd());
  const { writeSecurityPacket } = await import("../packet/index.ts");
  const fromDir = await resolveFromDir(req, "packet");
  const outputDir = resolveOutputDir(req.output, `desk-packet-${Date.now()}`, {
    cwd,
  });
  const result = writeSecurityPacket(fromDir, outputDir);
  return {
    kind: "packet",
    mode: "packet",
    action: "packet",
    findingCount: result.packet.findings.length,
    outputDir: result.outputDir,
    paths: {
      packetJson: result.packetJsonPath,
      summary: result.summaryPath,
      findingsJson: result.findingsJsonPath,
      findingsMd: result.findingsMdPath,
      readme: result.readmePath,
    },
    needs_human: true,
    honesty: HONESTY_BANNER,
  };
}

export async function runDeskHarden(
  req: DeskRunRequest,
): Promise<DeskHardenResult> {
  const cwd = path.resolve(req.cwd ?? process.cwd());
  const { writeHardenReport } = await import("../harden/index.ts");
  const fromDir = await resolveFromDir(req, "harden");
  const outputDir = resolveOutputDir(req.output, `desk-harden-${Date.now()}`, {
    cwd,
  });
  const result = writeHardenReport(fromDir, outputDir, { draft: false });
  return {
    kind: "harden",
    mode: "harden",
    action: "harden",
    recommendationCount: result.report.recommendations.length,
    outputDir: result.outputDir,
    paths: {
      hardenJson: result.hardenJsonPath,
      hardenMd: result.hardenMdPath,
      readme: result.readmePath,
    },
    needs_human: true,
    honesty: HONESTY_BANNER,
  };
}

export async function runDeskClassify(
  req: DeskRunRequest,
): Promise<DeskClassifyResult> {
  const cwd = path.resolve(req.cwd ?? process.cwd());
  let from: string | undefined;
  if (req.fixture || !req.from?.trim()) {
    try {
      from = await resolveFromDir(
        { ...req, fixture: req.fixture ?? !req.from?.trim() },
        "classify",
      );
    } catch {
      // fall through to scenario fixture via runClassify
      from = undefined;
    }
  } else {
    from = assertPathAllowed(req.from.trim(), {
      cwd,
      mustExist: true,
      kind: "any",
      label: "from",
    });
  }

  const outputDir = resolveOutputDir(
    req.output,
    `desk-classify-${Date.now()}`,
    { cwd },
  );

  const artifacts = runClassify({
    from: from || (req.fixture ? undefined : from),
    scenario: !from ? "software_defect" : undefined,
    outputDir,
  });

  return {
    kind: "classify",
    mode: "classify",
    action: "classify",
    classification: artifacts.pack.classification,
    confidence: artifacts.pack.confidence,
    needs_human: true,
    outputDir: artifacts.outputDir,
    paths: {
      classifyJson: artifacts.classifyJsonPath,
      classifyMd: artifacts.classifyMdPath,
      cisoJson: artifacts.cisoJsonPath,
      cisoMd: artifacts.cisoMdPath,
    },
    honesty: HONESTY_BANNER,
  };
}

export async function runDeskCraft(
  req: DeskRunRequest,
): Promise<DeskCraftResult> {
  const cwd = path.resolve(req.cwd ?? process.cwd());
  const { writeCraftReport } = await import("../craft/index.ts");
  const fromDir = await resolveFromDir(req, "craft");
  const outputDir = resolveOutputDir(req.output, `desk-craft-${Date.now()}`, {
    cwd,
  });
  const kind = req.craftKind || "both";
  const result = writeCraftReport(fromDir, outputDir, {
    name: req.craftName || "zeroday-desk-skill",
    kind,
  });
  const paths: Record<string, string> = {
    craftJson: result.craftJsonPath,
    craftMd: result.craftMdPath,
    readme: result.readmePath,
  };
  if (result.skillPaths[0]) paths.skill = result.skillPaths[0];
  if (result.pluginPaths[0]) paths.plugin = result.pluginPaths[0];

  return {
    kind: "craft",
    mode: "craft",
    action: "craft",
    scaffoldKind: kind,
    outputDir: result.outputDir,
    paths,
    needs_human: true,
    honesty: HONESTY_BANNER,
  };
}

export async function runDeskAction(
  req: DeskRunRequest,
): Promise<DeskResult> {
  const action = req.action;
  if (!action || !DESK_ACTIONS.includes(action)) {
    throw new Error(`action must be one of: ${DESK_ACTIONS.join("|")}`);
  }
  switch (action) {
    case "catalog":
      return deskCatalog({ cwd: req.cwd });
    case "rules":
      return runDeskRules(req);
    case "from-sarif":
      return runDeskFromSarif(req);
    case "inventory":
      return runDeskInventory(req);
    case "packet":
      return runDeskPacket(req);
    case "harden":
      return runDeskHarden(req);
    case "classify":
      return runDeskClassify(req);
    case "craft":
      return runDeskCraft(req);
    default: {
      const _exhaustive: never = action;
      throw new Error(`Unhandled action: ${_exhaustive}`);
    }
  }
}

export { PathPolicyError, defaultFixtureRepo, REPO_ROOT };
