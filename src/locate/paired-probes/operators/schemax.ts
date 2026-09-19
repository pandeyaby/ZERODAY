/**
 * SCHEMAX — open_loop
 * Hyperproperty: required schema key sets equal (order-invariant) vs rename/drop.
 * Witness: documented LocalizationResult + SARIF keys (not cosmetic renames of
 * unrelated fields). Power: key-set equality vs inequality.
 */

import { locate } from "../../index";
import type { DiptychPairedProbeEnvelope } from "../types";
import { buildEnvelope, writeCassetteBytes, writeEnvelope } from "../envelope";
import {
  ALL_REQUIRED_SCHEMA_KEYS,
  collectPresentSchemaKeys,
  dropRequiredKey,
  keySetsEqual,
} from "../schema-keys";
import { FIXTURE_CASSETTE_SINGLE, loadRecordingResult, repoRoot } from "../fixtures";
import { gradeFromResult } from "../packet";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

export async function runSchemax(outputRoot: string): Promise<{
  conforming: DiptychPairedProbeEnvelope;
  violating: DiptychPairedProbeEnvelope;
}> {
  const root = repoRoot();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-schemax-"));

  // Scenario A: rules locate on rules-sample
  const rulesOut = path.join(tmp, "rules");
  const rulesArt = await locate({
    repo: path.join(root, "fixtures/locate/rules-sample"),
    advisory: "CWE-89",
    rules: true,
    offline: true,
    outputDir: rulesOut,
  });
  const rulesResult = rulesArt.result as unknown as Record<string, unknown>;
  const rulesSarif = JSON.parse(
    fs.readFileSync(rulesArt.sarifPath, "utf8"),
  ) as Record<string, unknown>;
  const keysA = collectPresentSchemaKeys(rulesResult, rulesSarif);

  // Scenario B: recording replay of org cassette
  const rec = loadRecordingResult(FIXTURE_CASSETTE_SINGLE);
  const graded = gradeFromResult(rec);
  const keysB = collectPresentSchemaKeys(
    rec as unknown as Record<string, unknown>,
    graded.sarif as unknown as Record<string, unknown>,
  );

  // Required keys must be present on both
  for (const req of ALL_REQUIRED_SCHEMA_KEYS) {
    if (!keysA.includes(req) || !keysB.includes(req)) {
      throw new Error(`SCHEMAX: required key missing on a scenario: ${req}`);
    }
  }
  if (!keySetsEqual(keysA, keysB)) {
    throw new Error(
      `SCHEMAX conforming power failure: key sets differ unexpectedly:\nA=${keysA}\nB=${keysB}`,
    );
  }

  writeCassetteBytes(outputRoot, "SCHEMAX", "conforming", {
    scenarios: ["rules-sample", "org-recording-cwe-89"],
    keys: keysA,
  });

  const conforming = buildEnvelope({
    operator: "SCHEMAX",
    coupling: "open_loop",
    control_role: "conforming",
    expected_verdict: "pass",
    probe_id: "zeroday.schemax.conforming",
    fixture_id: "rules-sample+org-recording",
    cassette: {
      format: "none",
      bytes_or_path: "diptych-probes/SCHEMAX/conforming/cassette.json",
    },
    traces: [
      {
        trace_id: "a",
        events: [],
        channels: { schema: { keys: keysA } },
        meta: {
          required_schema_keys: [...ALL_REQUIRED_SCHEMA_KEYS],
          decision_fingerprint: gradeFromResult(rulesArt.result).fingerprint,
          rule_ids: gradeFromResult(rulesArt.result).rule_ids,
          sarif_result_count: gradeFromResult(rulesArt.result).sarif_result_count,
        },
      },
      {
        trace_id: "b",
        events: [],
        channels: { schema: { keys: keysB } },
        meta: {
          required_schema_keys: [...ALL_REQUIRED_SCHEMA_KEYS],
          decision_fingerprint: graded.fingerprint,
          rule_ids: graded.rule_ids,
          sarif_result_count: graded.sarif_result_count,
        },
      },
    ],
  });
  writeEnvelope(outputRoot, conforming);

  // Violating: drop a required key on one side
  const dropped = "result.posture.noPoC";
  const keysViol = dropRequiredKey(keysA, dropped);
  if (keySetsEqual(keysA, keysViol)) {
    throw new Error("SCHEMAX violating power failure: drop did not change key set");
  }

  writeCassetteBytes(outputRoot, "SCHEMAX", "violating", {
    dropped,
    keysA,
    keysViol,
  });

  const violating = buildEnvelope({
    operator: "SCHEMAX",
    coupling: "open_loop",
    control_role: "violating",
    expected_verdict: "fail",
    probe_id: "zeroday.schemax.violating",
    fixture_id: "rules-sample+key-drop",
    cassette: {
      format: "none",
      bytes_or_path: "diptych-probes/SCHEMAX/violating/cassette.json",
    },
    traces: [
      {
        trace_id: "a",
        events: [],
        channels: { schema: { keys: keysA } },
        meta: {
          required_schema_keys: [...ALL_REQUIRED_SCHEMA_KEYS],
          decision_fingerprint: graded.fingerprint,
          rule_ids: graded.rule_ids,
          sarif_result_count: graded.sarif_result_count,
        },
      },
      {
        trace_id: "b",
        events: [],
        channels: { schema: { keys: keysViol } },
        meta: {
          required_schema_keys: [...ALL_REQUIRED_SCHEMA_KEYS],
          decision_fingerprint: graded.fingerprint,
          rule_ids: graded.rule_ids,
          sarif_result_count: graded.sarif_result_count,
        },
      },
    ],
  });
  writeEnvelope(outputRoot, violating);

  try {
    fs.rmSync(tmp, { recursive: true, force: true });
  } catch {
    /* ignore */
  }

  return { conforming, violating };
}
