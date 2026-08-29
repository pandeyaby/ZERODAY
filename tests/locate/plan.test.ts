import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  detectAntaresCli,
  runAntaresPlan,
  defaultFixtureRepo,
} from "../../src/locate/index.ts";

describe("antares plan (local, no inference)", () => {
  it("detects or explains how to install cisco-antares-cli", () => {
    const d = detectAntaresCli();
    assert.ok(d.sourceHint.includes("cisco-antares-cli"));
    assert.ok(d.sourceHint.includes("/v1/completions"));
  });

  it("runs antares plan on the demo app when CLI is installed", () => {
    const d = detectAntaresCli();
    if (!d.binary) {
      // Soft-skip when PyPI tool is not on PATH in this environment
      return;
    }
    const plan = runAntaresPlan(defaultFixtureRepo(), {
      maxCwes: 3,
      format: "json",
    });
    assert.equal(plan.ok, true, plan.stderr);
    const parsed = JSON.parse(plan.stdout);
    assert.ok(Array.isArray(parsed.selected_checks));
    assert.ok(parsed.selected_checks.length >= 1);
  });
});
