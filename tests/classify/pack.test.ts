import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  runMixedPack,
  FOUR_FINDING_CLASSES,
  TELEMETRY_EXPORTER_HOOK,
} from "../../src/classify/pack.ts";
import { isValidCisoObject } from "../../src/classify/classifier.ts";
import { checkNoExploitInvariant } from "../../src/locate/invariant.ts";

describe("mixed fixture pack (exec demo)", () => {
  it("emits all four finding classes + SARIF + Splunk + CISO markdown", async () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "zd-pack-"));
    const pack = await runMixedPack(out);

    assert.ok(fs.existsSync(pack.sarifPath));
    assert.ok(fs.existsSync(pack.splunkPath));
    assert.ok(fs.existsSync(pack.asffPath));
    assert.ok(fs.existsSync(pack.packMarkdownPath));
    assert.ok(fs.existsSync(pack.packJsonPath));
    assert.ok(fs.existsSync(pack.packSplunkPath));
    assert.ok(fs.existsSync(path.join(pack.outputDir, "ciso-all.md")));

    const demonstrated = new Set(
      pack.cases
        .filter((c) => c.classification !== "needs_human")
        .map((c) => c.classification),
    );
    for (const label of FOUR_FINDING_CLASSES) {
      assert.ok(demonstrated.has(label), `missing ${label}`);
    }

    const breach = pack.cases.find((c) => c.scenario === "possible_breach");
    assert.ok(breach);
    assert.equal(breach!.east_west_suspected, true);
    assert.equal(breach!.classification, "possible_breach");

    const ambiguous = pack.cases.find((c) => c.scenario === "needs_human");
    assert.equal(ambiguous!.classification, "needs_human");

    for (const c of pack.cases) {
      const ciso = JSON.parse(fs.readFileSync(c.cisoPath, "utf8"));
      assert.equal(isValidCisoObject(ciso), true);
      assert.equal(ciso.finding_class, ciso.classification);
      assert.equal(ciso.needs_human, true);
    }

    const md = fs.readFileSync(pack.packMarkdownPath, "utf8");
    assert.match(md, /No live network/i);
    assert.match(md, /software_defect/);
    assert.match(md, /possible_breach/);
    assert.equal(checkNoExploitInvariant([md]).length, 0);

    const splunk = JSON.parse(fs.readFileSync(pack.packSplunkPath, "utf8"));
    assert.equal(splunk.sourcetype_recommendation, "zeroday:antares:classify");
    assert.ok(Array.isArray(splunk.events) && splunk.events.length >= 4);

    assert.equal(TELEMETRY_EXPORTER_HOOK.no_live_pull ?? true, true);
    assert.match(TELEMETRY_EXPORTER_HOOK.ingest_note, /never pulls live/i);
  });
});
