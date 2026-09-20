/**
 * Door test: stranger prove-doors (stranger:verify / doors) — keyless glue.
 * Asserts package scripts, docs links, honest card facts, and exit 0 on
 * the keyless path (reuses trust-loop; never runs live GPU).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import os from "node:os";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("stranger prove-doors (stranger:verify)", () => {
  it("package.json exposes stranger:verify + doors → scripts/stranger-verify.sh", () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(root, "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };
    assert.ok(pkg.scripts["stranger:verify"], "missing npm run stranger:verify");
    assert.ok(pkg.scripts.doors, "missing npm run doors alias");
    assert.match(pkg.scripts["stranger:verify"], /stranger-verify\.sh/);
    assert.match(pkg.scripts.doors, /stranger-verify\.sh/);
    assert.ok(
      fs.existsSync(path.join(root, "scripts/stranger-verify.sh")),
      "missing scripts/stranger-verify.sh",
    );
    const script = fs.readFileSync(
      path.join(root, "scripts/stranger-verify.sh"),
      "utf8",
    );
    assert.match(script, /trust-loop/);
    assert.match(script, /gpu-claims\.md/);
    assert.match(script, /Live re-proof|2026-09-19/);
    assert.match(script, /d65ny3xqf7bwza/);
    assert.match(script, /\$0\.034|0\.034/);
    assert.match(script, /src\/users\.js/);
    assert.match(script, /localization ≠ exploitability|localization != exploitability/i);
    assert.match(script, /CI badge|ci-trust/i);
    assert.match(script, /no AUROC|AUROC/i);
    assert.match(script, /DIPTYCH grades/i);
    assert.match(script, /illustrative/i);
    assert.match(script, /--json|ZERODAY_STRANGER_JSON/);
    assert.match(script, /zeroday-stranger-verify\/v1/);
    assert.match(script, /mode.*citation|"citation"/);
    assert.match(script, /--live-url/);
    assert.match(script, /operator_endpoint/);
    assert.match(script, /provisioned:\s*false|provisioned.: false/);
    assert.match(script, /spendUsd/);
    // Must not auto-provision, create pods, or pull HF weights
    assert.doesNotMatch(script, /create-pod|runpod create|auto-provision/i);
    assert.doesNotMatch(
      script,
      /huggingface\.co\/.*download|model\.safetensors|hf download/i,
    );
    assert.match(script, /NOT run|citation only|Do not provision|Never provisions/i);
    assert.match(script, /Never invokes RunPod pod-creation|no RunPod pod-creation/i);
  });

  it("README links ci-trust + gpu-claims and documents stranger:verify", () => {
    const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
    assert.match(readme, /What a stranger can verify today/i);
    assert.match(readme, /npm run stranger:verify/);
    assert.match(readme, /npm run doors/);
    assert.match(readme, /docs\/ci-trust\.md/);
    assert.match(readme, /docs\/gpu-claims\.md/);
    assert.match(readme, /docs\/stranger-verify\.md/);
    assert.match(readme, /d65ny3xqf7bwza/);
    assert.match(readme, /Live re-proof \(2026-09-19\)/);
    assert.match(readme, /localization ≠ exploitability|localization != exploitability/i);
    assert.match(readme, /CI badge ≠ vuln|CI badge.*vuln/i);
    assert.match(readme, /no AUROC|AUROC/i);
    // Clone-free Door A via Codespaces (no local Node)
    assert.match(readme, /codespaces\.new\/pandeyaby\/ZERODAY/);
    assert.match(readme, /Codespace ≠ live Antares|Codespace.*live Antares/i);
  });

  it("docs/stranger-verify.md + docs index + ci-trust cross-link", () => {
    const docPath = path.join(root, "docs/stranger-verify.md");
    assert.ok(fs.existsSync(docPath), "missing docs/stranger-verify.md");
    const doc = fs.readFileSync(docPath, "utf8");
    assert.match(doc, /stranger:verify/);
    assert.match(doc, /trust-loop/);
    assert.match(doc, /--json|ZERODAY_STRANGER_JSON/);
    assert.match(doc, /--live-url/);
    assert.match(doc, /operator_endpoint/);
    assert.match(doc, /probe ≠ measured|Probe ≠ measured/i);
    assert.match(doc, /ci-trust\.md/);
    assert.match(doc, /gpu-claims\.md/);
    assert.match(doc, /d65ny3xqf7bwza/);
    assert.match(doc, /2026-09-19/);
    assert.match(doc, /no AUROC|AUROC/i);
    assert.match(doc, /DIPTYCH grades/i);
    assert.match(doc, /codespaces\.new\/pandeyaby\/ZERODAY/);
    assert.match(doc, /Codespace ≠ live Antares|Codespace.*live Antares/i);
    assert.match(
      doc,
      /uses:\s*pandeyaby\/ZERODAY\/\.github\/workflows\/stranger-verify\.yml@main/,
    );

    const gpuClaims = fs.readFileSync(
      path.join(root, "docs/gpu-claims.md"),
      "utf8",
    );
    assert.match(gpuClaims, /--live-url/);
    assert.match(gpuClaims, /operator_endpoint|probe ≠ measured|Probe ≠ measured/i);
    assert.match(gpuClaims, /provisioned:\s*false|provisioned.: false/);
    assert.match(gpuClaims, /Live re-proof \(2026-09-19/);

    const index = fs.readFileSync(path.join(root, "docs/README.md"), "utf8");
    assert.match(index, /stranger-verify\.md/);

    const ciTrust = fs.readFileSync(path.join(root, "docs/ci-trust.md"), "utf8");
    assert.match(ciTrust, /stranger:verify|stranger-verify/);
    assert.match(ciTrust, /stranger-verify\.yml/);
  });

  it(".devcontainer is valid JSON + keyless Codespace path (no GPU / HF)", () => {
    const dcPath = path.join(root, ".devcontainer/devcontainer.json");
    assert.ok(fs.existsSync(dcPath), "missing .devcontainer/devcontainer.json");
    const raw = fs.readFileSync(dcPath, "utf8");
    const dc = JSON.parse(raw) as {
      image?: string;
      postCreateCommand?: string;
      postStartCommand?: string;
      forwardPorts?: number[];
    };
    assert.ok(dc.image, "devcontainer needs an image (Node LTS)");
    assert.match(String(dc.image), /node|javascript-node/i);
    assert.equal(dc.postCreateCommand, "npm install");
    assert.ok(dc.postStartCommand, "expected tip-only postStartCommand");
    assert.doesNotMatch(
      JSON.stringify(dc),
      /HF_TOKEN|huggingface\.co\/.*download|create-pod|runpod create|--endpoint|--live/i,
    );
    const tip = fs.readFileSync(
      path.join(root, ".devcontainer/print-prove-doors-tip.sh"),
      "utf8",
    );
    assert.match(tip, /stranger:verify/);
    assert.match(tip, /Door A/);
    assert.match(tip, /Codespace ≠ live Antares|no HF gated|citation/i);
    assert.match(tip, /no RunPod auto-provision|no.*auto-provision/i);
    assert.doesNotMatch(tip, /create-pod|runpod create|HF_TOKEN/i);

    const tasksPath = path.join(root, ".vscode/tasks.json");
    assert.ok(fs.existsSync(tasksPath), "missing .vscode/tasks.json");
    const tasks = JSON.parse(fs.readFileSync(tasksPath, "utf8")) as {
      tasks: Array<{ label?: string; command?: string }>;
    };
    const prove = tasks.tasks.find((t) =>
      /prove-doors|stranger:verify/i.test(String(t.label ?? "")),
    );
    assert.ok(prove, "missing VS Code prove-doors task");
    assert.match(String(prove.command), /stranger:verify/);
  });

  it("npm run stranger:verify exits 0 on keyless path", () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-stranger-"));
    const result = spawnSync("npm", ["run", "stranger:verify"], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, TRUST_LOOP_OUT: out },
      timeout: 120_000,
    });
    assert.equal(
      result.status,
      0,
      `stranger:verify failed:\n${result.stdout}\n${result.stderr}`,
    );
    assert.match(result.stdout, /Door A/i);
    assert.match(result.stdout, /Door B/i);
    assert.match(result.stdout, /PASS/);
    assert.match(result.stdout, /d65ny3xqf7bwza/);
    assert.match(result.stdout, /src\/users\.js/);
    assert.match(result.stdout, /gpu-claims\.md/);
    assert.doesNotMatch(result.stdout, /\bAUROC\s*[:=]\s*0?\.\d+/i);
    assert.ok(
      fs.existsSync(path.join(out, "paired-probe")),
      "expected paired-probe envelopes under TRUST_LOOP_OUT",
    );
  });

  it("--json prints parseable object with doorA/doorB/nonClaims (no live GPU claim)", () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-stranger-json-"));
    const pathEnv = `${path.join(root, "node_modules", ".bin")}${path.delimiter}${process.env.PATH ?? ""}`;
    const result = spawnSync(
      "bash",
      ["scripts/stranger-verify.sh", "--json"],
      {
        cwd: root,
        encoding: "utf8",
        env: { ...process.env, TRUST_LOOP_OUT: out, PATH: pathEnv },
        timeout: 120_000,
      },
    );
    assert.equal(
      result.status,
      0,
      `stranger:verify --json failed:\n${result.stdout}\n${result.stderr}`,
    );

    const payload = JSON.parse(result.stdout.trim()) as {
      schemaVersion: string;
      doorA: {
        status: string;
        ran: boolean;
        command: string;
        artifacts: Record<string, string>;
      };
      doorB: {
        mode: string;
        ran: boolean;
        citation: { doc: string; section: string };
      };
      nonClaims: Record<string, boolean>;
    };

    assert.equal(payload.schemaVersion, "zeroday-stranger-verify/v1");
    assert.ok(payload.doorA, "missing doorA");
    assert.ok(payload.doorB, "missing doorB");
    assert.ok(payload.nonClaims, "missing nonClaims");

    assert.equal(payload.doorA.status, "pass");
    assert.equal(payload.doorA.ran, true);
    assert.match(payload.doorA.command, /trust-loop/);
    assert.ok(payload.doorA.artifacts.envelopes);
    assert.ok(payload.doorA.artifacts.matrix);
    assert.match(payload.doorA.artifacts.sampleGradeMd, /diptych-sample-grade/);

    assert.equal(payload.doorB.mode, "citation");
    assert.equal(payload.doorB.ran, false, "Door B must not claim live GPU ran");
    assert.match(payload.doorB.citation.doc, /gpu-claims\.md/);
    assert.match(payload.doorB.citation.section, /Live re-proof/);

    assert.equal(payload.nonClaims.localizationNotExploitability, true);
    assert.equal(payload.nonClaims.noAurocFileF1OrgLatencySla, true);
    assert.equal(payload.nonClaims.diptychGradesSeparately, true);

    // Honest: stdout is JSON only; Door B did not run live GPU
    assert.doesNotMatch(result.stdout, /PROVE-DOORS CARD/);
    assert.doesNotMatch(result.stdout, /liveGpuRan"\s*:\s*true/i);
  });

  it("ZERODAY_STRANGER_JSON=1 matches --json schema keys", () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-stranger-env-"));
    const pathEnv = `${path.join(root, "node_modules", ".bin")}${path.delimiter}${process.env.PATH ?? ""}`;
    const result = spawnSync("bash", ["scripts/stranger-verify.sh"], {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        TRUST_LOOP_OUT: out,
        ZERODAY_STRANGER_JSON: "1",
        PATH: pathEnv,
      },
      timeout: 120_000,
    });
    assert.equal(
      result.status,
      0,
      `ZERODAY_STRANGER_JSON failed:\n${result.stdout}\n${result.stderr}`,
    );
    const payload = JSON.parse(result.stdout.trim()) as {
      schemaVersion: string;
      doorA: unknown;
      doorB: { ran: boolean; mode: string };
      nonClaims: unknown;
    };
    assert.equal(payload.schemaVersion, "zeroday-stranger-verify/v1");
    assert.ok(payload.doorA);
    assert.ok(payload.doorB);
    assert.ok(payload.nonClaims);
    assert.equal(payload.doorB.mode, "citation");
    assert.equal(payload.doorB.ran, false);
  });

  it("--live-url probes mocked /v1/models (operator_endpoint · no provision)", async () => {
    const http = await import("node:http");
    let hitModels = 0;
    const server = http.createServer((req, res) => {
      if (req.method === "GET" && req.url === "/v1/models") {
        hitModels += 1;
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ data: [{ id: "mock-model" }] }));
        return;
      }
      res.writeHead(404);
      res.end("nope");
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const addr = server.address();
    assert.ok(addr && typeof addr === "object");
    const liveUrl = `http://127.0.0.1:${addr.port}/v1`;

    try {
      const out = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-stranger-probe-"));
      const pathEnv = `${path.join(root, "node_modules", ".bin")}${path.delimiter}${process.env.PATH ?? ""}`;
      // Use async spawn so this process's mock HTTP server can accept while the
      // child runs (spawnSync would block the event loop and starve the server).
      const result = await new Promise<{
        status: number | null;
        stdout: string;
        stderr: string;
      }>((resolve, reject) => {
        const child = spawn(
          "bash",
          ["scripts/stranger-verify.sh", "--json", "--live-url", liveUrl],
          {
            cwd: root,
            env: {
              ...process.env,
              TRUST_LOOP_OUT: out,
              PATH: pathEnv,
              // Red herrings — script must not use these to pull weights / create pods
              HF_TOKEN: "should-not-be-used-for-weights",
              RUNPOD_API_KEY: "should-not-create-pods",
            },
          },
        );
        let stdout = "";
        let stderr = "";
        const timer = setTimeout(() => {
          child.kill("SIGKILL");
          reject(new Error("stranger:verify --live-url timed out"));
        }, 120_000);
        child.stdout.setEncoding("utf8");
        child.stderr.setEncoding("utf8");
        child.stdout.on("data", (chunk: string) => {
          stdout += chunk;
        });
        child.stderr.on("data", (chunk: string) => {
          stderr += chunk;
        });
        child.on("error", (err) => {
          clearTimeout(timer);
          reject(err);
        });
        child.on("close", (code) => {
          clearTimeout(timer);
          resolve({ status: code, stdout, stderr });
        });
      });

      assert.equal(
        result.status,
        0,
        `stranger:verify --live-url failed:\n${result.stdout}\n${result.stderr}`,
      );

      const payload = JSON.parse(result.stdout.trim()) as {
        schemaVersion: string;
        doorA: { ran: boolean; status: string };
        doorB: {
          mode: string;
          ran: boolean;
          provisioned?: boolean;
          spendUsd?: number | null;
          probe?: {
            ok: boolean;
            httpStatus: number | null;
            latencyMs: number | null;
            modelsUrl: string;
            provisioned?: boolean;
            spendUsd?: number | null;
            mode?: string;
          };
          citation?: { section: string };
          note?: string;
        };
        nonClaims: Record<string, boolean>;
      };

      assert.equal(payload.schemaVersion, "zeroday-stranger-verify/v1");
      assert.equal(payload.doorA.status, "pass");
      assert.equal(payload.doorA.ran, true);

      assert.equal(payload.doorB.mode, "operator_endpoint");
      assert.equal(payload.doorB.ran, true);
      assert.equal(payload.doorB.provisioned, false);
      assert.equal(payload.doorB.spendUsd, null);
      assert.ok(payload.doorB.probe, "missing doorB.probe");
      assert.equal(payload.doorB.probe.ok, true);
      assert.equal(payload.doorB.probe.httpStatus, 200);
      assert.equal(typeof payload.doorB.probe.latencyMs, "number");
      assert.ok(
        (payload.doorB.probe.latencyMs as number) >= 0,
        "latencyMs should be non-negative",
      );
      assert.match(payload.doorB.probe.modelsUrl, /\/v1\/models$/);
      assert.equal(payload.doorB.probe.provisioned, false);
      assert.equal(payload.doorB.probe.spendUsd, null);
      assert.equal(payload.doorB.probe.mode, "operator_endpoint");
      assert.match(
        String(payload.doorB.citation?.section ?? ""),
        /Live re-proof/,
      );
      assert.match(
        String(payload.doorB.note ?? ""),
        /not measured|probe only|A40/i,
      );

      assert.equal(payload.nonClaims.noRunPodCreateFromStrangerVerify, true);
      assert.equal(payload.nonClaims.probeNotMeasuredA40ReProof, true);

      // No provision / spend / invent language in machine output
      assert.doesNotMatch(result.stdout, /create-pod|auto-provision|provisioned.: true/i);
      assert.doesNotMatch(result.stdout, /\bAUROC\s*[:=]\s*0?\.\d+/i);
      assert.doesNotMatch(result.stdout, /"spendUsd"\s*:\s*[1-9]/);
      assert.ok(hitModels >= 1, "expected GET /v1/models against mock server");
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }
  });

  it("without --live-url Door B stays citation-only (no probe key)", () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-stranger-cite-"));
    const pathEnv = `${path.join(root, "node_modules", ".bin")}${path.delimiter}${process.env.PATH ?? ""}`;
    const result = spawnSync(
      "bash",
      ["scripts/stranger-verify.sh", "--json"],
      {
        cwd: root,
        encoding: "utf8",
        env: { ...process.env, TRUST_LOOP_OUT: out, PATH: pathEnv },
        timeout: 120_000,
      },
    );
    assert.equal(result.status, 0, result.stderr);
    const payload = JSON.parse(result.stdout.trim()) as {
      doorB: { mode: string; ran: boolean; probe?: unknown };
    };
    assert.equal(payload.doorB.mode, "citation");
    assert.equal(payload.doorB.ran, false);
    assert.equal(payload.doorB.probe, undefined);
  });
});
