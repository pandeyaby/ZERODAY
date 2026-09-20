#!/usr/bin/env node
/**
 * Fail-closed CI assert for `npm run report -- --json --out out/report.json`.
 * Validates zeroday.report/v1 CISO localization summary only — does not
 * start RunPod / not live GPU / no PoC / localization ≠ exploitability.
 *
 * Usage: node scripts/assert-report-ci-json.mjs [path]
 * Default path: ./out/report.json
 *
 * Exit codes: 0 ok · 1 IO/parse · 2 schema · 3 ok=false/error · 4 sources ·
 *   5 findings · 6 disclaimers · 7 runpod · 8 whatWasRun
 */
import fs from "node:fs";
import path from "node:path";

const SCHEMA = "zeroday.report/v1";
const file = path.resolve(process.argv[2] || "out/report.json");

function fail(code, msg) {
  console.error(`assert-report-ci-json: ${msg}`);
  process.exit(code);
}

let raw;
try {
  raw = fs.readFileSync(file, "utf8");
} catch (err) {
  fail(1, `cannot read ${file}: ${err.message}`);
}

if (!raw.trim()) {
  fail(1, `empty file ${file}`);
}

let j;
try {
  j = JSON.parse(raw);
} catch (err) {
  fail(1, `invalid JSON: ${err.message}`);
}

if (j.schemaVersion !== SCHEMA) {
  fail(2, `schemaVersion want ${SCHEMA} got ${j.schemaVersion}`);
}

// Error envelope from CLI uses ok:false — reject that shape in CI.
if (j.ok === false || typeof j.error === "string") {
  fail(3, `ok/error envelope not allowed (got ok=${j.ok} error=${j.error})`);
}

if (!Array.isArray(j.sources) || j.sources.length < 1) {
  fail(4, `sources[] want non-empty array got ${JSON.stringify(j.sources)}`);
}
for (const s of j.sources) {
  if (!s || typeof s.kind !== "string" || !s.kind.trim()) {
    fail(4, "sources[] entries need non-empty kind string");
  }
  if (typeof s.path !== "string" || !s.path.trim()) {
    fail(4, `sources[].path want non-empty string for ${s.kind}`);
  }
  if (typeof s.label !== "string") {
    fail(4, `sources[].label want string for ${s.kind}`);
  }
}

if (!Array.isArray(j.findings)) {
  fail(5, `findings[] want array got ${typeof j.findings}`);
}
for (const f of j.findings) {
  if (!f || typeof f.path !== "string" || !f.path.trim()) {
    fail(5, "findings[] entries need non-empty path string");
  }
  if (!Array.isArray(f.evidence)) {
    fail(5, `findings[].evidence want array for ${f.path}`);
  }
  if (typeof f.source !== "string" || !f.source.trim()) {
    fail(5, `findings[].source want non-empty string for ${f.path}`);
  }
}

if (!Array.isArray(j.disclaimers) || j.disclaimers.length < 1) {
  fail(
    6,
    `disclaimers[] want non-empty array got ${JSON.stringify(j.disclaimers)}`,
  );
}
const discText = j.disclaimers.join("\n");
if (!/localization\s*[≠!=]+\s*exploitability|Localization ≠ exploitability/i.test(discText)) {
  fail(6, "disclaimers[] must include localization ≠ exploitability");
}
if (!/needs_human/i.test(discText)) {
  fail(6, "disclaimers[] must include needs_human");
}
if (!/no\s*PoC|no PoC/i.test(discText)) {
  fail(6, "disclaimers[] must include no PoC");
}
if (!/runpod:\s*false|does not start RunPod/i.test(discText)) {
  fail(6, "disclaimers[] must include runpod:false / does not start RunPod");
}
if (/AUROC|File F1/i.test(discText) === false) {
  // Required honesty: report must disclaim invented AUROC / File F1
  fail(6, "disclaimers[] must disclaim AUROC / File F1 invention");
}

if (j.runpod !== false) {
  fail(7, `runpod want false got ${j.runpod}`);
}

if (!j.whatWasRun || typeof j.whatWasRun !== "object") {
  fail(8, `whatWasRun want object got ${JSON.stringify(j.whatWasRun)}`);
}
if (typeof j.whatWasRun.keyless !== "boolean") {
  fail(8, `whatWasRun.keyless want boolean got ${j.whatWasRun.keyless}`);
}
if (typeof j.whatWasRun.historicalGpu !== "boolean") {
  fail(
    8,
    `whatWasRun.historicalGpu want boolean got ${j.whatWasRun.historicalGpu}`,
  );
}

if (typeof j.generated_at !== "string" || !j.generated_at.trim()) {
  fail(2, `generated_at want non-empty string got ${j.generated_at}`);
}

process.stdout.write(`assert-report-ci-json: ok ${file}\n`);
