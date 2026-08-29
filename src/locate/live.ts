/**
 * Live Antares path: prefer Cisco's official `antares` CLI
 * (`uv tool install cisco-antares-cli` — public on PyPI).
 *
 * Model weights remain gated on Hugging Face — we never download or bypass that.
 * Live inference requires a local OpenAI-compatible POST /v1/completions endpoint
 * (chat completions are rejected by Antares).
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { AdvisoryRef, LocalizationResult, RankedFile, TraceStep } from "./types";

export interface LiveLocateParams {
  advisory: AdvisoryRef;
  repo: string;
  snapshotPath: string;
  outputDir: string;
  endpoint?: string;
  model?: string;
  antaresCliSource?: string;
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
  "and serve locally with vLLM (`vllm serve fdtn-ai/antares-1b`) exposing POST /v1/completions. " +
  "Do not use /v1/chat/completions.";

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

  const args = [
    "query",
    params.snapshotPath,
    "--cwe",
    params.advisory.cweId,
    "--output",
    params.outputDir,
  ];

  if (params.endpoint) {
    const endpoint = params.endpoint.endsWith("/v1/completions")
      ? params.endpoint
      : `${params.endpoint.replace(/\/$/, "")}/v1/completions`;
    args.push("--endpoint", endpoint);
  }
  if (params.model) {
    args.push("--model", params.model);
  }

  const env = { ...process.env };
  if (!params.model) {
    delete env.ANTARES_MODEL;
  }

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
        `Live inference needs a local completions endpoint (not chat). ${err}`,
    );
  }

  return adaptAntaresReport(
    JSON.parse(fs.readFileSync(reportJsonPath, "utf8")),
    params,
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

  return {
    mode: "live",
    advisory: params.advisory,
    targetRepo: path.resolve(params.repo),
    snapshotPath: params.snapshotPath,
    model: String(metadata.model ?? params.model ?? "antares-live"),
    generatedAt: new Date().toISOString(),
    rankedFiles,
    explorationTrace,
    warnings: [
      ...warnings,
      "Live mode used the official Antares CLI (cisco-antares-cli) against a read-only snapshot.",
      "Inference must be POST /v1/completions only — chat completions break the Antares tool prompt.",
    ],
    posture: {
      localizationOnly: true,
      notExploitProof: true,
      noAutoMerge: true,
      noPoC: true,
    },
    summary: {
      findingCount: rankedFiles.length,
      incompleteReason:
        (summary.incomplete_reason as string | null | undefined) ?? null,
      terminalCallBudget: Number(metadata.terminal_call_budget ?? 15),
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
