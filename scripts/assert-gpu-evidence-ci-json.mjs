#!/usr/bin/env node
/**
 * Fail-closed CI assert for `npm run gpu-evidence -- --json` output.
 * Validates checked-in Measured A40 evidence JSON only — does not start RunPod.
 *
 * Usage: node scripts/assert-gpu-evidence-ci-json.mjs [path]
 * Default path: ./gpu-evidence.json
 *
 * Exit codes: 0 ok · 1 IO/parse · 2 schema · 3 ok≠true · 4 historical · 5 startsRunPod
 */
import fs from "node:fs";
import path from "node:path";

const SCHEMA = "zeroday-gpu-evidence/v1";
const file = path.resolve(process.argv[2] || "gpu-evidence.json");

let raw;
try {
  raw = fs.readFileSync(file, "utf8");
} catch (err) {
  console.error(`assert-gpu-evidence-ci-json: cannot read ${file}: ${err.message}`);
  process.exit(1);
}

if (!raw.trim()) {
  console.error(`assert-gpu-evidence-ci-json: empty file ${file}`);
  process.exit(1);
}

let j;
try {
  j = JSON.parse(raw);
} catch (err) {
  console.error(`assert-gpu-evidence-ci-json: invalid JSON: ${err.message}`);
  process.exit(1);
}

if (j.schemaVersion !== SCHEMA) {
  console.error(
    `assert-gpu-evidence-ci-json: schemaVersion want ${SCHEMA} got ${j.schemaVersion}`,
  );
  process.exit(2);
}
if (j.ok !== true) {
  console.error(`assert-gpu-evidence-ci-json: ok want true got ${j.ok}`);
  process.exit(3);
}
if (j.historical !== true) {
  console.error(
    `assert-gpu-evidence-ci-json: historical want true got ${j.historical}`,
  );
  process.exit(4);
}
if (j.startsRunPod !== false) {
  console.error(
    `assert-gpu-evidence-ci-json: startsRunPod want false got ${j.startsRunPod}`,
  );
  process.exit(5);
}

process.stdout.write(`assert-gpu-evidence-ci-json: ok ${file}\n`);
