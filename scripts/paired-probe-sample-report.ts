#!/usr/bin/env npx tsx
/**
 * scripts/paired-probe-sample-report.ts
 *
 * Keyless: emit paired probes (if needed) → regenerate checked-in
 * DIPTYCH-shaped **sample** grade report under docs/reports/.
 *
 * No DIPTYCH clone. No GPU. Sample ≠ live DIPTYCH harness claim.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { runAllPairedProbes } from "../src/locate/paired-probes/run-all.ts";
import {
  loadMatrixOrJustifications,
  writeSampleGradeReport,
} from "../src/locate/paired-probes/sample-report.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EMIT_ROOT = path.join(ROOT, "zeroday-reports");
const OUT_DIR = path.join(ROOT, "docs/reports");

async function main(): Promise<void> {
  console.log("ZERODAY paired-probe → DIPTYCH sample grade report");
  console.log("─────────────────────────────────────────────────");
  console.log("Emit root :", EMIT_ROOT);
  console.log("Out dir   :", OUT_DIR);
  console.log("");

  // Always re-emit so the sample tracks current envelope shape (deterministic fixtures).
  await runAllPairedProbes(EMIT_ROOT);
  const matrix = loadMatrixOrJustifications(EMIT_ROOT);
  const { report, mdPath, jsonPath } = writeSampleGradeReport({
    emitRoot: EMIT_ROOT,
    outDir: OUT_DIR,
    matrix,
  });

  console.log("");
  console.log("Sample grade (illustrative — not a live DIPTYCH run)");
  console.log(`  md   : ${mdPath}`);
  console.log(`  json : ${jsonPath}`);
  console.log(`  sha  : ${report.emit_content_sha256}`);
  console.log(
    `  cells: ${report.results.length} · axis_power: ${report.axis_power.length}`,
  );
  console.log(`  story: ${report.story}`);
  console.log("");
  console.log(
    "Posture: sample ≠ exploitability · greens = hyperproperty adapters · DIPTYCH grades · ZeroDay emits",
  );
}

main().catch((e) => {
  console.error(`paired-probe:sample-report failed: ${(e as Error).message}`);
  process.exitCode = 2;
});
