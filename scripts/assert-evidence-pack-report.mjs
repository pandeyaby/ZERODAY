#!/usr/bin/env node
/**
 * Fail-closed CI assert: evidence-pack `--out` must include report.json +
 * report.md matching #100 pack contents (zeroday.report/v1 · runpod:false ·
 * markdown non-claims). Reuses scripts/assert-report-ci-json.mjs for JSON —
 * does not reimplement report validation. Historical / fixture only · no
 * RunPod / no PoC / localization ≠ exploitability.
 *
 * Usage: node scripts/assert-evidence-pack-report.mjs [outDir|manifest.json]
 * Default: ./out/evidence
 *
 * Exit codes: 0 ok · 1 IO/parse · 2 manifest · 3 missing report files ·
 *   4 sha256 · 5 report.json (delegated) · 6 report.md non-claims
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const MANIFEST = "manifest.json";
const REPORT_JSON = "report.json";
const REPORT_MD = "report.md";
const PACK_SCHEMA = "zeroday.evidence_pack/v1";
const SHA256_RE = /^[a-f0-9]{64}$/i;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPORT_ASSERT = path.join(HERE, "assert-report-ci-json.mjs");

const arg = process.argv[2] || "out/evidence";
const resolved = path.resolve(arg);
const outDir =
  path.basename(resolved) === MANIFEST ? path.dirname(resolved) : resolved;
const manifestPath = path.join(outDir, MANIFEST);
const reportJsonPath = path.join(outDir, REPORT_JSON);
const reportMdPath = path.join(outDir, REPORT_MD);

function fail(code, msg) {
  console.error(`assert-evidence-pack-report: ${msg}`);
  process.exit(code);
}

function sha256Hex(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

let raw;
try {
  raw = fs.readFileSync(manifestPath, "utf8");
} catch (err) {
  fail(1, `cannot read ${manifestPath}: ${err.message}`);
}
if (!raw.trim()) {
  fail(1, `empty file ${manifestPath}`);
}

let manifest;
try {
  manifest = JSON.parse(raw);
} catch (err) {
  fail(1, `invalid JSON: ${err.message}`);
}

if (manifest.schemaVersion !== PACK_SCHEMA) {
  fail(2, `schemaVersion want ${PACK_SCHEMA} got ${manifest.schemaVersion}`);
}
if (manifest.ok !== true) {
  fail(2, `ok want true got ${manifest.ok}`);
}
if (manifest.startsRunPod !== false) {
  fail(2, `startsRunPod want false got ${manifest.startsRunPod}`);
}
if (!Array.isArray(manifest.files)) {
  fail(2, `files[] want array got ${typeof manifest.files}`);
}

const byName = new Map();
for (const entry of manifest.files) {
  if (!entry || typeof entry.name !== "string" || typeof entry.sha256 !== "string") {
    fail(2, "files[] entries need name + sha256 strings");
  }
  if (!SHA256_RE.test(entry.sha256)) {
    fail(2, `files[].sha256 invalid for ${entry.name}`);
  }
  byName.set(entry.name, entry.sha256.toLowerCase());
}

for (const required of [REPORT_JSON, REPORT_MD]) {
  if (!byName.has(required)) {
    fail(3, `manifest.files[] missing ${required}`);
  }
}

for (const [name, p] of [
  [REPORT_JSON, reportJsonPath],
  [REPORT_MD, reportMdPath],
]) {
  if (!fs.existsSync(p) || !fs.statSync(p).isFile()) {
    fail(3, `missing pack file ${p}`);
  }
  if (fs.statSync(p).size <= 0) {
    fail(3, `empty pack file ${p}`);
  }
  const got = sha256Hex(fs.readFileSync(p));
  const want = byName.get(name);
  if (got !== want) {
    fail(4, `sha256 mismatch for ${name}: want ${want} got ${got}`);
  }
}

// Reuse #96/#99 report assert — do not reimplement zeroday.report/v1 checks.
const reportAssert = spawnSync(process.execPath, [REPORT_ASSERT, reportJsonPath], {
  encoding: "utf8",
});
if (reportAssert.status !== 0) {
  const detail = (reportAssert.stderr || reportAssert.stdout || "").trim();
  fail(
    5,
    `${REPORT_JSON} failed assert-report-ci-json (exit ${reportAssert.status})${detail ? `: ${detail}` : ""}`,
  );
}

let md;
try {
  md = fs.readFileSync(reportMdPath, "utf8");
} catch (err) {
  fail(3, `cannot read ${REPORT_MD}: ${err.message}`);
}
if (!md.trim()) {
  fail(3, `empty ${REPORT_MD}`);
}
if (!/localization/i.test(md)) {
  fail(6, `${REPORT_MD} missing localization non-claim`);
}
if (!/exploitability/i.test(md)) {
  fail(6, `${REPORT_MD} missing exploitability non-claim`);
}
if (!/needs_human/i.test(md)) {
  fail(6, `${REPORT_MD} missing needs_human`);
}
if (!/no\s*PoC|no PoC/i.test(md)) {
  fail(6, `${REPORT_MD} missing no PoC`);
}
if (!/runpod:\s*false|RunPod.*false|does not start RunPod/i.test(md)) {
  fail(6, `${REPORT_MD} missing runpod:false / does not start RunPod`);
}

process.stdout.write(`assert-evidence-pack-report: ok ${outDir}\n`);
