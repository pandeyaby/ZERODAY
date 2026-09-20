#!/usr/bin/env node
/**
 * Fail-closed CI assert for `npm run prove-doors -- --json` output.
 * Keyless Door A + cassette only — Door B must be skipped (no --live-url).
 *
 * Usage: node scripts/assert-prove-doors-ci-json.mjs [path]
 * Default path: ./prove-doors.json
 *
 * Exit codes: 0 ok · 1 IO/parse · 2 schema · 3 ok≠true · 4–6 door status
 */
import fs from "node:fs";
import path from "node:path";

const SCHEMA = "zeroday-prove-doors/v1";
const file = path.resolve(process.argv[2] || "prove-doors.json");

let raw;
try {
  raw = fs.readFileSync(file, "utf8");
} catch (err) {
  console.error(`assert-prove-doors-ci-json: cannot read ${file}: ${err.message}`);
  process.exit(1);
}

if (!raw.trim()) {
  console.error(`assert-prove-doors-ci-json: empty file ${file}`);
  process.exit(1);
}

let j;
try {
  j = JSON.parse(raw);
} catch (err) {
  console.error(`assert-prove-doors-ci-json: invalid JSON: ${err.message}`);
  process.exit(1);
}

if (j.schemaVersion !== SCHEMA) {
  console.error(
    `assert-prove-doors-ci-json: schemaVersion want ${SCHEMA} got ${j.schemaVersion}`,
  );
  process.exit(2);
}
if (j.ok !== true) {
  console.error(`assert-prove-doors-ci-json: ok want true got ${j.ok}`);
  process.exit(3);
}
if (j.doors?.a?.status !== "ok") {
  console.error(
    `assert-prove-doors-ci-json: doors.a.status want ok got ${j.doors?.a?.status}`,
  );
  process.exit(4);
}
if (j.doors?.cassette?.status !== "ok") {
  console.error(
    `assert-prove-doors-ci-json: doors.cassette.status want ok got ${j.doors?.cassette?.status}`,
  );
  process.exit(5);
}
if (j.doors?.b?.status !== "skipped") {
  console.error(
    `assert-prove-doors-ci-json: doors.b.status want skipped got ${j.doors?.b?.status}`,
  );
  process.exit(6);
}

process.stdout.write(`assert-prove-doors-ci-json: ok ${file}\n`);
