#!/usr/bin/env node
/**
 * Fail-closed CI assert for `npm run evidence-pack -- --json --out <dir>`.
 * Validates zeroday.evidence_pack/v1 manifest + presence of pack files / sha256.
 * Historical gpu-evidence only — does not start RunPod / not live GPU.
 *
 * Usage: node scripts/assert-evidence-pack-ci-json.mjs [outDir|manifest.json]
 * Default: ./out/evidence
 *
 * Exit codes: 0 ok · 1 IO/parse · 2 schema · 3 ok≠true · 4 historical ·
 *   5 startsRunPod · 6 files/sha256
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const SCHEMA = "zeroday.evidence_pack/v1";
const PACK_VERSION = "1";
const PROVE = "prove-doors.json";
const GPU = "gpu-evidence.json";
const REPORT_JSON = "report.json";
const REPORT_MD = "report.md";
const MANIFEST = "manifest.json";
const SHA256_RE = /^[a-f0-9]{64}$/i;
const REPORT_SCHEMA = "zeroday.report/v1";

const arg = process.argv[2] || "out/evidence";
const resolved = path.resolve(arg);
const outDir =
  path.basename(resolved) === MANIFEST ? path.dirname(resolved) : resolved;
const manifestPath = path.join(outDir, MANIFEST);

function fail(code, msg) {
  console.error(`assert-evidence-pack-ci-json: ${msg}`);
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

let j;
try {
  j = JSON.parse(raw);
} catch (err) {
  fail(1, `invalid JSON: ${err.message}`);
}

if (j.schemaVersion !== SCHEMA) {
  fail(2, `schemaVersion want ${SCHEMA} got ${j.schemaVersion}`);
}
if (j.pack_version !== PACK_VERSION) {
  fail(2, `pack_version want ${PACK_VERSION} got ${j.pack_version}`);
}
if (j.ok !== true) {
  fail(3, `ok want true got ${j.ok}`);
}
if (j.historicalGpuEvidenceOnly !== true) {
  fail(
    4,
    `historicalGpuEvidenceOnly want true got ${j.historicalGpuEvidenceOnly}`,
  );
}
if (j.startsRunPod !== false) {
  fail(5, `startsRunPod want false got ${j.startsRunPod}`);
}

if (!Array.isArray(j.files) || j.files.length < 4) {
  fail(
    6,
    `files[] want ≥4 entries (prove-doors + gpu-evidence + report.json + report.md)`,
  );
}

const byName = new Map();
for (const entry of j.files) {
  if (!entry || typeof entry.name !== "string" || typeof entry.sha256 !== "string") {
    fail(6, "files[] entries need name + sha256 strings");
  }
  if (!SHA256_RE.test(entry.sha256)) {
    fail(6, `files[].sha256 invalid for ${entry.name}: ${entry.sha256}`);
  }
  byName.set(entry.name, entry.sha256.toLowerCase());
}

for (const required of [PROVE, GPU, REPORT_JSON, REPORT_MD]) {
  if (!byName.has(required)) {
    fail(6, `files[] missing ${required}`);
  }
}

for (const name of [PROVE, GPU, REPORT_JSON, REPORT_MD, MANIFEST]) {
  const p = path.join(outDir, name);
  if (!fs.existsSync(p) || !fs.statSync(p).isFile()) {
    fail(6, `missing pack file ${p}`);
  }
  if (fs.statSync(p).size <= 0) {
    fail(6, `empty pack file ${p}`);
  }
}

for (const name of [PROVE, GPU, REPORT_JSON, REPORT_MD]) {
  const p = path.join(outDir, name);
  const body = fs.readFileSync(p);
  const got = sha256Hex(body);
  const want = byName.get(name);
  if (got !== want) {
    fail(6, `sha256 mismatch for ${name}: want ${want} got ${got}`);
  }
}

let reportRaw;
try {
  reportRaw = fs.readFileSync(path.join(outDir, REPORT_JSON), "utf8");
} catch (err) {
  fail(6, `cannot read ${REPORT_JSON}: ${err.message}`);
}
let report;
try {
  report = JSON.parse(reportRaw);
} catch (err) {
  fail(6, `${REPORT_JSON} invalid JSON: ${err.message}`);
}
if (report.schemaVersion !== REPORT_SCHEMA) {
  fail(6, `${REPORT_JSON} schemaVersion want ${REPORT_SCHEMA} got ${report.schemaVersion}`);
}
if (report.runpod !== false) {
  fail(6, `${REPORT_JSON} runpod want false got ${report.runpod}`);
}

const md = fs.readFileSync(path.join(outDir, REPORT_MD), "utf8");
if (!/localization/i.test(md) || !/exploitability/i.test(md)) {
  fail(6, `${REPORT_MD} missing localization / non-exploitability non-claims`);
}

process.stdout.write(`assert-evidence-pack-ci-json: ok ${outDir}\n`);
