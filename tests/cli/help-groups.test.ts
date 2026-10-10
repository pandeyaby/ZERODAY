/**
 * `zeroday --help` shows the stable commands and a short experimental list;
 * specialist commands move to `zeroday labs` but keep working unchanged.
 */

import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const cli = path.join(root, "cli/index.ts");
const run = (...args: string[]) =>
  spawnSync("npx", ["tsx", cli, ...args], { cwd: root, encoding: "utf8", env: { ...process.env, FORCE_COLOR: "0" }, timeout: 120_000 });
const commandsIn = (help: string, group: string) =>
  (help.split(group)[1] ?? "").split(/\n\S/)[0]!.split("\n").map((l) => /^  ([a-z][\w:-]*)/.exec(l)?.[1]).filter(Boolean);

describe("CLI help groups", () => {
  const main = run("--help");

  it("lists the stable commands first, in reading order", () => {
    assert.equal(main.status, 0);
    assert.deepEqual(commandsIn(main.stdout, "Core commands (stable):"), ["locate", "scan", "antares", "verify", "mvp", "doctor", "operate"]);
  });

  it("keeps the main help short and points to labs", () => {
    assert.deepEqual(commandsIn(main.stdout, "More commands (experimental):"), ["plan", "export", "upload-sarif", "draft-fix", "play", "labs"]);
    for (const hidden of ["factory", "paired-probe", "prove-doors", "gpu-evidence", "sweep"]) {
      assert.doesNotMatch(main.stdout, new RegExp(`^  ${hidden} `, "m"), hidden);
    }
  });

  it("labs lists the specialist commands, and they still run", () => {
    const labs = run("labs");
    assert.equal(labs.status, 0);
    for (const name of ["factory", "paired-probe", "prove-doors", "gpu-evidence", "sweep", "inventory"]) {
      assert.match(labs.stdout, new RegExp(`^  ${name} `, "m"), name);
    }
    const factory = run("factory", "--help");
    assert.equal(factory.status, 0);
    assert.match(factory.stdout, /Usage: zeroday factory/);
  });
});
