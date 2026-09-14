import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { runMvp, formatMvpBanner } from "../../src/mvp/index.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("mvp (keyless fixture door)", () => {
  it("runMvp produces SARIF + verified evidence and PASS banner", async () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-mvp-"));
    const result = await runMvp({ cwe: "CWE-89", outputDir: out });

    assert.equal(result.ok, true, result.summary);
    assert.ok(fs.existsSync(result.locateSarif), "locate SARIF missing");
    assert.ok(fs.existsSync(result.operateSarif), "operate SARIF missing");
    assert.equal(result.verify.ok, true, JSON.stringify(result.verify.failures));
    assert.ok(result.verify.checked >= 3);

    const locateSarif = JSON.parse(fs.readFileSync(result.locateSarif, "utf8"));
    assert.equal(locateSarif.version, "2.1.0");
    assert.ok(locateSarif.runs[0].results.length >= 1);

    const banner = formatMvpBanner(result);
    assert.match(banner, /^PASS$/m);
    assert.match(banner, /Locate SARIF/);
    assert.match(banner, /Operate SARIF/);
    assert.match(banner, /antares doctor/);
    assert.match(banner, /doctor|local-brain/i);
    assert.doesNotMatch(banner, /RunPod API|creating pod|\$[0-9]/i);
  });

  it("CLI npm run mvp exits 0 with PASS", () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-mvp-cli-"));
    const r = spawnSync(
      "npx",
      ["tsx", "cli/index.ts", "mvp", "--output", out],
      {
        cwd: root,
        encoding: "utf8",
        env: { ...process.env, CI: "true" },
      },
    );
    assert.equal(r.status, 0, r.stderr || r.stdout);
    assert.match(r.stdout, /^PASS$/m);
    assert.match(r.stdout, /Locate SARIF/);
    assert.ok(fs.existsSync(path.join(out, "locate", "report.sarif")));
    assert.ok(fs.existsSync(path.join(out, "operate", "report.sarif")));
  });

  it("antares doctor is print-only (no spend)", () => {
    const r = spawnSync(
      "npx",
      ["tsx", "cli/index.ts", "antares", "doctor"],
      {
        cwd: root,
        encoding: "utf8",
        env: { ...process.env, CI: "true" },
      },
    );
    assert.equal(r.status, 0, r.stderr || r.stdout);
    assert.match(r.stdout, /print-only|Print-only/i);
    assert.match(r.stdout, /Secure Cloud A40|Secure A40/);
    assert.match(r.stdout, /huggingface\.co\/fdtn-ai\/antares-1b/);
    assert.match(r.stdout, /stop\/terminate|terminate/i);
    assert.match(r.stdout, /Does NOT create RunPod|this script will not/i);
    assert.doesNotMatch(r.stdout, /Creating pod|runpod\.create|billing/i);
  });
});
