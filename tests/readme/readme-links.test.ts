import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("README adoption path sanity", () => {
  it("leads with live Antares → SARIF and documents HF license + sister links", () => {
    const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");

    // Product path first
    const liveIdx = readme.indexOf("30-minute live path");
    const fixtureIdx = readme.indexOf("CI / no-GPU smoke");
    assert.ok(liveIdx >= 0, "missing 30-minute live path section");
    assert.ok(fixtureIdx > liveIdx, "CI/no-GPU section must follow live path");

    assert.match(readme, /huggingface\.co\/fdtn-ai\/antares-1b/);
    assert.match(readme, /cisco-foundation-ai\.github\.io\/antares/);
    assert.match(
      readme,
      /cisco-foundation-ai\/cookbook\/blob\/main\/1_quickstarts\/Quickstart_Antares\.md/,
    );
    assert.match(readme, /uv tool install cisco-antares-cli/);
    assert.match(
      readme,
      /locate[\s\S]*--endpoint http:\/\/127\.0\.0\.1:8000\/v1/,
    );
    assert.match(readme, /scripts\/quickstart-live\.sh/);
    assert.match(readme, /No fixture\/mock fallback|refuses.*fixture/i);
    assert.match(readme, /Localization ≠ exploitability|localization ≠ exploitability/i);
    assert.match(readme, /not an official Cisco partnership|No partnership claims/i);
    assert.match(readme, /report\.sarif/);
    assert.match(readme, /\/v1\/completions/);

    // Fixture labeled as CI / no-GPU, not product
    assert.match(readme, /CI \/ no-GPU/);
    assert.match(readme, /not the product path/i);
  });

  it("quickstart-live.sh refuses fixture fallback and probes endpoint", () => {
    const script = fs.readFileSync(
      path.join(root, "scripts/quickstart-live.sh"),
      "utf8",
    );
    assert.match(script, /NEVER fixture/);
    assert.match(script, /\/v1\/models/);
    assert.match(script, /--live/);
    assert.match(script, /--endpoint/);
    assert.doesNotMatch(
      script.replace(/^#.*/gm, ""),
      /--fixture\b/,
    );
    assert.match(script, /mode.*live|expected 'live'/);
  });
});
