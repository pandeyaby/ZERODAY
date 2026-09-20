import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(import.meta.url);

describe("GitHub Action PR comment (fail-closed)", () => {
  it("composite action posts PR comment without continue-on-error", () => {
    const actionPath = path.join(
      root,
      ".github/actions/zeroday-locate-gate/action.yml",
    );
    const yml = fs.readFileSync(actionPath, "utf8");

    assert.match(yml, /Post reviewable PR comment/);
    assert.match(yml, /post-pr-comment\.js/);
    assert.match(yml, /Fail closed if PR comment step broke/);
    assert.match(yml, /pull_request/);
    assert.match(yml, /Ranked candidate files/);
    assert.match(yml, /resolve-locate-cmd\.js/);
    assert.match(yml, /mode:\s*\n\s*description:/);
    assert.match(yml, /default:\s*fixture/);

    // Comment step must not soft-fail
    const commentBlock = yml.slice(
      yml.indexOf("Post reviewable PR comment"),
      yml.indexOf("Fail closed if PR comment step broke"),
    );
    assert.doesNotMatch(commentBlock, /continue-on-error:\s*true/);

    // Keyless locate step must resolve via helper — never wire --endpoint/--live
    const runBlock = yml.slice(
      yml.indexOf("Keyless locate"),
      yml.indexOf("Optional antares"),
    );
    assert.match(runBlock, /resolve-locate-cmd\.js/);
    assert.match(runBlock, /Never --endpoint \/ --live/);
    assert.doesNotMatch(runBlock, /npm run zeroday -- locate[^\n]*(--endpoint|--live)/);

    const resolver = fs.readFileSync(
      path.join(root, ".github/actions/zeroday-locate-gate/resolve-locate-cmd.js"),
      "utf8",
    );
    assert.match(resolver, /expectedMode:\s*"fixture"/);
    assert.match(resolver, /--fixture/);
    assert.match(resolver, /live Antares/);
    // argv arrays must never include live flags (mentions in refuse errors are ok)
    assert.doesNotMatch(
      resolver,
      /argv:\s*\[[^\]]*(--endpoint|--live)/,
    );
  });

  it("workflow enables pull-requests: write and post-comment", () => {
    const wf = fs.readFileSync(
      path.join(root, ".github/workflows/zeroday-locate.yml"),
      "utf8",
    );
    assert.match(wf, /pull-requests:\s*write/);
    assert.match(wf, /post-comment:\s*"true"/);
    assert.match(wf, /upload-sarif:\s*"true"/);
    assert.match(wf, /mode:\s*fixture/);
    assert.match(wf, /org-path:/);
    assert.match(wf, /mode:\s*rules/);
    assert.match(wf, /mode:\s*recording/);
    assert.match(wf, /org-recordings\/rules-cwe-89\.cassette\.json/);
    assert.match(wf, /cassette:replay/);
    assert.match(wf, /expect-file src\/search\.js/);
  });

  it("post-pr-comment.js requires ranked findings and human-review posture", async () => {
    const mod = require(
      path.join(root, ".github/actions/zeroday-locate-gate/post-pr-comment.js"),
    );
    const tmp = path.join(root, "zeroday-reports", "_test-comment.md");
    fs.mkdirSync(path.dirname(tmp), { recursive: true });
    fs.writeFileSync(tmp, "incomplete body without markers\n");

    await assert.rejects(
      () =>
        mod({
          github: {},
          context: { repo: { owner: "o", repo: "r" }, payload: {} },
          core: { info() {} },
          commentPath: tmp,
        }),
      /ranked-files|missing/,
    );

    fs.writeFileSync(
      tmp,
      "## ZERODAY\n\n> **Human review required.**\n\n### Ranked candidate files\n\n#### 1. `src/users.js`\n",
    );

    let created = false;
    const result = await mod({
      github: {
        paginate: async () => [],
        rest: {
          issues: {
            createComment: async () => {
              created = true;
              return { data: { id: 42 } };
            },
            updateComment: async () => {
              throw new Error("should create not update");
            },
            listComments: async () => ({ data: [] }),
          },
        },
      },
      context: {
        repo: { owner: "o", repo: "r" },
        payload: { pull_request: { number: 7 } },
      },
      core: { info() {} },
      commentPath: tmp,
    });
    assert.equal(created, true);
    assert.equal(result.action, "created");
    fs.unlinkSync(tmp);
  });
});
