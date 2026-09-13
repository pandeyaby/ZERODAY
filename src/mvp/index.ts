/**
 * Keyless MVP smoke — fixture locate + operate→verify → SARIF proof.
 * No GPU, no HF token, no remote inference, no spend.
 */

import fs from "node:fs";
import path from "node:path";
import { locate, defaultFixtureRepo } from "../locate/index.ts";
import { operate } from "../operate/index.ts";
import { verifyRunDir, type VerifyResult } from "../evidence/vault.ts";

export interface MvpOptions {
  /** Output root (default: zeroday-reports/mvp) */
  outputDir?: string;
  /** Advisory id (default: CWE-89) */
  cwe?: string;
}

export interface MvpStepResult {
  name: "locate" | "operate" | "verify";
  ok: boolean;
  detail: string;
  sarifPath?: string;
  runDir?: string;
}

export interface MvpResult {
  ok: boolean;
  cwe: string;
  outputDir: string;
  locateSarif: string;
  operateSarif: string;
  operateDir: string;
  verify: VerifyResult;
  steps: MvpStepResult[];
  /** Human-facing one-liner for PASS/FAIL banner */
  summary: string;
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * Run the offline MVP door: fixture locate, then operate→verify.
 * Always keyless / fixture — never touches live Antares or remote GPUs.
 */
export async function runMvp(options: MvpOptions = {}): Promise<MvpResult> {
  const cwe = options.cwe || "CWE-89";
  const outputDir = path.resolve(
    options.outputDir || path.join(process.cwd(), "zeroday-reports", "mvp"),
  );
  ensureDir(outputDir);

  const locateDir = path.join(outputDir, "locate");
  const operateDir = path.join(outputDir, "operate");
  const repo = defaultFixtureRepo();
  const steps: MvpStepResult[] = [];

  const locateArtifacts = await locate({
    repo,
    advisory: cwe,
    fixture: true,
    offline: true,
    outputDir: locateDir,
  });

  const locateOk =
    fs.existsSync(locateArtifacts.sarifPath) &&
    locateArtifacts.result.mode === "fixture" &&
    locateArtifacts.result.summary.findingCount >= 1;

  steps.push({
    name: "locate",
    ok: locateOk,
    detail: locateOk
      ? `fixture locate → ${locateArtifacts.sarifPath}`
      : "fixture locate did not produce SARIF with findings",
    sarifPath: locateArtifacts.sarifPath,
    runDir: locateArtifacts.outputDir,
  });

  const operateArtifacts = await operate({
    repo,
    advisory: cwe,
    fixture: true,
    offline: true,
    outputDir: operateDir,
  });

  const operateOk =
    fs.existsSync(operateArtifacts.sarifPath) &&
    operateArtifacts.result.summary.findingCount >= 1;

  steps.push({
    name: "operate",
    ok: operateOk,
    detail: operateOk
      ? `fixture operate → ${operateArtifacts.sarifPath}`
      : "fixture operate did not produce SARIF with findings",
    sarifPath: operateArtifacts.sarifPath,
    runDir: operateArtifacts.outputDir,
  });

  const verify = verifyRunDir(operateDir);
  steps.push({
    name: "verify",
    ok: verify.ok,
    detail: verify.ok
      ? `evidence hashes ok (${verify.checked} checked)`
      : `verify failed: ${verify.failures.map((f) => f.reason).join("; ")}`,
    runDir: operateDir,
  });

  const ok = steps.every((s) => s.ok);
  const summary = ok
    ? "PASS — keyless fixture MVP produced SARIF + verified evidence"
    : "FAIL — MVP smoke did not complete (see steps)";

  return {
    ok,
    cwe,
    outputDir,
    locateSarif: locateArtifacts.sarifPath,
    operateSarif: operateArtifacts.sarifPath,
    operateDir,
    verify,
    steps,
    summary,
  };
}

/** Format crisp PASS/FAIL banner for CLI / CI logs. */
export function formatMvpBanner(result: MvpResult): string {
  const lines: string[] = [
    "",
    "ZERODAY MVP",
    "───────────",
    result.ok ? "PASS" : "FAIL",
    result.summary,
    "",
    `CWE            : ${result.cwe}`,
    `Output         : ${result.outputDir}`,
    `Locate SARIF   : ${result.locateSarif}`,
    `Operate SARIF  : ${result.operateSarif}`,
    `Verify         : ${result.verify.ok ? "ok" : "failed"} (${result.verify.checked} checked)`,
    "",
    "Steps:",
  ];
  for (const step of result.steps) {
    lines.push(`  ${step.ok ? "✓" : "✗"} ${step.name.padEnd(8)} ${step.detail}`);
  }
  lines.push("");
  lines.push(
    "Honesty: fixture / recorded · not live Antares · localization ≠ exploitability · needs_human · no PoC · no auto-merge",
  );
  lines.push(
    "Live Antares (opt-in, costs $): npm run zeroday -- antares doctor",
  );
  lines.push("");
  return lines.join("\n");
}
