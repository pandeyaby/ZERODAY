/**
 * DIPTYCH paired probes (diptych_schema 0.2) — full-8 power + gating.
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
import {
  flipAndResort,
  scoreMargin,
  scoredFromResult,
  signNormalizedInvariant,
} from "../../src/locate/paired-probes/score-margin.ts";
import {
  closedLoopResidual,
  pathsMentionedInStep,
  swapTrajectorySegment,
} from "../../src/locate/paired-probes/crn.ts";

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

  it("SIGNFLIP score_margin: flip+resort preserves; flip-without-reorder breaks", () => {
    const base = loadRecordingResult(FIXTURE_CASSETTE_MULTI);
    const ordered = scoredFromResult(base);
    const m = scoreMargin(ordered);
    assert.ok(m > 0);
    const paths = ordered.map((f) => f.filePath);
    const inv = signNormalizedInvariant(paths, m);
    const flipped = flipAndResort(ordered);
    const mB = scoreMargin(flipped);
    assert.ok(mB < 0);
    assert.equal(
      signNormalizedInvariant(
        flipped.map((f) => f.filePath),
        mB,
      ),
      inv,
    );
    assert.notEqual(
      signNormalizedInvariant(paths, -m),
      inv,
      "flip without reorder must break odd-symmetric invariant",
    );
  });

  it("TRAJSWAP residual: 1−Jaccard nonempty; poison swap exceeds eps", () => {
    const base = loadRecordingResult(FIXTURE_CASSETTE_MULTI);
    const verified = base.rankedFiles.map((f) => f.filePath);
    const submit = base.explorationTrace.find((s) => s.tool === "submit");
    assert.ok(submit);
    const proposed = pathsMentionedInStep(submit!);
    assert.ok(proposed.length >= 1);
    const finalR = closedLoopResidual(proposed, verified);
    assert.ok(finalR <= 0.25);
    const poisonFull = [
      {
        step: 1,
        tool: "find" as const,
        command: "find . -name harmless.js",
        summary: "Listed fixtures/decoy/notes.md",
      },
      {
        step: 2,
        tool: "grep" as const,
        command: "grep NOTE fixtures/",
        summary: "Found fixtures/decoy/notes.md",
      },
      {
        step: 3,
        tool: "cat" as const,
        command: "cat lib/unrelated.js",
        summary: "Read lib/unrelated.js",
      },
      {
        step: 4,
        tool: "cat" as const,
        command: "cat fixtures/decoy/notes.md",
        summary: "Read fixtures/decoy/notes.md",
      },
      {
        step: 5,
        tool: "other" as const,
        command: "rank-files",
        summary: "Ranked lib/unrelated.js",
      },
      {
        step: 6,
        tool: "submit" as const,
        command: "submit_vulnerable_files",
        summary: "Submitted lib/unrelated.js",
      },
    ];
    const swapped = swapTrajectorySegment(
      base.explorationTrace,
      poisonFull,
      base.explorationTrace.length - 2,
      2,
    );
    const badSubmit = swapped.a.find((s) => s.tool === "submit");
    assert.ok(badSubmit);
    const badProposed = pathsMentionedInStep(badSubmit!);
    const badR = closedLoopResidual(badProposed, verified);
    assert.ok(badR > 0.25);
  });

  it("runAllPairedProbes emits 8×2 envelopes + matrix; gating passes; all green", async () => {
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
      assert.equal(cell.status, "green");
      assert.equal(conf.expected_verdict, "pass");
      assert.equal(viol.expected_verdict, "fail");
    }

    // Uplift witnesses
    const sf = loadEnvelope(tmp, "SIGNFLIP", "conforming");
    assert.equal(sf.traces[0].meta.signflip_channel, "score_margin");
    assert.ok(
      (sf.traces[0].channels.score_margin as { values: number[] }).values[0] >
        0,
    );
    const ts = loadEnvelope(tmp, "TRAJSWAP", "conforming");
    assert.ok(
      (ts.traces[0].channels.closed_loop_residual?.values?.length ?? 0) >= 1,
    );
    assert.equal(typeof ts.traces[0].meta.traj_swap_at, "number");
    const vs = loadEnvelope(tmp, "VARSCALE", "conforming");
    assert.equal(typeof vs.traces[0].meta.var_scale, "number");
    assert.ok(
      (vs.traces[0].channels.variance_proxy?.values?.length ?? 0) >= 1,
    );
    assert.equal(vs.traces[0].meta.mean_finding_count, 2);

    const failures = gateEnvelopes(tmp, matrix);
    assert.deepEqual(failures, []);

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
