import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const serverPy = path.join(root, "scripts/completions_server.py");

/** Run pure helpers via python3 (no torch / GPU required). */
function pyEval(expr: string): string {
  const script = `
import importlib.util, json, sys
spec = importlib.util.spec_from_file_location("completions_server", ${JSON.stringify(serverPy)})
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
result = ${expr}
sys.stdout.write(json.dumps(result))
`;
  const r = spawnSync("python3", ["-c", script], {
    encoding: "utf8",
    cwd: root,
  });
  if (r.status !== 0) {
    throw new Error(
      `python helper failed: ${r.stderr || r.stdout || r.error}`,
    );
  }
  return r.stdout.trim();
}

describe("completions_server.py helpers (no GPU)", () => {
  it("selects float32 on MPS (not float16)", () => {
    const mps = JSON.parse(pyEval('mod.select_torch_dtype_name("mps")'));
    const cuda = JSON.parse(pyEval('mod.select_torch_dtype_name("cuda")'));
    const cpu = JSON.parse(pyEval('mod.select_torch_dtype_name("cpu")'));
    assert.equal(mps, "float32");
    assert.equal(cuda, "float16");
    assert.equal(cpu, "float32");
  });

  it("maps frequency_penalty to repetition_penalty", () => {
    assert.equal(
      JSON.parse(pyEval("mod.map_frequency_to_repetition_penalty(None)")),
      null,
    );
    assert.equal(
      JSON.parse(pyEval("mod.map_frequency_to_repetition_penalty(0)")),
      null,
    );
    assert.equal(
      JSON.parse(pyEval("mod.map_frequency_to_repetition_penalty(-0.5)")),
      null,
    );
    assert.equal(
      JSON.parse(pyEval("mod.map_frequency_to_repetition_penalty(0.5)")),
      1.5,
    );
    assert.equal(
      JSON.parse(pyEval("mod.map_frequency_to_repetition_penalty(1.0)")),
      2.0,
    );
  });

  it("normalizes stop sequences", () => {
    assert.deepEqual(
      JSON.parse(pyEval('mod.normalize_stop_sequences(None)')),
      [],
    );
    assert.deepEqual(
      JSON.parse(pyEval('mod.normalize_stop_sequences("</tool_call>")')),
      ["</tool_call>"],
    );
    assert.deepEqual(
      JSON.parse(
        pyEval('mod.normalize_stop_sequences(["a", "", "b", 3])'),
      ),
      ["a", "b"],
    );
  });

  it("detects degenerate ! runs and token-id collapse", () => {
    assert.equal(
      JSON.parse(pyEval('mod.is_degenerate_exclamation_run("ok")')),
      false,
    );
    assert.equal(
      JSON.parse(
        pyEval('mod.is_degenerate_exclamation_run("!" * 20)'),
      ),
      true,
    );
    assert.equal(
      JSON.parse(
        pyEval(
          'mod.is_degenerate_exclamation_run("Hello <tool_call> list_files")',
        ),
      ),
      false,
    );
    assert.equal(
      JSON.parse(pyEval("mod.is_degenerate_token_ids([0] * 20)")),
      true,
    );
    assert.equal(
      JSON.parse(pyEval("mod.is_degenerate_token_ids([1, 2, 3, 4])")),
      false,
    );
  });
});
