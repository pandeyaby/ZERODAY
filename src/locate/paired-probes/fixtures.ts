/**
 * Load org cassette / fixture localization results for paired probes (keyless).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadOrgCassette,
  runRecordingLocalization,
} from "../record/index";
import type { LocalizationResult } from "../types";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

export const FIXTURE_CASSETTE_SINGLE = path.join(
  ROOT,
  "fixtures/locate/org-recordings/rules-cwe-89.cassette.json",
);

export const FIXTURE_CASSETTE_MULTI = path.join(
  ROOT,
  "fixtures/locate/org-recordings/fixture-cwe-89-multi.cassette.json",
);

export const FIXTURE_CASSETTE_ALT_HISTORY = path.join(
  ROOT,
  "fixtures/locate/org-recordings/fixture-cwe-89-alt-history.cassette.json",
);

export function repoRoot(): string {
  return ROOT;
}

export function loadRecordingResult(cassettePath: string): LocalizationResult {
  const cassette = loadOrgCassette(cassettePath);
  const result = runRecordingLocalization(cassette);
  // Pin clock for probe determinism unless an operator intentionally leaks it.
  result.generatedAt = "2026-01-01T00:00:00.000Z";
  return result;
}

export function ensureMultiCassetteExists(): void {
  if (fs.existsSync(FIXTURE_CASSETTE_MULTI)) return;
  throw new Error(
    `Missing multi-finding cassette fixture: ${FIXTURE_CASSETTE_MULTI}. ` +
      "Add fixtures/locate/org-recordings/fixture-cwe-89-multi.cassette.json",
  );
}
