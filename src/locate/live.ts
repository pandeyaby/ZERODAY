/**
 * Live Antares path: WRAP Cisco's official `antares` CLI
 * (`uv tool install cisco-antares-cli` — public on PyPI).
 *
 * cisco-antares-cli v0.1.0 provides: query, sweep, plan (no inference),
 * reports json/md/sarif, --export FILE.tar.gz. There is NO `antares locate`.
 * ZERODAY `zeroday locate` wraps `antares query` — we do not reimplement the CLI.
 *
 * Model weights remain gated on Hugging Face — we never download or bypass that.
 * Live inference requires a local OpenAI-compatible POST /v1/completions endpoint
 * (chat completions are rejected by Antares). Antares CLI expects vLLM 0.19.1+.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { AdvisoryRef, LocalizationResult, RankedFile, TraceStep } from "./types";
import { normalizeCompletionsEndpoint } from "./completions";
import { resolveLiveModel, DEFAULT_ANTARES_MODEL } from "./model";

export interface LiveLocateParams {
  advisory: AdvisoryRef;
  repo: string;
  snapshotPath: string;
  outputDir: string;
  endpoint?: string;
  model?: string;
  antaresCliSource?: string;
  /** Antares --tool-budget (1–50). Increase when runs end incomplete without submit. */
  toolBudget?: number;
}

function which(cmd: string): string | null {
  const r = spawnSync("sh", ["-c", `command -v ${cmd}`], { encoding: "utf8" });
  const out = (r.stdout || "").trim();
  return out || null;
}

export const ANTARES_INSTALL_HINT =
  "Install the official CLI from PyPI: `uv tool install cisco-antares-cli` " +
  "then ensure `$(uv tool dir --bin)` is on PATH. " +
  "Model weights stay gated — accept Cisco terms on https://huggingface.co/fdtn-ai/antares-1b " +
  "and serve locally with vLLM 0.19.1+ (`vllm serve fdtn-ai/antares-1b`) exposing POST /v1/completions. " +
  "Do not use /v1/chat/completions. Do not clone antares-cli onto operator machines — install from PyPI.";

export function detectAntaresCli(): {
  binary: string | null;
  sourceHint: string;
} {
  return {
    binary: which("antares"),
    sourceHint: ANTARES_INSTALL_HINT,
  };
}

/**
 * Local-only CWE portfolio preview via `antares plan` (no inference).
 */
export function runAntaresPlan(
  repoPath: string,
  opts?: { maxCwes?: number; cwe?: string; format?: "json" | "summary" },
): { ok: boolean; stdout: string; stderr: string; status: number | null } {
  const detected = detectAntaresCli();
  if (!detected.binary) {
    return {
      ok: false,
      stdout: "",
      stderr: detected.sourceHint,
      status: null,
    };
  }
  const args = ["plan", path.resolve(repoPath)];
  if (opts?.cwe) {
    args.push("--cwe", opts.cwe);
  } else if (opts?.maxCwes) {
    args.push("--max-cwes", String(opts.maxCwes));
  }
  args.push("--format", opts?.format ?? "json");

  const run = spawnSync(detected.binary, args, {
    encoding: "utf8",
    timeout: 120_000,
  });
  return {
    ok: run.status === 0,
    stdout: run.stdout || "",
    stderr: run.stderr || "",
    status: run.status,
  };
}

/**
 * Invoke official `antares query` against a read-only snapshot.
 * Requires a configured local /v1/completions endpoint — not used in fixture mode.
 */
export function runLiveAntaresCli(params: LiveLocateParams): LocalizationResult {
  const detected = detectAntaresCli();
  if (!detected.binary) {
    throw new Error(
      `Official Antares CLI not found on PATH. ${detected.sourceHint} ` +
        `Or use --fixture for offline recorded localizations.`,
    );
  }

  fs.mkdirSync(params.outputDir, { recursive: true });

  // Antares CLI requires an explicit model ID — never omit on live path.
  const model = resolveLiveModel(params.model);

  const args = [
    "query",
    params.snapshotPath,
    "--cwe",
    params.advisory.cweId,
    "--output",
    params.outputDir,
    "--model",
    model,
  ];

  if (params.endpoint) {
    args.push("--endpoint", normalizeCompletionsEndpoint(params.endpoint));
  }
  if (
    typeof params.toolBudget === "number" &&
    Number.isFinite(params.toolBudget) &&
    params.toolBudget >= 1
  ) {
    args.push("--tool-budget", String(Math.min(50, Math.floor(params.toolBudget))));
  }

  const env = { ...process.env, ANTARES_MODEL: model };

  const run = spawnSync(detected.binary, args, {
    encoding: "utf8",
    env,
    timeout: 30 * 60 * 1000,
  });

  const reportJsonPath = path.join(params.outputDir, "report.json");
  if (!fs.existsSync(reportJsonPath)) {
    const err = (run.stderr || run.stdout || "").slice(0, 2000);
    throw new Error(
      `antares query did not produce report.json (exit ${run.status}). ` +
        `Live inference needs a local completions endpoint (not chat) and model id ` +
        `\`${model}\` (override with --model / ANTARES_MODEL). ${err}`,
    );
  }

  return adaptAntaresReport(
    JSON.parse(fs.readFileSync(reportJsonPath, "utf8")),
    { ...params, model },
  );
}

/** Adapt Antares report.json into ZERODAY LocalizationResult. */
export function adaptAntaresReport(
  report: Record<string, unknown>,
  params: LiveLocateParams,
): LocalizationResult {
  const findings = (report.findings as Array<Record<string, unknown>> | undefined) ?? [];
  const summary = (report.summary as Record<string, unknown> | undefined) ?? {};
  const metadata = (report.metadata as Record<string, unknown> | undefined) ?? {};
  const warnings = (report.warnings as string[] | undefined) ?? [];

  const rankedFiles: RankedFile[] = findings.map((f, i) => ({
    filePath: String(f.file_path ?? f.filePath ?? "unknown"),
    rank: Number(f.submission_rank ?? i + 1),
    cweIds: Array.isArray(f.cwe_ids)
      ? (f.cwe_ids as string[])
      : [params.advisory.cweId],
    title: String(f.title ?? `Candidate for ${params.advisory.cweId}`),
    evidence: [
      {
        filePath: String(f.file_path ?? "unknown"),
        note: String(
          f.rationale ??
            f.message ??
            "Antares submitted this file as a localization candidate.",
        ),
        excerpt: typeof f.excerpt === "string" ? f.excerpt : undefined,
        startLine:
          typeof f.start_line === "number"
            ? f.start_line
            : typeof f.line === "number"
              ? f.line
              : undefined,
      },
    ],
    likelihoodOfExploit:
      typeof f.likelihood_of_exploit === "string"
        ? f.likelihood_of_exploit
        : undefined,
  }));

  const traceRaw =
    (report.exploration_trace as Array<Record<string, unknown>> | undefined) ??
    (report.trace as Array<Record<string, unknown>> | undefined) ??
    [];

  const explorationTrace: TraceStep[] = traceRaw.map((t, i) => ({
    step: Number(t.step ?? i + 1),
    tool: mapTool(String(t.tool ?? t.command ?? "other")),
    command: String(t.command ?? t.args ?? ""),
    summary: String(t.summary ?? t.output_preview ?? t.result ?? ""),
  }));

  if (explorationTrace.length === 0) {
    explorationTrace.push({
      step: 1,
      tool: "other",
      command: "antares query",
      summary:
        "Live Antares CLI run (trace not present in report.json; see Antares private history under ANTARES_DATA_DIR).",
    });
  }

  const submitted =
    explorationTrace.some((t) => t.tool === "submit") ||
    explorationTrace.some((t) =>
      /submit_(vulnerable_files|no_vulnerability_found)/i.test(t.command),
    );

  let incompleteReason: string | null =
    (summary.incomplete_reason as string | null | undefined) ?? null;
  if (!incompleteReason && rankedFiles.length === 0 && !submitted) {
    incompleteReason =
      "Antares ended without submit_vulnerable_files / submit_no_vulnerability_found " +
      "(incomplete localization — not a clean negative). " +
      "Tips: check completions server health; on Mac MPS use greedy decoding " +
      "(see scripts/completions_server.py); increase tool budget " +
      "(`zeroday locate … --tool-budget 30` or `antares query --tool-budget 30`). " +
      "Do not invent findings.";
  }

  const modelId = resolveLiveModel(
    typeof metadata.model === "string" ? metadata.model : params.model,
  );

  return {
    mode: "live",
    advisory: params.advisory,
    targetRepo: path.resolve(params.repo),
    snapshotPath: params.snapshotPath,
    model: modelId,
    generatedAt: new Date().toISOString(),
    rankedFiles,
    explorationTrace,
    warnings: [
      ...warnings,
      "Live mode used the official Antares CLI (cisco-antares-cli) against a read-only snapshot.",
      "Inference must be POST /v1/completions only — chat completions break the Antares tool prompt.",
      `Model id sent to endpoint: ${modelId} (default ${DEFAULT_ANTARES_MODEL} when unset).`,
      ...(incompleteReason
        ? [
            `Incomplete submission: ${incompleteReason}`,
          ]
        : []),
    ],
    posture: {
      localizationOnly: true,
      notExploitProof: true,
      noAutoMerge: true,
      noPoC: true,
    },
    summary: {
      findingCount: rankedFiles.length,
      incompleteReason,
      terminalCallBudget: Number(
        metadata.terminal_call_budget ??
          metadata.tool_budget ??
          params.toolBudget ??
          15,
      ),
      terminalCallsUsed: Number(
        summary.terminal_calls_used ?? explorationTrace.length,
      ),
    },
  };
}

function mapTool(s: string): TraceStep["tool"] {
  const lower = s.toLowerCase();
  if (lower.includes("grep") || lower.includes("rg")) return "grep";
  if (lower.includes("find")) return "find";
  if (lower.includes("cat") || lower.includes("head") || lower.includes("less"))
    return "cat";
  if (lower.includes("ls") || lower.includes("tree")) return "ls";
  if (lower.includes("submit")) return "submit";
  return "other";
}

export function runAntaresSweep(
  repoPath: string,
  opts?: {
    maxCwes?: number;
    workers?: number;
    cwe?: string;
    endpoint?: string;
    model?: string;
    output?: string;
    noTui?: boolean;
  },
): { ok: boolean; stdout: string; stderr: string; status: number | null } {
  const detected = detectAntaresCli();
  if (!detected.binary) {
    return {
      ok: false,
      stdout: "",
      stderr: detected.sourceHint,
      status: null,
    };
  }
  const args = ["sweep", path.resolve(repoPath)];
  if (opts?.cwe) {
    args.push("--cwe", opts.cwe);
  } else if (opts?.maxCwes) {
    args.push("--max-cwes", String(opts.maxCwes));
  }
  if (opts?.workers) {
    args.push("--workers", String(opts.workers));
  }
  if (opts?.endpoint) {
    args.push("--endpoint", normalizeCompletionsEndpoint(opts.endpoint));
  }
  args.push("--model", resolveLiveModel(opts?.model));
  if (opts?.output) {
    args.push("--output", path.resolve(opts.output));
  }
  // Headless by default for ZERODAY wrap
  if (opts?.noTui !== false) {
    args.push("--no-tui");
  }

  const run = spawnSync(detected.binary, args, {
    encoding: "utf8",
    timeout: 600_000,
  });
  return {
    ok: run.status === 0,
    stdout: run.stdout || "",
    stderr: run.stderr || "",
    status: run.status,
  };
}

/**
 * Probe whether a local OpenAI-compatible endpoint looks reachable.
 * Does not send repository source.
 */
export async function probeLocalEndpoint(
  endpoint: string,
): Promise<{ ok: boolean; detail: string }> {
  const base = endpoint.replace(/\/v1\/completions\/?$/, "").replace(/\/$/, "");
  const modelsUrl = `${base}/v1/models`;
  try {
    const res = await fetch(modelsUrl, {
      signal: AbortSignal.timeout(3000),
    });
    return {
      ok: res.ok,
      detail: `GET ${modelsUrl} → ${res.status}`,
    };
  } catch (e) {
    return {
      ok: false,
      detail: `GET ${modelsUrl} failed: ${(e as Error).message}`,
    };
  }
}
