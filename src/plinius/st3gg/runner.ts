/**
 * ST3GG subprocess runner — agent-friendly JSON CLI.
 */

import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { st3ggCliPath, pliniusLibPresent, pliniusLibRoot } from "@/plinius/paths";

const DEFAULT_TIMEOUT_MS = 60_000;

export interface SteggRunResult {
  ok: boolean;
  exitCode: number | null;
  data: Record<string, unknown> | null;
  rawStdout: string;
  rawStderr: string;
  error?: string;
  durationMs: number;
}

function pythonBin(): string {
  if (process.env.ZERODAY_PYTHON) return process.env.ZERODAY_PYTHON;
  if (process.env.PYTHON) return process.env.PYTHON;
  // Prefer project venv created by `npm run plinius:st3gg-deps`
  const venvPy = path.join(process.cwd(), ".venv-st3gg", "bin", "python");
  if (fs.existsSync(venvPy)) return venvPy;
  return "python3";
}

export async function checkSt3ggRuntime(): Promise<{
  present: boolean;
  cliExists: boolean;
  python: string;
  pillow: boolean;
  numpy: boolean;
  hint?: string;
  path: string;
}> {
  const present = pliniusLibPresent("st3gg");
  const cli = st3ggCliPath();
  const cliExists = present && fs.existsSync(cli);
  const py = pythonBin();

  const probe = await runPython(
    `import json
mods={}
for m in ("PIL","numpy"):
  try:
    __import__(m if m!="PIL" else "PIL")
    mods[m]=True
  except Exception as e:
    mods[m]=False
print(json.dumps(mods))
`,
    8_000
  );

  let pillow = false;
  let numpy = false;
  try {
    const mods = JSON.parse(probe.stdout || "{}") as Record<string, boolean>;
    pillow = Boolean(mods.PIL);
    numpy = Boolean(mods.numpy);
  } catch {
    /* ignore */
  }

  let hint: string | undefined;
  if (!present) {
    hint = "Run: npm run plinius:init (optional ST3GG clone)";
  } else if (!pillow || !numpy) {
    hint = `Install ST3GG deps: ${py} -m pip install -r ${path.join(pliniusLibRoot("st3gg"), "requirements.txt")}`;
  }

  return { present, cliExists, python: py, pillow, numpy, hint, path: pliniusLibRoot("st3gg") };
}

function runPython(code: string, timeoutMs: number): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve) => {
    const child = spawn(pythonBin(), ["-c", code], {
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
    }, timeoutMs);
    child.stdout.on("data", (d) => {
      stdout += String(d);
    });
    child.stderr.on("data", (d) => {
      stderr += String(d);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code });
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ stdout, stderr: String(err), code: 1 });
    });
  });
}

/** Run stegg_cli.py with argv; parses last JSON object from stdout. */
export async function runSteggCli(
  args: string[],
  opts?: { timeoutMs?: number; cwd?: string }
): Promise<SteggRunResult> {
  const t0 = Date.now();
  const cli = st3ggCliPath();
  if (!fs.existsSync(cli)) {
    return {
      ok: false,
      exitCode: null,
      data: null,
      rawStdout: "",
      rawStderr: "",
      error: "ST3GG CLI missing — run npm run plinius:init",
      durationMs: Date.now() - t0,
    };
  }

  const runtime = await checkSt3ggRuntime();
  if (!runtime.pillow) {
    return {
      ok: false,
      exitCode: null,
      data: null,
      rawStdout: "",
      rawStderr: "",
      error: runtime.hint || "Pillow not installed for ST3GG",
      durationMs: Date.now() - t0,
    };
  }

  return new Promise((resolve) => {
    const child = spawn(pythonBin(), [cli, ...args], {
      cwd: opts?.cwd || pliniusLibRoot("st3gg"),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let rawStdout = "";
    let rawStderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
    }, opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS);

    child.stdout.on("data", (d) => {
      rawStdout += String(d);
    });
    child.stderr.on("data", (d) => {
      rawStderr += String(d);
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({
        ok: false,
        exitCode: null,
        data: null,
        rawStdout,
        rawStderr: String(err),
        error: String(err),
        durationMs: Date.now() - t0,
      });
    });
    child.on("close", (exitCode) => {
      clearTimeout(timer);
      const data = parseLastJson(rawStdout);
      const errFromJson =
        data && typeof data.error === "string" ? String(data.error) : undefined;
      resolve({
        ok: exitCode === 0 && !errFromJson,
        exitCode,
        data,
        rawStdout: rawStdout.slice(0, 50_000),
        rawStderr: rawStderr.slice(0, 20_000),
        error: errFromJson || (exitCode === 0 ? undefined : rawStderr.slice(0, 500) || `exit ${exitCode}`),
        durationMs: Date.now() - t0,
      });
    });
  });
}

function parseLastJson(stdout: string): Record<string, unknown> | null {
  const lines = stdout
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      return JSON.parse(lines[i]) as Record<string, unknown>;
    } catch {
      /* try previous */
    }
  }
  // whole buffer
  try {
    return JSON.parse(stdout) as Record<string, unknown>;
  } catch {
    return null;
  }
}
