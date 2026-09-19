/**
 * Keyless: locate SARIF on disk → paired-probe envelopes + coverage matrix.
 * No GPU. No DIPTYCH clone. Emit-only adapter hyperproperties.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  OPERATORS,
  loadPairedProbeSeedFromInput,
  resolveLocateArtifact,
  runPairedProbesFromSarif,
  loadEnvelope,
} from "../../src/locate/paired-probes/index.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SAMPLE_SARIF = path.join(
  root,
  "fixtures/locate/ingest-sample/sample.sarif",
);
const SAMPLE_REPORT_DIR = path.join(
  root,
  "examples/factory/sample-run/locate",
);

describe("paired-probe:from-sarif (keyless stranger door)", () => {
  it("resolves in-repo sample SARIF path", () => {
    const r = resolveLocateArtifact(SAMPLE_SARIF);
    assert.equal(r.kind, "sarif");
    assert.ok(r.path.endsWith("sample.sarif"));
  });

  it("resolves locate dir preferring report.json", () => {
    const r = resolveLocateArtifact(SAMPLE_REPORT_DIR);
    assert.equal(r.kind, "locate-dir");
    assert.ok(r.path.endsWith("report.json"));
  });

  it("loads a probe-ready seed from sample.sarif (≥2 findings)", () => {
    const seed = loadPairedProbeSeedFromInput(SAMPLE_SARIF);
    assert.ok(seed.primary.rankedFiles.length >= 2);
    assert.ok(seed.primary.explorationTrace.length >= 4);
    assert.ok(seed.alt.explorationTrace.length >= 4);
    assert.match(seed.fixtureId, /^from-sarif:/);
    assert.equal(seed.sourceKind, "sarif");
  });

  it("emits same artifact shape as paired-probe (envelopes + matrix)", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-from-sarif-"));
    try {
      const { matrix, matrixPath, seed } = await runPairedProbesFromSarif({
        input: SAMPLE_SARIF,
        output: tmp,
      });
      assert.ok(fs.existsSync(matrixPath));
      assert.equal(matrix.diptych_schema, "0.2");
      assert.equal(matrix.source, "zeroday");

      for (const op of OPERATORS) {
        assert.equal(
          matrix.operators[op].status,
          "green",
          `${op} should be green from sample.sarif seed`,
        );
        const conf = path.join(tmp, "paired-probe", op, "conforming.json");
        const viol = path.join(tmp, "paired-probe", op, "violating.json");
        assert.ok(fs.existsSync(conf), `missing ${conf}`);
        assert.ok(fs.existsSync(viol), `missing ${viol}`);
        const env = loadEnvelope(tmp, op, "conforming");
        assert.equal(env.diptych_schema, "0.2");
        assert.equal(env.source, "zeroday");
        assert.equal(env.operator, op);
        assert.ok(env.traces.length >= 2);
        assert.equal(env.limits.localizationOnly, true);
        assert.equal(env.limits.notExploitability, true);
        assert.equal(env.limits.noPoC, true);
        // FREEZEDRY etc. should carry from-sarif fixture id (SATEXTEND is channel-only)
        if (op !== "SATEXTEND") {
          assert.match(
            env.fixture_id,
            /from-sarif:sample\.sarif/,
            `${op} fixture_id should cite sample.sarif (got ${env.fixture_id})`,
          );
        }
      }
      assert.match(seed.fixtureId, /sample\.sarif/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("also accepts factory sample locate report.json vault", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-from-report-"));
    try {
      const { matrix, seed } = await runPairedProbesFromSarif({
        input: SAMPLE_REPORT_DIR,
        output: tmp,
      });
      assert.equal(seed.sourceKind, "locate-dir");
      assert.ok(seed.sourcePath.endsWith("report.json"));
      for (const op of OPERATORS) {
        assert.equal(matrix.operators[op].status, "green");
        assert.ok(
          fs.existsSync(path.join(tmp, "paired-probe", op, "conforming.json")),
        );
      }
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
