/**
 * Keyless K1 — locate --rules mode + CWE-89 heuristics.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  resolveLocateMode,
  MIXED_MODE_REFUSED,
} from "../../src/locate/live-guard.ts";
import {
  locate,
  defaultFixtureRepo,
  runRulesLocalization,
} from "../../src/locate/index.ts";
import { scanRepoForCwe89 } from "../../src/locate/rules/cwe-89.ts";
import { scanRepoForCwe22 } from "../../src/locate/rules/cwe-22.ts";
import { walkSourceFiles } from "../../src/locate/rules/walk.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const rulesSample = path.join(root, "fixtures/locate/rules-sample");
const demoApp = path.join(root, "fixtures/locate/demo-app");

describe("locate --rules mode resolution", () => {
  it("resolveLocateMode: --rules → rules", () => {
    assert.equal(resolveLocateMode({ rules: true }), "rules");
  });

  it("refuses --rules + --fixture", () => {
    assert.throws(
      () => resolveLocateMode({ rules: true, fixture: true }),
      (e: Error) =>
        e.message.includes("mixed mode") || e.message === MIXED_MODE_REFUSED,
    );
  });

  it("refuses --rules + --endpoint / --live", () => {
    assert.throws(
      () =>
        resolveLocateMode({
          rules: true,
          endpoint: "http://127.0.0.1:8000/v1",
        }),
      /mixed mode|Refusing/,
    );
    assert.throws(
      () => resolveLocateMode({ rules: true, live: true }),
      /mixed mode|Refusing/,
    );
  });

  it("default and --fixture still → fixture (mvp unchanged)", () => {
    assert.equal(resolveLocateMode({}), "fixture");
    assert.equal(resolveLocateMode({ fixture: true }), "fixture");
  });
});

describe("CWE-89 rules heuristics", () => {
  it("hits demo-app users.js SQL concat", () => {
    const { files } = walkSourceFiles(demoApp);
    const { hits } = scanRepoForCwe89(files);
    assert.ok(hits.length >= 1, "expected ≥1 CWE-89 hit on demo-app");
    assert.ok(
      hits.some((h) => h.filePath === "src/users.js"),
      "expected src/users.js among hits",
    );
  });

  it("hits rules-sample search.js", () => {
    const { files } = walkSourceFiles(rulesSample);
    const { hits } = scanRepoForCwe89(files);
    assert.ok(hits.length >= 1, "expected ≥1 CWE-89 hit on rules-sample");
    assert.ok(hits.some((h) => h.filePath.includes("search.js")));
  });

  it("runRulesLocalization emits mode=rules + honest warnings", () => {
    const result = runRulesLocalization(
      { kind: "cwe", id: "CWE-89", cweId: "CWE-89" },
      rulesSample,
    );
    assert.equal(result.mode, "rules");
    assert.equal(result.model, "zeroday/rules-heuristics");
    assert.ok(result.rankedFiles.length >= 1);
    assert.ok(result.explorationTrace.some((t) => /rules/i.test(t.command)));
    assert.ok(
      result.warnings.some((w) => /not Antares/i.test(w)),
      "honest Antares warning required",
    );
    assert.ok(result.posture.localizationOnly);
    assert.ok(result.posture.notExploitProof);
    assert.ok(result.posture.noPoC);
  });
});

describe("locate({ rules: true }) end-to-end", () => {
  it("writes report.json / SARIF with mode rules and ≥1 finding", async () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-rules-"));
    const artifacts = await locate({
      repo: rulesSample,
      advisory: "CWE-89",
      rules: true,
      offline: true,
      outputDir: out,
    });
    assert.equal(artifacts.result.mode, "rules");
    assert.ok(artifacts.result.rankedFiles.length >= 1);
    assert.ok(fs.existsSync(artifacts.jsonPath));
    assert.ok(fs.existsSync(artifacts.sarifPath));
    assert.ok(fs.existsSync(artifacts.manifestPath!));

    const report = JSON.parse(fs.readFileSync(artifacts.jsonPath, "utf8")) as {
      mode: string;
      summary: { findingCount: number };
    };
    assert.equal(report.mode, "rules");
    assert.ok(report.summary.findingCount >= 1);

    const sarif = JSON.parse(fs.readFileSync(artifacts.sarifPath, "utf8")) as {
      runs: Array<{
        results: Array<{ properties?: { mode?: string } }>;
        properties?: { mode?: string };
      }>;
    };
    assert.equal(sarif.runs[0]?.properties?.mode, "rules");
  });

  it("locate refuses mixed --rules + --fixture", async () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-rules-mix-"));
    await assert.rejects(
      () =>
        locate({
          repo: defaultFixtureRepo(),
          advisory: "CWE-89",
          rules: true,
          fixture: true,
          outputDir: out,
        }),
      /mixed mode|Refusing/,
    );
  });

  it("locate refuses mixed --rules + --endpoint", async () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-rules-live-"));
    await assert.rejects(
      () =>
        locate({
          repo: rulesSample,
          advisory: "CWE-89",
          rules: true,
          endpoint: "http://127.0.0.1:8000/v1",
          outputDir: out,
        }),
      /mixed mode|Refusing/,
    );
  });
});

function writeRepo(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-rules-repo-"));
  for (const [rel, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), `${body}\n`);
  }
  return dir;
}

describe("CWE-22 rules heuristics", () => {
  it("does not flag module imports or static-dir idioms", () => {
    const dir = writeRepo({
      "a.js": `const db = require('../lib/db');`,
      "b.ts": `import { x } from "../lib/x";`,
      "c.ts": `export * from "../lib/y";`,
      "d.py": `from ..models import User`,
      "e.js": `app.use(express.static(path.join(__dirname, "../public")));`,
      "f.js": `window.open("../help.html");`,
      "g.js": `const lazy = await import("../chunk.js");`,
    });
    const { hits } = scanRepoForCwe22(walkSourceFiles(dir).files);
    assert.deepEqual(hits.map((h) => h.filePath), []);
  });

  it("flags request-derived and ../ filesystem paths", () => {
    const dir = writeRepo({
      "h.js": `res.sendFile(path.join(root, req.params.file));`,
      "i.js": `fs.readFileSync(base + req.query.name);`,
      "j.js": `const p = path.resolve(uploads, req.body.path);`,
      "k.py": `data = open("../conf/settings.ini").read()`,
    });
    const { hits } = scanRepoForCwe22(walkSourceFiles(dir).files);
    assert.deepEqual(
      hits.map((h) => h.filePath).sort(),
      ["h.js", "i.js", "j.js", "k.py"],
    );
  });
});

describe("rules mode — unsupported CWE is not a clean negative", () => {
  it("marks unsupported CWEs as not scanned", () => {
    const result = runRulesLocalization(
      { kind: "cwe", id: "CWE-78", cweId: "CWE-78" },
      rulesSample,
    );
    assert.equal(result.rankedFiles.length, 0);
    assert.equal(result.summary.unsupportedCwe, true);
    assert.ok(result.warnings.some((w) => w.startsWith("NOT SCANNED")));
  });

  it("supported CWEs do not carry the flag", () => {
    const result = runRulesLocalization(
      { kind: "cwe", id: "CWE-89", cweId: "CWE-89" },
      rulesSample,
    );
    assert.equal(result.summary.unsupportedCwe, undefined);
  });

  it("report.md and comment.md say Not scanned", async () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-rules-unsup-"));
    await locate({
      repo: rulesSample,
      advisory: "CWE-78",
      rules: true,
      offline: true,
      outputDir: out,
    });
    assert.match(fs.readFileSync(path.join(out, "report.md"), "utf8"), /### Not scanned/);
    const comment = fs.readFileSync(path.join(out, "comment.md"), "utf8");
    assert.match(comment, /\*\*Not scanned\*\*/);
    assert.doesNotMatch(comment, /No vulnerable files submitted/);
  });
});
