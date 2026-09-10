import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("README adoption path sanity", () => {
  it("leads with hard limits + fixture default, then opt-in live Antares", () => {
    const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");

    assert.match(readme, /Hard limits/i);
    assert.match(readme, /No PoCs|no PoC/i);
    assert.match(readme, /never auto-merge|No auto-merge|no auto-merge/i);
    assert.match(readme, /SCOPE_AND_AUTHORIZATION\.md/);
    assert.match(readme, /SECURITY\.md/);
    assert.match(readme, /Apache-2\.0|LICENSE/);

    // Default path first: fixture before opt-in live section
    const fixtureIdx = readme.indexOf("Default path");
    const liveIdx = readme.indexOf("Opt-in live path");
    assert.ok(fixtureIdx >= 0, "missing Default path (fixture) section");
    assert.ok(liveIdx >= 0, "missing Opt-in live path section");
    assert.ok(fixtureIdx < liveIdx, "fixture default must precede opt-in live");

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
    assert.match(readme, /not an official Cisco partnership|No partnership claims|Not a Cisco product/i);
    assert.doesNotMatch(readme, /ZERODAY mandate|Cisco Antares \/ ZERODAY mandate/i);
    assert.match(readme, /report\.sarif/);
    assert.match(readme, /\/v1\/completions/);
    assert.match(readme, /--fixture/);
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
    assert.match(script, /--model/);
    assert.match(script, /fdtn-ai\/antares-1b/);
    assert.doesNotMatch(
      script.replace(/^#.*/gm, ""),
      /--fixture\b/,
    );
    assert.match(script, /mode.*live|expected 'live'/);
  });

  it("documents Mac MPS float32 server and model default", () => {
    const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
    assert.match(readme, /completions_server\.py/);
    assert.match(readme, /float32/i);
    assert.match(readme, /float16/i);
    assert.match(readme, /malformed tool_call|tool-schema unreliable|tool_call JSON/i);
    assert.match(readme, /vLLM\/CUDA|vLLM on CUDA/i);
    assert.match(readme, /does not soft-rewrite|does not rewrite/i);
    assert.match(readme, /MPS|Apple Silicon/);
    assert.match(readme, /fdtn-ai\/antares-1b/);
    assert.match(readme, /Incomplete runs|submit_vulnerable_files/);
    assert.match(readme, /--tool-budget/);
    assert.ok(
      fs.existsSync(path.join(root, "scripts/completions_server.py")),
    );
    const server = fs.readFileSync(
      path.join(root, "scripts/completions_server.py"),
      "utf8",
    );
    assert.match(server, /select_torch_dtype_name/);
    assert.match(server, /skip_special_tokens\s*=\s*False/);
    assert.match(server, /is_degenerate_exclamation_run/);
    assert.match(server, /map_frequency_to_repetition_penalty/);
    assert.match(server, /should_force_greedy_on_mps|--honor-temperature/);
  });

  it("Proof section links sample SARIF + images (no private paths)", () => {
    const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
    const proofIdx = readme.indexOf("## Proof");
    const liveIdx = readme.indexOf("30-minute live path");
    assert.ok(proofIdx >= 0, "missing Proof section");
    assert.ok(proofIdx < liveIdx || liveIdx < 0, "Proof should lead near top");
    assert.match(readme, /examples\/sample-live-sarif\/report\.sarif/);
    assert.match(readme, /docs\/images\/zeroday-locate-cli\.png/);
    assert.match(readme, /docs\/images\/zeroday-sarif-findings\.png/);
    assert.match(readme, /demo-proof\.sh/);
    assert.doesNotMatch(readme, /Webuzz|\/Users\//);

    const sample = path.join(root, "examples/sample-live-sarif/report.sarif");
    assert.ok(fs.existsSync(sample));
    const sarif = JSON.parse(fs.readFileSync(sample, "utf8"));
    assert.equal(sarif.version, "2.1.0");
    assert.match(sarif.runs[0].tool.driver.name, /ZERODAY|Antares/);
    assert.ok(sarif.runs[0].results.length >= 1);
    const blob = JSON.stringify(sarif);
    assert.doesNotMatch(blob, /\/workspace\/|\/Users\/|Webuzz/);

    for (const img of [
      "docs/images/zeroday-locate-cli.png",
      "docs/images/zeroday-sarif-findings.png",
      "docs/images/zeroday-live-path.png",
    ]) {
      assert.ok(fs.existsSync(path.join(root, img)), `missing ${img}`);
    }
  });
});
