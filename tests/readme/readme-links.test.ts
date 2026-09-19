import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("README adoption path sanity", () => {
  it("leads with Start-in-2-minutes + hard limits, then opt-in live Antares (costs $)", () => {
    const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
    const pathsDoc = fs.readFileSync(path.join(root, "docs/paths.md"), "utf8");

    assert.match(readme, /Hard limits/i);
    assert.match(readme, /No PoCs|no PoC/i);
    assert.match(readme, /never auto-merge|No auto-merge|no auto-merge/i);
    assert.match(readme, /SCOPE_AND_AUTHORIZATION\.md/);
    assert.match(readme, /SECURITY\.md/);
    assert.match(readme, /Apache-2\.0|LICENSE/);

    // Single front door: Start / MVP before live
    const startIdx = Math.max(
      readme.indexOf("## Start in 2 minutes"),
      readme.indexOf("## MVP path"),
    );
    const liveIdx = Math.max(
      readme.indexOf("## When you want live Antares"),
      readme.indexOf("## Live Antares"),
    );
    const defaultIdx = readme.indexOf("## Default path");
    assert.ok(startIdx >= 0, "missing Start in 2 minutes / MVP path section");
    assert.ok(liveIdx >= 0, "missing live Antares section");
    assert.ok(startIdx < liveIdx, "Start/MVP path must precede Live Antares");
    assert.ok(
      defaultIdx < 0 || liveIdx < defaultIdx,
      "Live Antares teaser should stay above deep Default path details",
    );

    assert.match(readme, /npm run mvp/);
    assert.match(readme, /git clone.*ZERODAY/i);
    assert.match(readme, /npm run play/);
    assert.match(readme, /costs \$/);
    assert.match(readme, /antares doctor/);
    assert.match(readme, /npm run zeroday -- doctor|zeroday -- doctor/);
    assert.match(readme, /docs\/local-brain\.md/);
    assert.match(readme, /Local OpenAI-compatible brain|Keyless K4/i);
    assert.match(readme, /arbitrary local models|≠ Antares File F1|NOT Antares File F1/i);
    assert.match(readme, /never auto-provisions|never creates paid RunPod/i);
    assert.match(readme, /huggingface\.co\/fdtn-ai\/antares-1b/);
    assert.match(readme, /cisco-foundation-ai\.github\.io\/antares/);
    assert.match(
      readme,
      /cisco-foundation-ai\/cookbook\/blob\/main\/1_quickstarts\/Quickstart_Antares\.md/,
    );
    // Deep install / live details live in docs/paths.md (README stays skim-first)
    assert.match(pathsDoc, /uv tool install cisco-antares-cli/);
    assert.match(
      readme,
      /locate[\s\S]*--endpoint http:\/\/127\.0\.0\.1:8000\/v1/,
    );
    assert.match(readme, /scripts\/quickstart-live\.sh/);
    assert.match(readme, /No silent fixture fallback|no silent fixture fallback/i);
    assert.match(readme, /Localization ≠ exploitability|localization ≠ exploitability/i);
    assert.match(readme, /not an official Cisco partnership|No partnership claims|Not a Cisco product/i);
    assert.match(readme, /docs\/faq\.md/);
    assert.doesNotMatch(readme, /ZERODAY mandate|Cisco Antares \/ ZERODAY mandate/i);
    assert.match(readme, /report\.sarif/);
    assert.match(readme, /\/v1\/completions/);
    assert.match(readme, /--fixture/);
    assert.match(readme, /docs\/runpod-antares\.md/);
    assert.match(readme, /docs\/paths\.md/);
    // World-ready: DIPTYCH paired-trace layer + required CI gates
    assert.match(readme, /DIPTYCH/);
    assert.match(readme, /paired-probe/);
    assert.match(readme, /gate_axis_mutate/);
    assert.match(readme, /docs\/images\/zeroday-trust-pipeline\.svg/);
    assert.match(readme, /docs\/images\/zeroday-diptych-architecture\.png/);
    assert.match(readme, /github\.com\/pandeyaby\/DIPTYCH/);
    assert.match(readme, /AUROC|auroc/i);
    assert.match(readme, /SUPPORT\.md/);
    assert.match(readme, /docs\/design-partner-trust\.md/);
    assert.match(readme, /docs\/ci-trust\.md/);
    assert.match(
      readme,
      /actions\/workflows\/zeroday-locate\.yml\/badge\.svg/,
    );
    assert.match(readme, /never exploit theater|No PoCs, exploits/i);
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

  it("documents Mac MPS float32 server and model default (deep paths doc)", () => {
    const pathsDoc = fs.readFileSync(path.join(root, "docs/paths.md"), "utf8");
    assert.match(pathsDoc, /completions_server\.py/);
    assert.match(pathsDoc, /float32/i);
    assert.match(pathsDoc, /float16/i);
    assert.match(pathsDoc, /malformed tool_call|tool-schema unreliable|tool_call JSON/i);
    assert.match(pathsDoc, /vLLM\/CUDA|vLLM on CUDA/i);
    assert.match(pathsDoc, /does not soft-rewrite|does not rewrite/i);
    assert.match(pathsDoc, /MPS|Apple Silicon/);
    assert.match(pathsDoc, /fdtn-ai\/antares-1b/);
    assert.match(pathsDoc, /Incomplete runs|submit_vulnerable_files|no invented findings/i);
    assert.match(pathsDoc, /--tool-budget/);
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
    const startIdx = Math.max(
      readme.indexOf("## Start in 2 minutes"),
      readme.indexOf("## MVP path"),
    );
    assert.ok(proofIdx >= 0, "missing Proof section");
    assert.ok(startIdx >= 0 && startIdx < proofIdx, "Start/MVP path must lead before Proof");
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
      "docs/images/zeroday-diptych-architecture.png",
      "docs/images/zeroday-trust-pipeline.svg",
    ]) {
      assert.ok(fs.existsSync(path.join(root, img)), `missing ${img}`);
    }
  });


  it("package.json exposes mvp script", () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(root, "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };
    assert.ok(pkg.scripts.mvp, "npm run mvp required");
    assert.match(pkg.scripts.mvp, /\bmvp\b/);
  });
});
