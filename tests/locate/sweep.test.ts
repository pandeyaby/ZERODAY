import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const cli = path.join(root, "cli/index.ts");

describe("sweep (offline message)", () => {
  it("prints clear offline message without endpoint and exits 0", () => {
    const r = spawnSync(
      "npx",
      ["tsx", cli, "sweep", "--fixture"],
      {
        cwd: root,
        encoding: "utf8",
        env: { ...process.env, ANTARES_ENDPOINT: "" },
      },
    );
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /offline|no live endpoint/i);
    assert.match(r.stdout, /operate --cwe/i);
  });
});
