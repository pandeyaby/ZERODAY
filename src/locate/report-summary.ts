/**
 * CISO-readable localization summary from existing outputs.
 *
 * Inputs (fail-closed): prove-doors JSON (zeroday-prove-doors/v1), SARIF 2.1,
 * optional historical gpu-evidence / evidence-pack. Never invents metrics,
 * never claims exploitability, never starts RunPod.
 *
 * Schema: zeroday.report/v1
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseSarifFile } from "./ingest/parse-sarif.ts";
import {
  PROVE_DOORS_SCHEMA,
  type ProveDoorsResult,
} from "../desk/prove-doors.ts";
import {
  loadGpuEvidence,
  GPU_EVIDENCE_SCHEMA,
  type GpuEvidenceOk,
} from "../desk/gpu-evidence.ts";
import {
  EVIDENCE_PACK_PROVE_DOORS_FILE,
  EVIDENCE_PACK_GPU_EVIDENCE_FILE,
  EVIDENCE_PACK_MANIFEST_FILE,
  EVIDENCE_PACK_SCHEMA,
} from "./evidence-pack.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPORT_REPO_ROOT = path.resolve(HERE, "../..");

export const REPORT_SCHEMA = "zeroday.report/v1" as const;

/** Checked-in prove-doors sample for Desk / keyless smoke (never invents findings). */
export const REPORT_DEFAULT_FROM = path.join(
  "fixtures",
  "locate",
  "report-sample",
  "prove-doors.json",
);

/** CLI / Desk download filenames (browser helper mirrors these). */
export const REPORT_DEFAULT_OUT_JSON = "out/report.json" as const;
export const REPORT_DEFAULT_OUT_MD = "out/report.md" as const;

export type ReportErrorCode =
  | "INPUT_MISSING"
  | "INPUT_CORRUPT"
  | "INPUT_SCHEMA"
  | "WRITE_FAILED";

export class ReportError extends Error {
  code: ReportErrorCode;
  cause?: unknown;
  constructor(message: string, code: ReportErrorCode, cause?: unknown) {
    super(message);
    this.name = "ReportError";
    this.code = code;
    this.cause = cause;
  }
}

export interface ReportSource {
  kind: "prove-doors" | "sarif" | "gpu-evidence" | "evidence-pack";
  path: string;
  schemaVersion?: string;
  label: string;
}

export interface ReportFinding {
  path: string;
  rank?: number;
  score?: number;
  cweIds?: string[];
  evidence: string[];
  source: ReportSource["kind"];
}

export interface ReportGpuFootnote {
  historical: true;
  startsRunPod: false;
  podId?: string;
  gpu?: string;
  label?: string;
  rankedFile?: string;
  source: string;
}

export interface ZerodayReport {
  schemaVersion: typeof REPORT_SCHEMA;
  generated_at: string;
  sources: ReportSource[];
  findings: ReportFinding[];
  disclaimers: string[];
  /** Always false — this command never provisions RunPod. */
  runpod: false;
  whatWasRun: {
    keyless: boolean;
    doorsLabel?: string;
    historicalGpu: boolean;
  };
  gpuFootnote?: ReportGpuFootnote;
}

export interface RunReportOptions {
  /** Path to prove-doors.json, or an evidence-pack directory. */
  from?: string;
  /** Path to a SARIF 2.1 file (locate / upload-sarif / fixture). */
  sarif?: string;
  /**
   * Optional historical gpu-evidence JSON (or path override).
   * Checked-in evidence only — never starts RunPod.
   */
  gpuEvidence?: string;
  /** Working directory for relative paths (default: package root). */
  cwd?: string;
  /** Inject generated_at for tests. */
  generatedAt?: string;
}

const DISCLAIMERS: string[] = [
  "Localization ≠ exploitability — ranked files / door outcomes are candidates for human review only.",
  "No PoC / exploit / payload content is emitted or implied.",
  "No auto-merge — open a normal reviewable PR if a fix is warranted.",
  "needs_human: true — always.",
  "No AUROC / File F1 / SLA invented by this report command.",
  "runpod: false — this command does not start RunPod or live GPU.",
];

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function resolveUnderCwd(cwd: string, raw: string, label: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new ReportError(`${label} is empty`, "INPUT_MISSING");
  }
  return path.isAbsolute(trimmed) ? trimmed : path.resolve(cwd, trimmed);
}

function readJsonFile(abs: string, label: string): unknown {
  if (!fs.existsSync(abs)) {
    throw new ReportError(`${label} not found: ${abs}`, "INPUT_MISSING");
  }
  if (!fs.statSync(abs).isFile()) {
    throw new ReportError(`${label} is not a file: ${abs}`, "INPUT_MISSING");
  }
  let raw: string;
  try {
    raw = fs.readFileSync(abs, "utf8");
  } catch (e) {
    throw new ReportError(
      `${label} unreadable: ${(e as Error).message}`,
      "INPUT_CORRUPT",
      e,
    );
  }
  if (!raw.trim()) {
    throw new ReportError(`${label} is empty: ${abs}`, "INPUT_CORRUPT");
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch (e) {
    throw new ReportError(
      `${label} invalid JSON: ${(e as Error).message}`,
      "INPUT_CORRUPT",
      e,
    );
  }
}

/**
 * Fail-closed structural parse of zeroday-prove-doors/v1.
 * Does not re-run doors — reads existing JSON only.
 */
export function parseProveDoorsJson(raw: unknown): ProveDoorsResult {
  if (!isPlainObject(raw)) {
    throw new ReportError(
      "prove-doors root must be a JSON object",
      "INPUT_SCHEMA",
    );
  }
  if (raw.schemaVersion !== PROVE_DOORS_SCHEMA) {
    throw new ReportError(
      `prove-doors schemaVersion want ${PROVE_DOORS_SCHEMA} got ${String(raw.schemaVersion)}`,
      "INPUT_SCHEMA",
    );
  }
  if (typeof raw.ok !== "boolean") {
    throw new ReportError("prove-doors.ok must be a boolean", "INPUT_SCHEMA");
  }
  if (typeof raw.generatedAt !== "string" || !raw.generatedAt.trim()) {
    throw new ReportError(
      "prove-doors.generatedAt must be a non-empty string",
      "INPUT_SCHEMA",
    );
  }
  if (!isPlainObject(raw.doors)) {
    throw new ReportError("prove-doors.doors must be an object", "INPUT_SCHEMA");
  }
  for (const key of ["a", "cassette", "b", "d", "e"] as const) {
    if (!isPlainObject(raw.doors[key])) {
      throw new ReportError(
        `prove-doors.doors.${key} must be an object`,
        "INPUT_SCHEMA",
      );
    }
    const status = raw.doors[key].status;
    if (status !== "ok" && status !== "failed" && status !== "skipped") {
      throw new ReportError(
        `prove-doors.doors.${key}.status invalid: ${String(status)}`,
        "INPUT_SCHEMA",
      );
    }
  }
  if (!isPlainObject(raw.nonClaims)) {
    throw new ReportError(
      "prove-doors.nonClaims must be an object",
      "INPUT_SCHEMA",
    );
  }
  return raw as unknown as ProveDoorsResult;
}

function findingsFromProveDoors(
  prove: ProveDoorsResult,
): ReportFinding[] {
  const out: ReportFinding[] = [];
  const cassette = prove.doors.cassette;
  if (cassette.status === "ok" && cassette.result) {
    const r = cassette.result;
    const evidence: string[] = [
      `cassette:replay mode=${r.mode}`,
      `findingCount=${r.findingCount}`,
      `cweId=${r.cweId}`,
    ];
    if (r.recording) evidence.push(`recording=${r.recording}`);
    out.push({
      path: r.rankedFile,
      rank: 1,
      cweIds: r.cweId ? [r.cweId] : undefined,
      evidence,
      source: "prove-doors",
    });
  }

  const doorD = prove.doors.d;
  if (doorD.status === "ok" && doorD.result?.evidence?.liveLocate) {
    const live = doorD.result.evidence.liveLocate;
    // Avoid duplicating the same path already listed from cassette.
    if (!out.some((f) => f.path === live.rankedFile)) {
      out.push({
        path: live.rankedFile,
        rank: live.rank,
        cweIds: live.cwe ? [live.cwe] : undefined,
        evidence: [
          "Door D historical Measured A40 liveLocate (checked-in evidence only)",
          `findingCount=${live.findingCount}`,
          `cwe=${live.cwe}`,
        ],
        source: "prove-doors",
      });
    } else {
      const existing = out.find((f) => f.path === live.rankedFile);
      existing?.evidence.push(
        "Also cited in Door D historical Measured A40 liveLocate (checked-in evidence only)",
      );
    }
  }
  return out;
}

function findingsFromSarif(
  sarifPath: string,
): { findings: ReportFinding[]; toolNames: string[]; warnings: string[] } {
  let parsed;
  try {
    parsed = parseSarifFile(sarifPath);
  } catch (e) {
    const msg = (e as Error).message;
    if (/not found/i.test(msg)) {
      throw new ReportError(msg, "INPUT_MISSING", e);
    }
    throw new ReportError(msg, "INPUT_CORRUPT", e);
  }

  const byUri = new Map<string, ReportFinding>();
  let rank = 1;
  for (const f of parsed.findings) {
    const existing = byUri.get(f.uri);
    const snippet = f.message.trim();
    const lineHint =
      typeof f.startLine === "number"
        ? `L${f.startLine}${typeof f.endLine === "number" && f.endLine !== f.startLine ? `-${f.endLine}` : ""}`
        : undefined;
    const bits = [
      snippet,
      f.ruleId ? `rule=${f.ruleId}` : undefined,
      lineHint,
      f.cweIds.length ? `cwe=${f.cweIds.join(",")}` : undefined,
    ].filter(Boolean) as string[];

    if (existing) {
      existing.evidence.push(...bits);
      if (f.cweIds.length) {
        existing.cweIds = [
          ...new Set([...(existing.cweIds ?? []), ...f.cweIds]),
        ];
      }
    } else {
      byUri.set(f.uri, {
        path: f.uri,
        rank: rank++,
        cweIds: f.cweIds.length ? [...f.cweIds] : undefined,
        evidence: bits,
        source: "sarif",
      });
    }
  }

  return {
    findings: [...byUri.values()],
    toolNames: parsed.toolNames,
    warnings: parsed.warnings,
  };
}

function gpuFootnoteFromEvidence(
  gpu: GpuEvidenceOk,
  sourcePath: string,
): ReportGpuFootnote {
  const e = gpu.evidence;
  return {
    historical: true,
    startsRunPod: false,
    podId: e.pod.id,
    gpu: e.pod.gpu,
    label: e.label,
    rankedFile: e.liveLocate.rankedFile,
    source: sourcePath,
  };
}

function detectEvidencePackDir(abs: string): boolean {
  if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) return false;
  return (
    fs.existsSync(path.join(abs, EVIDENCE_PACK_PROVE_DOORS_FILE)) &&
    fs.existsSync(path.join(abs, EVIDENCE_PACK_MANIFEST_FILE))
  );
}

/**
 * Build zeroday.report/v1 from existing localization / door artifacts.
 * Fail-closed on missing or invalid input. Never invents findings or metrics.
 */
export function runReport(opts: RunReportOptions = {}): ZerodayReport {
  const cwd = opts.cwd ? path.resolve(opts.cwd) : REPORT_REPO_ROOT;
  const fromRaw = opts.from?.trim();
  const sarifRaw = opts.sarif?.trim();
  const gpuRaw = opts.gpuEvidence?.trim();

  if (!fromRaw && !sarifRaw) {
    throw new ReportError(
      "Provide --from <prove-doors.json|evidence-pack-dir> and/or --sarif <path.sarif>",
      "INPUT_MISSING",
    );
  }

  const sources: ReportSource[] = [];
  const findings: ReportFinding[] = [];
  let keyless = false;
  let doorsLabel: string | undefined;
  let historicalGpu = false;
  let gpuFootnote: ReportGpuFootnote | undefined;
  const extraDisclaimers: string[] = [];

  if (fromRaw) {
    const fromAbs = resolveUnderCwd(cwd, fromRaw, "--from");

    if (detectEvidencePackDir(fromAbs)) {
      const manifestRaw = readJsonFile(
        path.join(fromAbs, EVIDENCE_PACK_MANIFEST_FILE),
        "evidence-pack manifest",
      );
      if (
        !isPlainObject(manifestRaw) ||
        manifestRaw.schemaVersion !== EVIDENCE_PACK_SCHEMA
      ) {
        throw new ReportError(
          `evidence-pack manifest schemaVersion want ${EVIDENCE_PACK_SCHEMA}`,
          "INPUT_SCHEMA",
        );
      }
      sources.push({
        kind: "evidence-pack",
        path: fromAbs,
        schemaVersion: EVIDENCE_PACK_SCHEMA,
        label: "evidence-pack (design-partner folder)",
      });

      const proveAbs = path.join(fromAbs, EVIDENCE_PACK_PROVE_DOORS_FILE);
      const prove = parseProveDoorsJson(
        readJsonFile(proveAbs, "evidence-pack prove-doors"),
      );
      sources.push({
        kind: "prove-doors",
        path: proveAbs,
        schemaVersion: PROVE_DOORS_SCHEMA,
        label: `prove-doors (ok=${prove.ok})`,
      });
      keyless = true;
      doorsLabel = summarizeDoors(prove);
      findings.push(...findingsFromProveDoors(prove));

      const gpuAbs = path.join(fromAbs, EVIDENCE_PACK_GPU_EVIDENCE_FILE);
      if (fs.existsSync(gpuAbs)) {
        try {
          const gpu = loadGpuEvidence({
            cwd,
            relativePath: gpuAbs,
          });
          sources.push({
            kind: "gpu-evidence",
            path: gpuAbs,
            schemaVersion: GPU_EVIDENCE_SCHEMA,
            label: "historical Measured A40 (evidence-pack)",
          });
          historicalGpu = true;
          gpuFootnote = gpuFootnoteFromEvidence(gpu, gpuAbs);
        } catch (e) {
          throw new ReportError(
            `evidence-pack gpu-evidence invalid: ${(e as Error).message}`,
            "INPUT_SCHEMA",
            e,
          );
        }
      }
    } else {
      const prove = parseProveDoorsJson(
        readJsonFile(fromAbs, "prove-doors"),
      );
      sources.push({
        kind: "prove-doors",
        path: fromAbs,
        schemaVersion: PROVE_DOORS_SCHEMA,
        label: `prove-doors (ok=${prove.ok})`,
      });
      keyless = true;
      doorsLabel = summarizeDoors(prove);
      findings.push(...findingsFromProveDoors(prove));

      // Door D may already embed historical GPU evidence — footnote only if present.
      if (prove.doors.d.status === "ok" && prove.doors.d.result) {
        historicalGpu = true;
        gpuFootnote = gpuFootnoteFromEvidence(
          prove.doors.d.result,
          fromAbs + "#doors.d",
        );
      }
    }
  }

  if (sarifRaw) {
    const sarifAbs = resolveUnderCwd(cwd, sarifRaw, "--sarif");
    const { findings: sarifFindings, toolNames, warnings } =
      findingsFromSarif(sarifAbs);
    sources.push({
      kind: "sarif",
      path: sarifAbs,
      schemaVersion: "SARIF-2.1",
      label: toolNames.length
        ? `SARIF (${toolNames.join(", ")})`
        : "SARIF 2.1",
    });
    findings.push(...sarifFindings);
    for (const w of warnings) {
      if (/zero results/i.test(w) || /no runs/i.test(w)) {
        extraDisclaimers.push(w);
      }
    }
  }

  if (gpuRaw) {
    const gpuAbs = resolveUnderCwd(cwd, gpuRaw, "--gpu-evidence");
    try {
      const gpu = loadGpuEvidence({ cwd, relativePath: gpuAbs });
      sources.push({
        kind: "gpu-evidence",
        path: gpuAbs,
        schemaVersion: GPU_EVIDENCE_SCHEMA,
        label: "historical Measured A40 (explicit --gpu-evidence)",
      });
      historicalGpu = true;
      gpuFootnote = gpuFootnoteFromEvidence(gpu, gpuAbs);
    } catch (e) {
      throw new ReportError(
        `gpu-evidence invalid: ${(e as Error).message}`,
        "INPUT_SCHEMA",
        e,
      );
    }
  }

  return {
    schemaVersion: REPORT_SCHEMA,
    generated_at: opts.generatedAt ?? new Date().toISOString(),
    sources,
    findings,
    disclaimers: [...DISCLAIMERS, ...extraDisclaimers],
    runpod: false,
    whatWasRun: {
      keyless,
      doorsLabel,
      historicalGpu,
    },
    ...(gpuFootnote ? { gpuFootnote } : {}),
  };
}

function summarizeDoors(prove: ProveDoorsResult): string {
  const parts = [
    `A=${prove.doors.a.status}`,
    `cassette=${prove.doors.cassette.status}`,
    `B=${prove.doors.b.status}`,
    `D=${prove.doors.d.status}`,
    `E=${prove.doors.e.status}`,
  ];
  return `keyless prove-doors (ok=${prove.ok}; ${parts.join(" · ")})`;
}

/**
 * Honest CISO markdown from zeroday.report/v1.
 */
export function formatReportMarkdown(report: ZerodayReport): string {
  const lines: string[] = [];
  lines.push(`# ZERODAY localization summary`);
  lines.push(``);
  lines.push(
    `> **Localization only.** Not proof of exploitability. No PoC. No auto-merge. needs_human.`,
  );
  lines.push(``);

  lines.push(`## What was run`);
  lines.push(``);
  lines.push(`| | |`);
  lines.push(`|--|--|`);
  lines.push(`| Generated | ${report.generated_at} |`);
  lines.push(`| Schema | \`${report.schemaVersion}\` |`);
  lines.push(
    `| Path | ${report.whatWasRun.keyless ? "keyless doors / evidence" : "SARIF / explicit inputs"} |`,
  );
  if (report.whatWasRun.doorsLabel) {
    lines.push(`| Doors | ${report.whatWasRun.doorsLabel} |`);
  }
  lines.push(
    `| Historical GPU label | ${report.whatWasRun.historicalGpu ? "yes (checked-in evidence footnote only)" : "no — not invented"} |`,
  );
  lines.push(`| RunPod | **false** (this command does not start RunPod) |`);
  lines.push(``);

  lines.push(`### Sources`);
  lines.push(``);
  if (report.sources.length === 0) {
    lines.push(`_No sources (should not happen — fail-closed)._`);
  } else {
    for (const s of report.sources) {
      lines.push(
        `- **${s.kind}** — ${s.label}${s.schemaVersion ? ` (\`${s.schemaVersion}\`)` : ""}`,
      );
      lines.push(`  - \`${s.path}\``);
    }
  }
  lines.push(``);

  lines.push(`## Ranked files / findings`);
  lines.push(``);
  if (report.findings.length === 0) {
    lines.push(
      `_No ranked files in the supplied inputs. Empty localization is **not** a claim that the target is clean._`,
    );
    lines.push(``);
  } else {
    lines.push(`| Rank | Path | CWEs | Evidence |`);
    lines.push(`|------|------|------|----------|`);
    for (const f of report.findings) {
      const rank = f.rank ?? "—";
      const cwes = f.cweIds?.length ? f.cweIds.join(", ") : "—";
      const ev = f.evidence
        .map((e) => e.replace(/\|/g, "/"))
        .join("; ")
        .slice(0, 160);
      lines.push(`| ${rank} | \`${f.path}\` | ${cwes} | ${ev} |`);
    }
    lines.push(``);
  }

  lines.push(`## Explicit non-claims`);
  lines.push(``);
  for (const d of report.disclaimers) {
    lines.push(`- ${d}`);
  }
  lines.push(``);

  if (report.gpuFootnote) {
    const g = report.gpuFootnote;
    lines.push(`## Historical GPU footnote`);
    lines.push(``);
    lines.push(
      `_Checked-in Measured A40 evidence only — **not** live GPU, **does not** start RunPod._`,
    );
    lines.push(``);
    lines.push(`| | |`);
    lines.push(`|--|--|`);
    if (g.label) lines.push(`| Label | ${g.label} |`);
    if (g.podId) lines.push(`| Pod (historical) | \`${g.podId}\` |`);
    if (g.gpu) lines.push(`| GPU | ${g.gpu} |`);
    if (g.rankedFile) lines.push(`| Ranked file (historical) | \`${g.rankedFile}\` |`);
    lines.push(`| Source | \`${g.source}\` |`);
    lines.push(`| startsRunPod | false |`);
    lines.push(``);
  }

  lines.push(`---`);
  lines.push(``);
  lines.push(
    `_ZERODAY defensive localization harness — compose with human triage. Do not treat this summary as exploit proof._`,
  );
  lines.push(``);
  return lines.join("\n");
}

export function writeReportArtifacts(
  report: ZerodayReport,
  outPath: string,
  format: "markdown" | "json",
): string {
  const abs = path.resolve(outPath);
  try {
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    const body =
      format === "json"
        ? JSON.stringify(report, null, 2) + "\n"
        : formatReportMarkdown(report);
    fs.writeFileSync(abs, body, "utf8");
  } catch (e) {
    throw new ReportError(
      `report --out write failed: ${(e as Error).message}`,
      "WRITE_FAILED",
      e,
    );
  }
  return abs;
}

/** Honesty catalog for Desk GET/POST /api/report (no RunPod). */
export function reportCatalog() {
  return {
    kind: "report-catalog" as const,
    schemaVersion: REPORT_SCHEMA,
    endpoint: "POST /api/report",
    getEndpoint: "GET /api/report",
    cli: "zeroday report · npm run report",
    defaultFrom: REPORT_DEFAULT_FROM,
    defaultOutJson: REPORT_DEFAULT_OUT_JSON,
    defaultOutMd: REPORT_DEFAULT_OUT_MD,
    honesty: [
      "Reuses runReport (report-summary) — does not reimplement ranking/parsing",
      "CISO localization summary only — localization ≠ exploitability · needs_human",
      "Fail-closed: never invents findings / metrics / AUROC / File F1",
      "runpod: false — does not start RunPod / no GPU spend / no live Antares",
      "Inputs: prove-doors JSON path, inline prove-doors, and/or SARIF path on disk",
      "Desk returns zeroday.report/v1 JSON + markdown for browser download",
      "No PoC / exploit / payload · no auto-fix · no auto-merge",
    ],
  };
}
