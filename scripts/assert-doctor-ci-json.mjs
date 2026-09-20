#!/usr/bin/env node
/**
 * Fail-closed CI assert for `npm run doctor -- --json` output.
 * Validates zeroday.doctor/v1 workstation readiness JSON only — does not
 * start RunPod / not live GPU / no network required.
 *
 * Usage: node scripts/assert-doctor-ci-json.mjs [path]
 * Default path: ./out/doctor.json
 *
 * Exit codes: 0 ok · 1 IO/parse · 2 schema · 3 ok≠true · 4 checks[] ·
 *   5 runpod · 6 startsRunPod · 7 networkRequired
 */
import fs from "node:fs";
import path from "node:path";

const SCHEMA = "zeroday.doctor/v1";
const file = path.resolve(process.argv[2] || "out/doctor.json");

function fail(code, msg) {
  console.error(`assert-doctor-ci-json: ${msg}`);
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
if (j.ok !== true) {
  fail(3, `ok want true got ${j.ok}`);
}

if (!Array.isArray(j.checks) || j.checks.length < 1) {
  fail(4, `checks[] want non-empty array got ${JSON.stringify(j.checks)}`);
}
for (const c of j.checks) {
  if (!c || typeof c.id !== "string" || !c.id.trim()) {
    fail(4, "checks[] entries need non-empty id string");
  }
  if (typeof c.ok !== "boolean") {
    fail(4, `checks[].ok want boolean for ${c.id}`);
  }
  if (typeof c.detail !== "string") {
    fail(4, `checks[].detail want string for ${c.id}`);
  }
  if (c.ok !== true) {
    fail(4, `checks[].ok want true for ${c.id} (got false: ${c.detail})`);
  }
}

if (j.runpod !== false) {
  fail(5, `runpod want false got ${j.runpod}`);
}
if (j.startsRunPod !== false) {
  fail(6, `startsRunPod want false got ${j.startsRunPod}`);
}
if (j.networkRequired !== false) {
  fail(7, `networkRequired want false got ${j.networkRequired}`);
}

process.stdout.write(`assert-doctor-ci-json: ok ${file}\n`);
