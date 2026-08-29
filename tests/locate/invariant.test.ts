import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  checkNoExploitInvariant,
  assertNoExploitInvariant,
  collectResultTexts,
} from "../../src/locate/invariant.ts";
import { runFixtureLocalization } from "../../src/locate/fixture.ts";
import { toHumanReport } from "../../src/locate/report.ts";
import { toSarif } from "../../src/locate/sarif.ts";

describe("no-exploit invariant", () => {
  it("passes clean localization language", () => {
    const v = checkNoExploitInvariant([
      "SQL query built via string concatenation",
      "User-controlled name is concatenated into a SQL string",
      "submit_vulnerable_files",
    ]);
    assert.equal(v.length, 0);
  });

  it("flags exploit / PoC / payload language", () => {
    assert.ok(checkNoExploitInvariant(["write an exploit for this"]).length > 0);
    assert.ok(checkNoExploitInvariant(["here is a PoC"]).length > 0);
    assert.ok(checkNoExploitInvariant(["drop this payload"]).length > 0);
    assert.ok(
      checkNoExploitInvariant(["attack procedure follows"]).length > 0,
    );
  });

  it("allows MITRE likelihood phrasing and defensive negations", () => {
    assert.equal(
      checkNoExploitInvariant([
        "likelihood_of_exploit taxonomy metadata",
        "not proof of exploitability",
        "Localization only; not exploit proof.",
      ]).length,
      0,
    );
  });

  it("assertNoExploitInvariant throws on violation", () => {
    assert.throws(
      () => assertNoExploitInvariant(["proof-of-concept script"]),
      /no-exploit invariant/,
    );
  });

  it("fixture CWE-89 recording satisfies the invariant", () => {
    const result = runFixtureLocalization(
      { kind: "cwe", id: "CWE-89", cweId: "CWE-89" },
      "/tmp/demo",
    );
    const texts = [
      ...collectResultTexts(result),
      toHumanReport(result),
      JSON.stringify(toSarif(result)),
    ];
    assert.equal(checkNoExploitInvariant(texts).length, 0);
    assert.ok(result.posture.noPoC);
    assert.ok(result.posture.localizationOnly);
    assert.ok(result.rankedFiles.length >= 1);
  });
});
