/**
 * Desk slice E — classify evidence pack tests (fixture only).
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  buildClassifyEvidencePack,
  defaultClassifyFixtureDir,
  resolveClassifyFrom,
  runClassify,
  writeClassifyEvidencePack,
} from "../../src/classify/index.ts";
import { checkNoExploitInvariant } from "../../src/locate/invariant.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const softwareDefectDir = path.join(root, "fixtures/classify/software_defect");
const needsHumanDir = path.join(root, "fixtures/classify/needs_human");

describe("Desk E classify --from directory", () => {
  it("resolves fixture directories with report.json / telemetry.json", () => {
    const r = resolveClassifyFrom(softwareDefectDir);
    assert.equal(r.kind, "directory");
    assert.ok(r.locatePath?.endsWith("report.json"));
    assert.equal(r.scenario, "software_defect");
  });

  it("one-command --from fixture dir emits classify.md + classify.json", () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "zd-desk-e-"));
    const a = runClassify({ from: softwareDefectDir, outputDir: out });
    assert.equal(a.pack.desk, "E");
    assert.equal(a.pack.schemaVersion, "zeroday-classify-evidence/v1");
    assert.equal(a.pack.classification, "software_defect");
    assert.equal(a.pack.classification_not_exploitability, true);
    assert.equal(a.pack.needs_human, true);
    assert.equal(a.pack.posture.noAutoRemediate, true);
    assert.equal(a.pack.posture.secretsRedacted, true);
    assert.ok(fs.existsSync(a.classifyMdPath));
    assert.ok(fs.existsSync(a.classifyJsonPath));
    assert.ok(fs.existsSync(a.cisoMdPath));
    assert.ok(fs.existsSync(a.cisoJsonPath));
    assert.ok(fs.existsSync(a.readmePath));

    const md = fs.readFileSync(a.classifyMdPath, "utf8");
    assert.match(md, /Classification ≠ exploitability/i);
    assert.match(md, /Human review required/i);
    assert.match(md, /no auto-remediate/i);
    assert.equal(checkNoExploitInvariant([md]).length, 0);
  });

  it("ambiguous fixture dir → needs_human", () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "zd-desk-e-"));
    const a = writeClassifyEvidencePack({
      from: needsHumanDir,
      outputDir: out,
    });
    assert.equal(a.pack.classification, "needs_human");
    assert.match(a.pack.rationale.join(" "), /Ambiguous/i);
  });

  it("never invents possible_breach from software_defect-only signals", () => {
    const { pack } = buildClassifyEvidencePack({ from: softwareDefectDir });
    assert.equal(pack.classification, "software_defect");
    assert.equal(pack.signals.possibleBreach, false);
  });

  it("redacts secret-shaped tokens in evidence snippets", () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "zd-desk-e-"));
    // Inject a fake secret into a temp telemetry copy to prove redaction on write
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zd-cls-secret-"));
    const telem = {
      schema: "zeroday-telemetry-v1",
      source: "fixture",
      title: "secret redact fixture",
      events: [
        {
          id: "e1",
          timestamp: "2026-01-01T00:00:00Z",
          type: "infra",
          failure_code: "TIMEOUT",
          tags: ["infra_failure"],
          notes: "api_key=sk_live_ABCDEFGHIJKLMNOPQRST and Bearer eyJhbGciOiJIUzI1NiJ9.xx",
        },
      ],
    };
    const telemPath = path.join(tmp, "telemetry.json");
    fs.writeFileSync(telemPath, JSON.stringify(telem, null, 2));

    const a = writeClassifyEvidencePack({
      telemetry: telemPath,
      outputDir: out,
    });
    assert.equal(a.pack.classification, "infra_failure");
    const blob = fs.readFileSync(a.classifyJsonPath, "utf8");
    assert.equal(/sk_live_[A-Za-z0-9]+/.test(blob), false);
    assert.match(blob, /\[REDACTED\]/);
  });

  it("CLI --fixture and --from produce Desk E artifacts", () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "zd-cli-cls-"));
    const r = spawnSync(
      "npm",
      [
        "run",
        "zeroday",
        "--",
        "classify",
        "--from",
        softwareDefectDir,
        "--output",
        out,
      ],
      { cwd: root, encoding: "utf8", env: process.env },
    );
    assert.equal(r.status, 0, r.stderr || r.stdout);
    assert.ok(fs.existsSync(path.join(out, "classify.json")));
    assert.ok(fs.existsSync(path.join(out, "classify.md")));
    assert.match(r.stdout, /Desk E/);
    assert.match(r.stdout, /exploitability/i);

    const fixtureOut = fs.mkdtempSync(path.join(os.tmpdir(), "zd-cli-fix-"));
    const r2 = spawnSync(
      "npm",
      ["run", "zeroday", "--", "classify", "--fixture", "--output", fixtureOut],
      { cwd: root, encoding: "utf8", env: process.env },
    );
    assert.equal(r2.status, 0, r2.stderr || r2.stdout);
    assert.equal(
      defaultClassifyFixtureDir(root),
      path.join(root, "fixtures/classify/software_defect"),
    );
    const j = JSON.parse(
      fs.readFileSync(path.join(fixtureOut, "classify.json"), "utf8"),
    );
    assert.equal(j.desk, "E");
    assert.equal(j.classification, "software_defect");
  });
});
