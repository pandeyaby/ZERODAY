import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import {
  buildInventory,
  parseCodeowners,
  matchCodeownersPattern,
  ownersForFile,
  buildOwnership,
  buildDefendArtifact,
  refuseExploitReproduction,
  resolveInferenceProvider,
  REMOTE_INFERENCE_REQUIRED,
  runFactory,
} from "../../src/factory/index.ts";
import { defaultFixtureRepo } from "../../src/locate/index.ts";
import { verifyRunDir } from "../../src/evidence/vault.ts";
import { resolveLocateMode } from "../../src/locate/live-guard.ts";

describe("factory inventory + CODEOWNERS", () => {
  it("inventories fixture demo-app with CODEOWNERS + package manifest", () => {
    const inv = buildInventory(defaultFixtureRepo());
    assert.equal(inv.schemaVersion, "zeroday-factory-inventory/v1");
    assert.ok(inv.fileCount >= 3);
    assert.ok(inv.manifests.includes("package.json"));
    assert.equal(inv.codeownersPath, ".github/CODEOWNERS");
    assert.ok(inv.codeownersRules.length >= 1);
    assert.equal(inv.posture.noPoC, true);
  });

  it("parses CODEOWNERS and matches last-rule-wins", () => {
    const rules = parseCodeowners(`
# comment
* @root
/src/ @backend
src/users.js @users-owner
`);
    assert.equal(rules.length, 3);
    assert.equal(matchCodeownersPattern("src/users.js", "/src/"), true);
    assert.equal(matchCodeownersPattern("docs/NOTES.md", "/src/"), false);
    const hit = ownersForFile("src/users.js", rules);
    assert.deepEqual(hit.owners, ["@users-owner"]);
  });
});

describe("factory ownership + defend", () => {
  it("routes ranked files to CODEOWNERS owners", () => {
    const inv = buildInventory(defaultFixtureRepo());
    const fakeResult = {
      mode: "fixture" as const,
      advisory: { kind: "cwe" as const, id: "CWE-89", cweId: "CWE-89" },
      targetRepo: inv.repoRoot,
      model: "fixture",
      generatedAt: new Date().toISOString(),
      rankedFiles: [
        {
          filePath: "src/users.js",
          rank: 1,
          cweIds: ["CWE-89"],
          title: "demo",
          evidence: [{ filePath: "src/users.js", note: "fixture" }],
        },
      ],
      explorationTrace: [],
      warnings: [],
      posture: {
        localizationOnly: true as const,
        notExploitProof: true as const,
        noAutoMerge: true as const,
        noPoC: true as const,
      },
      summary: {
        findingCount: 1,
        incompleteReason: null,
        terminalCallBudget: 0,
        terminalCallsUsed: 0,
      },
    };
    const own = buildOwnership({
      result: fakeResult,
      inventory: inv,
      includeBlame: false,
    });
    assert.equal(own.schemaVersion, "zeroday-factory-ownership/v1");
    assert.equal(own.hits.length, 1);
    assert.ok(own.hits[0]!.owners.includes("@demo-app-backend"));
    assert.match(own.reviewMarkdown, /Human review required/i);
    assert.match(own.githubCommentMarkdown, /ownership route/i);
    assert.equal(own.posture.noAutoMerge, true);
  });

  it("defend harness refuses exploit reproduction framing", () => {
    assert.match(refuseExploitReproduction("reproduce vuln"), /refuses/i);
    const d = buildDefendArtifact(defaultFixtureRepo(), { runTests: false });
    assert.equal(d.schemaVersion, "zeroday-factory-defend/v1");
    assert.equal(d.posture.notVulnerabilityReproduction, true);
    assert.equal(d.posture.notExploitConfirmation, true);
    assert.ok(d.checks.some((c) => c.kind === "fail_closed_posture" && c.ok));
  });
});

describe("factory inference provider ACK", () => {
  it("local loopback does not require ACK", () => {
    const r = resolveInferenceProvider({
      provider: "local",
      endpoint: "http://127.0.0.1:8000/v1",
      env: {},
    });
    assert.equal(r.remote, false);
    assert.equal(r.localLoopback, true);
  });

  it("remote / RunPod-style host requires ACK", () => {
    assert.throws(
      () =>
        resolveInferenceProvider({
          provider: "remote",
          endpoint: "https://gpu.example.runpod.net/v1",
          env: {},
        }),
      (e: Error) => e.message.includes("REMOTE_INFERENCE") || e.message.includes(REMOTE_INFERENCE_REQUIRED.slice(0, 20)),
    );
    const ok = resolveInferenceProvider({
      provider: "runpod",
      endpoint: "https://gpu.example.runpod.net/v1",
      remoteInference: true,
      env: {},
    });
    assert.equal(ok.remote, true);
    assert.equal(ok.provider, "remote");
  });

  it("resolveLocateMode refuses remote endpoint without ACK", () => {
    assert.throws(
      () =>
        resolveLocateMode({
          endpoint: "https://gpu.example.runpod.net/v1",
        }),
      /remote-inference|REMOTE_INFERENCE|leave the machine/i,
    );
    assert.equal(
      resolveLocateMode({
        endpoint: "https://gpu.example.runpod.net/v1",
        remoteInference: true,
      }),
      "live",
    );
  });
});

describe("factory run (fixture-only)", () => {
  it("walks inventory→locate→own→defend→verify without remote GPU", async () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-factory-"));
    const artifacts = await runFactory({
      repo: defaultFixtureRepo(),
      advisory: "CWE-89",
      fixture: true,
      offline: true,
      defend: true,
      runTests: false,
      classifyScenario: "software_defect",
      outputDir: out,
    });

    assert.equal(artifacts.summary.schemaVersion, "zeroday-factory-run/v1");
    assert.equal(artifacts.summary.needsHuman, true);
    assert.equal(artifacts.summary.posture.noAutoMerge, true);
    assert.equal(artifacts.summary.posture.noPoC, true);
    assert.equal(artifacts.summary.stages.inventory, true);
    assert.equal(artifacts.summary.stages.locate, true);
    assert.equal(artifacts.summary.stages.ownership, true);
    assert.equal(artifacts.summary.stages.classify, true);
    assert.equal(artifacts.summary.stages.defend, true);
    assert.equal(artifacts.summary.stages.draftFix, false);
    assert.ok(artifacts.summary.findingCount >= 1);
    assert.ok(fs.existsSync(artifacts.paths.inventory));
    assert.ok(fs.existsSync(artifacts.paths.inventoryMd ?? ""));
    const invJson = JSON.parse(
      fs.readFileSync(artifacts.paths.inventory, "utf8"),
    ) as { configHotspots?: unknown[]; rankedPaths?: unknown[] };
    assert.ok(Array.isArray(invJson.configHotspots));
    assert.ok(Array.isArray(invJson.rankedPaths));
    assert.ok(fs.existsSync(artifacts.paths.ownershipMd));
    assert.ok(fs.existsSync(artifacts.paths.ownershipComment));
    assert.ok(fs.existsSync(artifacts.paths.summaryMd));
    assert.ok(fs.existsSync(path.join(out, "report.sarif")));
    assert.ok(fs.existsSync(artifacts.paths.defend!));

    const v = verifyRunDir(out);
    assert.equal(v.ok, true, JSON.stringify(v.failures, null, 2));
    assert.equal(artifacts.summary.verifyOk, true);
  });

  it("draft-fix only when human flag set", async () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-factory-draft-"));
    const without = await runFactory({
      repo: defaultFixtureRepo(),
      advisory: "CWE-89",
      fixture: true,
      offline: true,
      outputDir: out,
    });
    assert.equal(without.summary.stages.draftFix, false);
    assert.equal(without.paths.draft, undefined);

    const out2 = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-factory-draft2-"));
    const withDraft = await runFactory({
      repo: defaultFixtureRepo(),
      advisory: "CWE-89",
      fixture: true,
      offline: true,
      iAskedForAFix: true,
      outputDir: out2,
    });
    assert.equal(withDraft.summary.stages.draftFix, true);
    assert.ok(withDraft.paths.draft && fs.existsSync(withDraft.paths.draft));
    const draft = fs.readFileSync(withDraft.paths.draft!, "utf8");
    assert.match(draft, /Human review|DRAFT|CodeGuard/i);
    assert.doesNotMatch(draft, /\b(metasploit|weaponize)\b/i);
  });
});
