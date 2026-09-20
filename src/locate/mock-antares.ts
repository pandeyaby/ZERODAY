/**
 * CI / test Antares CLI stand-in that talks to a real OpenAI-compatible
 * POST /v1/completions endpoint and produces Antares-shaped report.json.
 *
 * Not a substitute for cisco-antares-cli in production. Used when tests inject
 * this binary via `antaresCliSource` / PATH so the live locate path can assert
 * tool-call → submit → ranked-files without GPU spend.
 */

import fs from "node:fs";
import path from "node:path";
import {
  normalizeCompletionsEndpoint,
  postCompletions,
} from "./completions";
import {
  extractSubmittedFiles,
  isSubmitToolCall,
  parseAntaresToolCalls,
  type AntaresToolCall,
} from "./tool-call";

export interface MockAntaresQueryParams {
  snapshotPath: string;
  outputDir: string;
  cweId: string;
  endpoint: string;
  model: string;
  toolBudget?: number;
  fetchImpl?: typeof fetch;
  /** Max completion rounds (terminal + submit). Default toolBudget or 8. */
  maxRounds?: number;
}

export interface MockAntaresQueryResult {
  reportPath: string;
  toolCalls: AntaresToolCall[];
  rankedFiles: string[];
  submitted: boolean;
  completionRounds: number;
}

function mapTool(name: string, command: string): string {
  if (name === "submit_vulnerable_files" || name === "submit_no_vulnerability_found") {
    return "submit";
  }
  const lower = `${name} ${command}`.toLowerCase();
  if (lower.includes("grep") || lower.includes("rg")) return "grep";
  if (lower.includes("find")) return "find";
  if (lower.includes("cat") || lower.includes("head") || lower.includes("less"))
    return "cat";
  if (lower.includes("ls") || lower.includes("tree")) return "ls";
  return "other";
}

/**
 * Drive a minimal Antares-compatible query against a completions endpoint.
 * Executes no shell against the snapshot — records tool_calls from the model
 * text and materializes findings only from submit_vulnerable_files.
 */
export async function runMockAntaresQuery(
  params: MockAntaresQueryParams,
): Promise<MockAntaresQueryResult> {
  const endpoint = normalizeCompletionsEndpoint(params.endpoint);
  const toolBudget = Math.max(1, Math.min(50, params.toolBudget ?? 30));
  const maxRounds = Math.max(1, params.maxRounds ?? Math.min(toolBudget, 8));
  fs.mkdirSync(params.outputDir, { recursive: true });

  const toolCalls: AntaresToolCall[] = [];
  const explorationTrace: Array<{
    step: number;
    tool: string;
    command: string;
    summary: string;
  }> = [];
  let rankedFiles: string[] = [];
  let submitted = false;
  let completionRounds = 0;

  let prompt =
    `Antares mock query CWE=${params.cweId} snapshot=${params.snapshotPath}\n` +
    `Emit <tool_call> JSON for terminal explore, then submit_vulnerable_files.\n`;

  for (let round = 0; round < maxRounds; round++) {
    completionRounds += 1;
    const post = await postCompletions({
      endpoint,
      model: params.model,
      prompt,
      maxTokens: 256,
      temperature: 0,
      stream: false,
      fetchImpl: params.fetchImpl,
      timeoutMs: 10_000,
    });
    if (!post.ok) {
      throw new Error(
        `mock-antares completions failed: ${post.detail}`,
      );
    }
    const calls = parseAntaresToolCalls(post.text);
    if (calls.length === 0) {
      prompt += `\n<assistant>${post.text.slice(0, 200)}</assistant>\n`;
      continue;
    }

    for (const call of calls) {
      toolCalls.push(call);
      const command =
        call.name === "terminal"
          ? String(call.arguments.command ?? "")
          : call.name;
      explorationTrace.push({
        step: explorationTrace.length + 1,
        tool: mapTool(call.name, command),
        command: command || call.name,
        summary:
          call.name === "terminal"
            ? `terminal: ${command}`
            : `tool=${call.name}`,
      });

      if (call.name === "submit_vulnerable_files") {
        rankedFiles = extractSubmittedFiles(call);
        submitted = true;
        explorationTrace[explorationTrace.length - 1]!.summary =
          rankedFiles.length > 0
            ? `Submitted ${rankedFiles.join(", ")}`
            : "submit_vulnerable_files (empty files list)";
        break;
      }
      if (call.name === "submit_no_vulnerability_found") {
        rankedFiles = [];
        submitted = true;
        explorationTrace[explorationTrace.length - 1]!.summary =
          "submit_no_vulnerability_found";
        break;
      }

      // Feed a tiny tool_response so the next completion turn can proceed.
      prompt +=
        `\n<tool_call>${call.raw}</tool_call>\n` +
        `<tool_response>ok (mock; no shell executed)</tool_response>\n`;
    }
    if (submitted) break;
  }

  const findings = rankedFiles.map((filePath, i) => ({
    file_path: filePath,
    submission_rank: i + 1,
    cwe_ids: [params.cweId],
    title: `Candidate for ${params.cweId}`,
    rationale:
      "Mock Antares CLI submitted this path from a completions tool_call (CI; not live GPU).",
  }));

  const report = {
    findings,
    summary: {
      total_findings: findings.length,
      terminal_calls_used: explorationTrace.filter((t) => t.tool !== "submit")
        .length,
      incomplete_reason: submitted
        ? null
        : "no submit_vulnerable_files / submit_no_vulnerability_found",
    },
    metadata: {
      model: params.model,
      terminal_call_budget: toolBudget,
      mock_antares: true,
    },
    warnings: [
      "ZERODAY mock Antares CLI — CI/tool-call path only. Not cisco-antares-cli. Not Antares File F1.",
    ],
    exploration_trace: explorationTrace,
  };

  const reportPath = path.join(params.outputDir, "report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");

  return {
    reportPath,
    toolCalls,
    rankedFiles,
    submitted,
    completionRounds,
  };
}

/** CLI argv parser compatible with `antares query` subset used by ZERODAY. */
export function parseMockAntaresArgv(argv: string[]): {
  command: string;
  snapshotPath?: string;
  cweId?: string;
  outputDir?: string;
  model?: string;
  endpoint?: string;
  toolBudget?: number;
} {
  const args = [...argv];
  const command = args.shift() ?? "";
  const snapshotPath = args[0]?.startsWith("-") ? undefined : args.shift();
  let cweId: string | undefined;
  let outputDir: string | undefined;
  let model: string | undefined;
  let endpoint: string | undefined;
  let toolBudget: number | undefined;
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    const next = args[i + 1];
    if (a === "--cwe" && next) {
      cweId = next;
      i++;
    } else if (a === "--output" && next) {
      outputDir = next;
      i++;
    } else if (a === "--model" && next) {
      model = next;
      i++;
    } else if (a === "--endpoint" && next) {
      endpoint = next;
      i++;
    } else if (a === "--tool-budget" && next) {
      toolBudget = Number(next);
      i++;
    }
  }
  return { command, snapshotPath, cweId, outputDir, model, endpoint, toolBudget };
}

/**
 * Entry used by scripts/mock-antares-cli.mjs — sync-friendly async main.
 */
export async function mockAntaresMain(
  argv: string[],
  opts?: { fetchImpl?: typeof fetch },
): Promise<number> {
  const parsed = parseMockAntaresArgv(argv);
  if (parsed.command === "--version" || parsed.command === "version") {
    process.stdout.write("mock-antares-cli 0.0.0 (ZERODAY CI)\n");
    return 0;
  }
  if (parsed.command !== "query") {
    process.stderr.write(
      `mock-antares-cli: unsupported command '${parsed.command}' (supports: query)\n`,
    );
    return 2;
  }
  if (!parsed.snapshotPath || !parsed.cweId || !parsed.outputDir) {
    process.stderr.write(
      "mock-antares-cli query requires PATH --cwe --output [--endpoint] [--model]\n",
    );
    return 2;
  }
  if (!parsed.endpoint) {
    process.stderr.write("mock-antares-cli: --endpoint is required\n");
    return 2;
  }
  const result = await runMockAntaresQuery({
    snapshotPath: parsed.snapshotPath,
    outputDir: parsed.outputDir,
    cweId: parsed.cweId,
    endpoint: parsed.endpoint,
    model: parsed.model ?? "mock/antares-tool-calls",
    toolBudget: parsed.toolBudget,
    fetchImpl: opts?.fetchImpl,
  });
  process.stdout.write(
    `mock-antares-cli: wrote ${result.reportPath} ` +
      `(tool_calls=${result.toolCalls.length} submitted=${result.submitted})\n`,
  );
  // Surface whether we saw real tool calls (for honest CI assertions)
  if (result.toolCalls.length === 0) {
    process.stderr.write("mock-antares-cli: zero tool_calls parsed from completions\n");
    return 1;
  }
  if (!result.toolCalls.some(isSubmitToolCall)) {
    process.stderr.write("mock-antares-cli: no submit_* tool_call\n");
    return 1;
  }
  return 0;
}
