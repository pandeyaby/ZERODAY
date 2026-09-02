import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  draftFix,
  DRAFT_FIX_FLAG,
  EXPLOIT_REFUSAL,
  CODEGUARD_RULE_MAP,
} from "../../src/locate/draft-fix.ts";
import { runFixtureLocalization, defaultFixtureRepo } from "../../src/locate/fixture.ts";
import { checkNoExploitInvariant } from "../../src/locate/invariant.ts";

describe("draft-fix gate", () => {
  it("requires --i-asked-for-a-fix", () => {
    const result = runFixtureLocalization(
      { kind: "cwe", id: "CWE-89", cweId: "CWE-89" },
      defaultFixtureRepo(),
    );
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-draft-"));
    assert.throws(
      () =>
        draftFix({
          iAskedForAFix: false,
          result,
          outputDir: out,
        }),
      new RegExp(DRAFT_FIX_FLAG.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
  });

  it("emits CodeGuard-aligned draft when gated", () => {
    const result = runFixtureLocalization(
      { kind: "cwe", id: "CWE-89", cweId: "CWE-89" },
      defaultFixtureRepo(),
    );
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-draft-"));
    const artifact = draftFix({
      iAskedForAFix: true,
      result,
      repoPath: defaultFixtureRepo(),
      outputDir: out,
    });
    assert.ok(fs.existsSync(artifact.path));
    assert.match(artifact.markdown, /DRAFT ONLY/);
    assert.match(
      artifact.markdown,
      new RegExp(CODEGUARD_RULE_MAP["CWE-89"].ruleId),
    );
    assert.match(artifact.markdown, /parameteriz/i);
    assert.doesNotMatch(artifact.markdown, /CodeGuard-approved/i);
    assert.match(artifact.markdown, /not.*CodeGuard certification/i);
    assert.equal(checkNoExploitInvariant([artifact.markdown]).length, 0);
  });

  it("refuses PoC in one sentence but still emits draft", () => {
    const result = runFixtureLocalization(
      { kind: "cwe", id: "CWE-89", cweId: "CWE-89" },
      defaultFixtureRepo(),
    );
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-draft-"));
    const artifact = draftFix({
      iAskedForAFix: true,
      alsoAskedForPoC: true,
      result,
      outputDir: out,
    });
    assert.equal(artifact.refusedExploit, true);
    assert.match(artifact.markdown, new RegExp(EXPLOIT_REFUSAL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.ok(fs.existsSync(artifact.path));
  });
});
