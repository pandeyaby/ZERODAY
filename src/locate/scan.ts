/**
 * `zeroday scan --repo <path>` — look for anything, no CWE needed.
 *
 * 1. ZERODAY's rules engine runs every CWE it covers on one read-only snapshot.
 * 2. When an Antares endpoint is available (`antares up`, saved Desk endpoint,
 *    local vLLM / Ollama / LM Studio, or ANTARES_ENDPOINT), the official CLI
 *    picks the CWEs that fit this repository (`antares plan`, local, no
 *    inference) and investigates them in parallel (`antares sweep`). The rules
 *    findings are sent as starting context only with `context: true`.
 * 3. One ranked list: files both flagged first, then Antares-only, then
 *    rules-only — each with the CWEs and who flagged it — plus a per-CWE table,
 *    SARIF, report.md and a hash-verified evidence folder.
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createSnapshot, destroySnapshot } from "./snapshot";
import { runRulesLocalization, RULES_SUPPORTED_CWES } from "./rules/index";
import { discoverLiveEndpoint } from "./discover";
import { assertLiveEndpointHealthy, resolveLocateMode } from "./live-guard";
import { normalizeCompletionsEndpoint } from "./completions";
import { adaptAntaresReport, detectAntaresCli } from "./live";
import { toSarif } from "./sarif";
import { EvidenceVault } from "../evidence/vault";
import type { LocalizationResult, RankedFile } from "./types";

export interface ScanOptions {
  repo: string;
  outputDir?: string;
  /** auto: use Antares when one is found · off: rules only · require: fail without Antares */
  antares?: "auto" | "off" | "require";
  endpoint?: string;
  model?: string;
  remoteInference?: boolean;
  /** CWEs Antares investigates (chosen by `antares plan`). Default 8. */
  maxCwes?: number;
  /** Explicit CWE list for Antares instead of automatic selection. */
  cwes?: string[];
  workers?: number;
  toolBudget?: number;
  /** Also send the rules findings to Antares via --query (default off; always compared). */
  context?: boolean;
}

export interface ScanCweRow {
  cwe: string;
  rules: number;
  antares: number;
  both: number;
  /** Planned for Antares (auto-selected or explicit). */
  antaresPlanned: boolean;
}

export interface ScanSummary {
  cwesRules: string[];
  cwesAntares: string[];
  perCwe: ScanCweRow[];
  antares: null | {
    endpoint: string;
    model: string;
    source: string;
    seconds: number;
    toolCalls: number | null;
    failedToolCalls: number | null;
    incomplete: string | null;
  };
  antaresSkipped?: string;
}

export interface ScanArtifacts {
  result: LocalizationResult & { summary: LocalizationResult["summary"] & { scan: ScanSummary } };
  outputDir: string;
  jsonPath: string;
  sarifPath: string;
  reportPath: string;
  manifestPath: string;
}

interface Merged {
  filePath: string;
  cwes: Set<string>;
  sources: Set<"antares" | "rules">;
  rules: RankedFile[];
  antares: RankedFile[];
}

/** Rules findings summarized as Antares context, grouped by CWE, bounded. */
export function scanContext(rulesByCwe: Map<string, RankedFile[]>, forCwes: string[]): string {
  const lines: string[] = [];
  for (const cwe of forCwes) {
    const files = rulesByCwe.get(cwe) ?? [];
    if (!files.length) continue;
    lines.push(
      `- ${cwe}: ${files
        .slice(0, 4)
        .map((f) => `${f.filePath}${f.evidence[0]?.startLine ? `:${f.evidence[0].startLine}` : ""}`)
        .join(", ")}`,
    );
  }
  if (!lines.length) return "";
  const text = [
    "ZERODAY static pre-analysis of this repository (may be incomplete or wrong):",
    ...lines,
    "Read these first, but confirm each by reading the code, look beyond them, and submit only files you confirm.",
  ].join("\n");
  return text.length <= 1500 ? text : `${text.slice(0, 1499)}…`;
}

function antaresPlan(bin: string, snapshot: string, maxCwes: number): string[] {
  const r = spawnSync(bin, ["plan", snapshot, "--max-cwes", String(maxCwes), "--format", "json"], {
    encoding: "utf8",
    timeout: 180_000,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.status !== 0) throw new Error(`antares plan failed (exit ${r.status}): ${(r.stderr || r.stdout).slice(0, 800)}`);
  const plan = JSON.parse(r.stdout) as { selected_cwe_ids?: string[] };
  return (plan.selected_cwe_ids ?? []).slice(0, maxCwes);
}

export async function scanRepo(opts: ScanOptions): Promise<ScanArtifacts> {
  const repo = path.resolve(opts.repo);
  if (!fs.existsSync(repo) || !fs.statSync(repo).isDirectory()) throw new Error(`Not a directory: ${repo}`);
  const outputDir = path.resolve(opts.outputDir ?? path.join(process.cwd(), "zeroday-reports", `scan-${Date.now()}`));
  fs.mkdirSync(outputDir, { recursive: true });
  const mode = opts.antares ?? "auto";
  const warnings: string[] = [];
  const snap = createSnapshot(repo);
  try {
    // 1 · rules, every covered CWE, one snapshot
    const rulesByCwe = new Map<string, RankedFile[]>();
    for (const cwe of RULES_SUPPORTED_CWES) {
      const r = await runRulesLocalization({ kind: "cwe", id: cwe, cweId: cwe }, snap.snapshotPath, { offline: true });
      rulesByCwe.set(cwe, r.rankedFiles.map((f) => ({ ...f, cweIds: [cwe] })));
    }

    // 2 · Antares, when available
    let antaresFiles: RankedFile[] = [];
    let antaresInfo: ScanSummary["antares"] = null;
    let antaresCwes: string[] = [];
    let skipped: string | undefined;
    if (mode !== "off") {
      try {
        const cli = detectAntaresCli();
        if (!cli.binary) throw new Error(`Antares CLI not installed. ${cli.sourceHint}`);
        let endpoint = opts.endpoint;
        let model = opts.model;
        let remoteInference = opts.remoteInference === true;
        let source = "--endpoint";
        if (!endpoint) {
          const d = await discoverLiveEndpoint({ ...(opts.model ? { model: opts.model } : {}) });
          endpoint = d.endpoint;
          model = model ?? d.model;
          remoteInference = remoteInference || d.remoteInference === true;
          source = d.detail;
        }
        model = model ?? "fdtn-ai/antares-1b";
        resolveLocateMode({ live: true, endpoint, remoteInference });
        await assertLiveEndpointHealthy({ endpoint: normalizeCompletionsEndpoint(endpoint) });

        antaresCwes = opts.cwes?.length ? opts.cwes : antaresPlan(cli.binary, snap.snapshotPath, opts.maxCwes ?? 8);
        if (!antaresCwes.length) throw new Error("antares plan selected no CWEs for this repository");
        const query = opts.context === true ? scanContext(rulesByCwe, antaresCwes) : "";
        const rawDir = path.join(outputDir, "antares-raw");
        const args = [
          "sweep",
          snap.snapshotPath,
          "--cwe",
          antaresCwes.join(","),
          "--endpoint",
          normalizeCompletionsEndpoint(endpoint),
          "--model",
          model,
          "--output",
          rawDir,
          "--report-format",
          "json",
          "--no-tui",
          "--workers",
          String(opts.workers ?? 8),
          ...(opts.toolBudget ? ["--tool-budget", String(opts.toolBudget)] : []),
          ...(query ? ["--query", query] : []),
        ];
        const t0 = Date.now();
        const run = spawnSync(cli.binary, args, {
          encoding: "utf8",
          env: { ...process.env, ANTARES_MODEL: model },
          timeout: 60 * 60 * 1000,
          maxBuffer: 64 * 1024 * 1024,
        });
        const reportPath = path.join(rawDir, "report.json");
        if (!fs.existsSync(reportPath)) {
          throw new Error(`antares sweep produced no report.json (exit ${run.status}): ${`${run.stderr}\n${run.stdout}`.trim().slice(0, 1200)}`);
        }
        const raw = JSON.parse(fs.readFileSync(reportPath, "utf8")) as Record<string, unknown>;
        const adapted = adaptAntaresReport(raw, {
          advisory: { kind: "cwe", id: antaresCwes[0]!, cweId: antaresCwes[0]! },
          repo,
          snapshotPath: snap.snapshotPath,
          outputDir: rawDir,
          endpoint,
          model,
        });
        antaresFiles = adapted.rankedFiles;
        const s = (raw.summary ?? {}) as Record<string, unknown>;
        antaresInfo = {
          endpoint: endpoint.replace(/\/completions$/, ""),
          model,
          source,
          seconds: Math.round((Date.now() - t0) / 1000),
          toolCalls: typeof s.tool_call_count === "number" ? s.tool_call_count : null,
          failedToolCalls: typeof s.failed_tool_calls === "number" ? s.failed_tool_calls : null,
          incomplete: typeof s.incomplete_reason === "string" ? s.incomplete_reason : null,
        };
        if (query) warnings.push(`ZERODAY rules findings for ${antaresCwes.length} planned CWE(s) sent to Antares as starting context (--query).`);
      } catch (e) {
        if (mode === "require") throw e;
        skipped = (e as Error).message.split("\n")[0]!;
        warnings.push(`Antares not used: ${skipped} — start one with \`zeroday antares up\`, or scan with rules only.`);
      }
    }

    // 3 · merge
    const merged = new Map<string, Merged>();
    const get = (p: string) => {
      let m = merged.get(p);
      if (!m) {
        m = { filePath: p, cwes: new Set(), sources: new Set(), rules: [], antares: [] };
        merged.set(p, m);
      }
      return m;
    };
    for (const [cwe, files] of rulesByCwe) {
      for (const f of files) {
        const m = get(f.filePath);
        m.cwes.add(cwe);
        m.sources.add("rules");
        m.rules.push(f);
      }
    }
    for (const f of antaresFiles) {
      const m = get(f.filePath);
      for (const c of f.cweIds) m.cwes.add(c);
      m.sources.add("antares");
      m.antares.push(f);
    }
    const tier = (m: Merged) => (m.sources.size === 2 ? 0 : m.sources.has("antares") ? 1 : 2);
    const ordered = [...merged.values()].sort(
      (a, b) =>
        tier(a) - tier(b) ||
        Math.min(...a.rules.map((r) => r.rank), 99) - Math.min(...b.rules.map((r) => r.rank), 99) ||
        b.cwes.size - a.cwes.size ||
        a.filePath.localeCompare(b.filePath),
    );
    const rankedFiles: RankedFile[] = ordered.map((m, i) => {
      const who = m.sources.size === 2 ? "Antares and rules" : m.sources.has("antares") ? "Antares" : "Rules";
      const title = m.antares[0]?.title ?? m.rules[0]?.title ?? "Candidate";
      return {
        filePath: m.filePath,
        rank: i + 1,
        cweIds: [...m.cwes].sort(),
        title: `${title} — ${who}`,
        sources: [...m.sources].sort() as Array<"antares" | "rules">,
        evidence: [
          ...m.rules.map((r) => ({ ...r.evidence[0]!, note: `${r.cweIds[0]}: ${r.evidence[0]?.note ?? r.title}` })),
          ...m.antares.map((a) => ({ filePath: a.filePath, note: `Antares (${a.cweIds.join(", ")}): ${a.title}` })),
        ],
      };
    });

    const allCwes = [...new Set([...RULES_SUPPORTED_CWES, ...antaresCwes])];
    const perCwe: ScanCweRow[] = allCwes.map((cwe) => {
      const r = new Set((rulesByCwe.get(cwe) ?? []).map((f) => f.filePath));
      const a = new Set(antaresFiles.filter((f) => f.cweIds.includes(cwe)).map((f) => f.filePath));
      return { cwe, rules: r.size, antares: a.size, both: [...a].filter((p) => r.has(p)).length, antaresPlanned: antaresCwes.includes(cwe) };
    });

    const scan: ScanSummary = {
      cwesRules: [...RULES_SUPPORTED_CWES],
      cwesAntares: antaresCwes,
      perCwe,
      antares: antaresInfo,
      ...(skipped ? { antaresSkipped: skipped } : {}),
    };
    const result = {
      mode: antaresInfo ? ("live" as const) : ("rules" as const),
      advisory: { kind: "cwe" as const, id: "SCAN", cweId: allCwes[0]!, title: `Scan: ${allCwes.length} CWEs` },
      targetRepo: repo,
      model: antaresInfo ? antaresInfo.model : "zeroday/rules-heuristics",
      generatedAt: new Date().toISOString(),
      rankedFiles,
      explorationTrace: [],
      warnings: [
        ...warnings,
        `Read-only snapshot: ${snap.fileCount} files (destroyed after run)`,
        "Localization only: candidates for human review — not proof of exploitability.",
      ],
      posture: { localizationOnly: true as const, notExploitProof: true as const, noAutoMerge: true as const, noPoC: true as const },
      summary: {
        findingCount: rankedFiles.length,
        needs_human: true as const,
        incompleteReason: antaresInfo?.incomplete ?? null,
        terminalCallBudget: 0,
        terminalCallsUsed: antaresInfo?.toolCalls ?? 0,
        scan,
      },
    } as unknown as ScanArtifacts["result"];

    const jsonPath = path.join(outputDir, "report.json");
    const sarifPath = path.join(outputDir, "report.sarif");
    const reportPath = path.join(outputDir, "report.md");
    fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2));
    fs.writeFileSync(sarifPath, JSON.stringify(toSarif(result), null, 2));
    fs.writeFileSync(reportPath, scanReport(result));
    const vault = new EvidenceVault(outputDir, path.basename(outputDir));
    vault.putBlob("input", "inputs/scan.json", JSON.stringify({ repo, antaresCwes, at: result.generatedAt }, null, 2), {
      title: "Scan inputs",
      summary: `${allCwes.length} CWEs`,
      tags: ["input", "scan"],
    });
    for (const f of rankedFiles) vault.putClaim(`Candidate: ${f.filePath}`, `${f.cweIds.join(", ")} (rank ${f.rank})`, []);
    for (const p of [jsonPath, sarifPath, reportPath]) vault.registerArtifact(p);
    const manifestPath = vault.flush();
    return { result, outputDir, jsonPath, sarifPath, reportPath, manifestPath };
  } finally {
    destroySnapshot(snap.snapshotPath);
  }
}

export function scanReport(result: ScanArtifacts["result"]): string {
  const s = result.summary.scan;
  const L: string[] = [];
  L.push(`# ZERODAY scan — ${path.basename(result.targetRepo)}`);
  L.push("");
  L.push("> **Human review required.** Candidates, not proof of exploitability. No exploit code. No auto-merge.");
  L.push("");
  L.push(
    s.antares
      ? `Rules: ${s.cwesRules.length} CWEs. Antares (\`${s.antares.model}\`): ${s.cwesAntares.length} CWEs chosen for this repository by \`antares plan\`, ${s.antares.toolCalls ?? "?"} tool calls in ${s.antares.seconds}s.`
      : `Rules only (${s.cwesRules.length} CWEs). Antares not used: ${s.antaresSkipped ?? "disabled"}.`,
  );
  L.push("");
  L.push("## By CWE");
  L.push("");
  L.push("| CWE | Rules | Antares | Both |");
  L.push("|-----|------:|--------:|-----:|");
  for (const r of s.perCwe) {
    if (!r.rules && !r.antares && !r.antaresPlanned) continue;
    L.push(`| ${r.cwe} | ${r.rules} | ${r.antaresPlanned ? r.antares : "—"} | ${r.antaresPlanned ? r.both : "—"} |`);
  }
  L.push("");
  L.push("## Files");
  L.push("");
  for (const f of result.rankedFiles) {
    L.push(`### ${f.rank}. \`${f.filePath}\` — ${f.cweIds.join(", ")}`);
    L.push("");
    L.push(`Flagged by: ${(f.sources ?? []).join(" + ")}`);
    L.push("");
    for (const e of f.evidence.slice(0, 4)) {
      L.push(`- ${e.startLine ? `line ${e.startLine}: ` : ""}${e.note}`);
      if (e.excerpt) L.push(`\n  \`\`\`\n  ${e.excerpt.split("\n").slice(0, 4).join("\n  ")}\n  \`\`\``);
    }
    L.push("");
  }
  return L.join("\n") + "\n";
}
