import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  formatLocalBrainDoctorChecklist,
  checkLocalBrainEndpointShape,
  CHAT_ONLY_REFUSED,
  QUALITY_HONESTY,
  LOCAL_BRAIN_DOCS,
} from "../../src/doctor/index.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("local-brain doctor (Keyless K4)", () => {
  it("print-only checklist asserts completions, ACK, honesty, no spend language", () => {
    const text = formatLocalBrainDoctorChecklist();
    assert.match(text, /print-only|Print-only/i);
    assert.match(text, /\/v1\/completions/);
    assert.match(text, /chat\/completions|chat-only/i);
    assert.match(text, /remote-inference|REMOTE_INFERENCE/i);
    assert.match(text, /Ollama|LM Studio|vLLM/i);
    assert.match(text, /Antares-1B|Antares File F1|NOT Antares/i);
    assert.match(text, /docs\/local-brain\.md|local-brain/);
    assert.match(text, /antares doctor/);
    assert.match(text, /Does NOT download|no model download|never.*download/i);
    assert.doesNotMatch(text, /Creating pod|runpod\.create|billing|auto-start Ollama/i);
    assert.ok(text.includes(QUALITY_HONESTY.split(".")[0]));
  });

  it("shape-check accepts loopback completions and flags remote ACK", () => {
    const ok = checkLocalBrainEndpointShape("http://127.0.0.1:8000/v1");
    assert.equal(ok.ok, true);
    assert.equal(ok.loopback, true);
    assert.equal(ok.remoteAckRequired, false);
    assert.match(ok.endpoint ?? "", /\/v1\/completions$/);

    const remote = checkLocalBrainEndpointShape(
      "https://gpu.example.com:8000/v1",
    );
    assert.equal(remote.ok, true);
    assert.equal(remote.loopback, false);
    assert.equal(remote.remoteAckRequired, true);
  });

  it("shape-check refuses chat-only hosts (no network)", () => {
    const bad = checkLocalBrainEndpointShape(
      "http://127.0.0.1:8000/v1/chat/completions",
    );
    assert.equal(bad.ok, false);
    assert.match(bad.detail, /chat/i);
    assert.match(CHAT_ONLY_REFUSED, /chat-only|chat\/completions/i);
  });

  it("CLI doctor is print-only and exits 0 without network", () => {
    const r = spawnSync(
      "npx",
      ["tsx", "cli/index.ts", "doctor"],
      {
        cwd: root,
        encoding: "utf8",
        env: { ...process.env, CI: "true" },
      },
    );
    assert.equal(r.status, 0, r.stderr || r.stdout);
    assert.match(r.stdout, /print-only|Print-only/i);
    assert.match(r.stdout, /\/v1\/completions/);
    assert.match(r.stdout, /Ollama|LM Studio/i);
    assert.match(r.stdout, /NOT Antares|≠ Antares|not Antares/i);
    assert.match(r.stdout, /docs\/local-brain\.md|local-brain/);
    assert.doesNotMatch(r.stdout, /Creating pod|runpod\.create|billing/i);
  });

  it("CLI doctor --endpoint refuses chat URLs with exit 2 (no network)", () => {
    const r = spawnSync(
      "npx",
      [
        "tsx",
        "cli/index.ts",
        "doctor",
        "--endpoint",
        "http://127.0.0.1:11434/v1/chat/completions",
      ],
      {
        cwd: root,
        encoding: "utf8",
        env: { ...process.env, CI: "true" },
      },
    );
    assert.equal(r.status, 2, r.stderr || r.stdout);
    assert.match(r.stdout, /chat/i);
  });

  it("CLI doctor --endpoint accepts loopback completions shape", () => {
    const r = spawnSync(
      "npx",
      [
        "tsx",
        "cli/index.ts",
        "doctor",
        "--endpoint",
        "http://127.0.0.1:8000/v1",
      ],
      {
        cwd: root,
        encoding: "utf8",
        env: { ...process.env, CI: "true" },
      },
    );
    assert.equal(r.status, 0, r.stderr || r.stdout);
    assert.match(r.stdout, /OK loopback|loopback completions/i);
    assert.match(r.stdout, /\/v1\/completions/);
  });

  it("bash twin scripts/local-brain-doctor.sh --print-only is $0", () => {
    const script = path.join(root, "scripts/local-brain-doctor.sh");
    assert.ok(fs.existsSync(script));
    const r = spawnSync("bash", [script, "--print-only"], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, CI: "true" },
    });
    assert.equal(r.status, 0, r.stderr || r.stdout);
    assert.match(r.stdout, /print-only|Print-only|Does NOT download/i);
    assert.match(r.stdout, /\/v1\/completions/);
    assert.match(r.stdout, /NOT Antares|≠ Antares|not Antares/i);
    assert.doesNotMatch(r.stdout, /Creating pod|huggingface-cli download/i);
  });

  it("docs/local-brain.md exists and states honesty + GRAX locks", () => {
    const doc = fs.readFileSync(path.join(root, LOCAL_BRAIN_DOCS), "utf8");
    assert.match(doc, /completions/i);
    assert.match(doc, /chat/i);
    assert.match(doc, /remote-inference|REMOTE_INFERENCE/i);
    assert.match(doc, /Ollama/);
    assert.match(doc, /LM Studio/);
    assert.match(doc, /Antares File F1|NOT Antares|≠ Antares/i);
    assert.match(doc, /MPS/);
    assert.match(doc, /mode:\s*"live"/);
    assert.match(doc, /never auto-starts|does \*\*not\*\* start|Print-only/i);
    assert.match(doc, /Bundle or download model weights|no model download/i);
  });

  it("antares doctor still print-only and points at local-brain", () => {
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
    assert.match(r.stdout, /docs\/local-brain\.md|zeroday -- doctor/);
    assert.match(r.stdout, /≠ Antares|NOT Antares|not Antares/i);
  });
});
