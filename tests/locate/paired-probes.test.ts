/**
 * DIPTYCH paired probes (diptych_schema 0.2) — FREEZEDRY/RESEED/SCHEMAX power + gating.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import {
  runAllPairedProbes,
  JUSTIFICATIONS,
  decisionFingerprintFromSarif,
  gateEnvelopes,
  loadEnvelope,
  OPERATORS,
  ALL_REQUIRED_SCHEMA_KEYS,
  freezePacket,
  restorePacket,
  serializePacket,
  deserializePacket,
} from "../../src/locate/paired-probes/index.ts";
import { loadRecordingResult } from "../../src/locate/paired-probes/fixtures.ts";
import { FIXTURE_CASSETTE_MULTI } from "../../src/locate/paired-probes/fixtures.ts";
import { leakClockRngIntoSarif } from "../../src/locate/paired-probes/fingerprint.ts";
import { gradeFromResult } from "../../src/locate/paired-probes/packet.ts";

describe("paired-probes DIPTYCH v0.2", () => {
  it("FREEZEDRY fingerprint: freeze identical; leak diverges", () => {
    const base = loadRecordingResult(FIXTURE_CASSETTE_MULTI);
    const frozen = freezePacket(base, ["rng", "clock"]);
    const bytes = serializePacket(frozen);
    const a = gradeFromResult(restorePacket(deserializePacket(bytes)));
    const b = gradeFromResult(restorePacket(deserializePacket(bytes)));
    assert.equal(a.fingerprint, b.fingerprint);
    assert.match(a.fingerprint, /^sha256:[0-9a-f]{64}$/);

    const leak1 = decisionFingerprintFromSarif(
      leakClockRngIntoSarif(a.sarif, { clock: "c1", rng: "r1" }),
    );
    const leak2 = decisionFingerprintFromSarif(
      leakClockRngIntoSarif(a.sarif, { clock: "c2", rng: "r2" }),
    );
    assert.notEqual(leak1.fingerprint, leak2.fingerprint);
  });

  it("runAllPairedProbes emits 8×2 envelopes + matrix; gating passes", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-pp-"));
    const { matrix, matrixPath } = await runAllPairedProbes(tmp);
    assert.ok(fs.existsSync(matrixPath));
    assert.equal(matrix.diptych_schema, "0.2");
    assert.equal(matrix.source, "zeroday");

    for (const op of OPERATORS) {
      const conf = loadEnvelope(tmp, op, "conforming");
      const viol = loadEnvelope(tmp, op, "violating");
      assert.equal(conf.diptych_schema, "0.2");
      assert.equal(viol.diptych_schema, "0.2");
      assert.equal(conf.operator, op);
      assert.equal(viol.operator, op);
      assert.equal(conf.control_role, "conforming");
      assert.equal(viol.control_role, "violating");
      assert.ok(conf.traces.length >= 2);
      assert.ok(viol.traces.length >= 2);
      assert.equal(conf.source, "zeroday");
      assert.ok(conf.limits.localizationOnly);
      assert.ok(conf.limits.noPoC);

      if (op === "TRAJSWAP" || op === "VARSCALE") {
        assert.equal(conf.coupling, "crn_closed_loop");
        assert.equal(viol.coupling, "crn_closed_loop");
      }

      const cell = JUSTIFICATIONS[op];
      assert.equal(matrix.operators[op].status, cell.status);
      if (cell.status === "green") {
        assert.equal(conf.expected_verdict, "pass");
        assert.equal(viol.expected_verdict, "fail");
      } else {
        assert.equal(conf.expected_verdict, "inconclusive");
        assert.equal(viol.expected_verdict, "inconclusive");
        assert.ok(conf.traces[0].meta.inconclusive_reason);
      }
    }

    const failures = gateEnvelopes(tmp, matrix);
    assert.deepEqual(failures, []);

    // Wave A must be green
    for (const op of ["FREEZEDRY", "RESEED", "SCHEMAX"] as const) {
      assert.equal(matrix.operators[op].status, "green");
    }

    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("SCHEMAX required schema keys are documented and non-empty", () => {
    assert.ok(ALL_REQUIRED_SCHEMA_KEYS.length >= 10);
    assert.ok(ALL_REQUIRED_SCHEMA_KEYS.includes("result.posture.noPoC"));
    assert.ok(ALL_REQUIRED_SCHEMA_KEYS.includes("sarif.runs.properties.mode"));
  });

  it("gate rejects missing violating twin", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-pp-gate-"));
    const { matrix } = await runAllPairedProbes(tmp);
    fs.unlinkSync(
      path.join(tmp, "paired-probe/FREEZEDRY/violating.json"),
    );
    const failures = gateEnvelopes(tmp, matrix);
    assert.ok(failures.some((f) => f.op === "FREEZEDRY"));
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
