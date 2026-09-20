/**
 * CLI prove-doors — pass / cassette fail / B skip / B fail (mock HTTP).
 * Spawns `tsx cli/index.ts prove-doors` (same path as `npm run prove-doors`).
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { PROVE_DOORS_SCHEMA } from "../../src/desk/prove-doors.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const cli = path.join(root, "cli/index.ts");

function runProveDoorsCliSync(
  args: string[],
  timeoutMs = 180_000,
): { status: number | null; stdout: string; stderr: string } {
  const r = spawnSync("npx", ["tsx", cli, "prove-doors", ...args], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, FORCE_COLOR: "0" },
    timeout: timeoutMs,
  });
  return {
    status: r.status,
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? "",
  };
}

/** Async spawn so a parent-process mock HTTP server can accept connections. */
function runProveDoorsCliAsync(
  args: string[],
  timeoutMs = 180_000,
): Promise<{ status: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn("npx", ["tsx", cli, "prove-doors", ...args], {
      cwd: root,
      env: { ...process.env, FORCE_COLOR: "0" },
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`prove-doors timed out after ${timeoutMs}ms`));
    }, timeoutMs);
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
}

async function withMockModelsServer(
  handler: (
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ) => void,
  fn: (liveUrl: string) => Promise<void>,
): Promise<void> {
  const server = http.createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  assert.ok(addr && typeof addr === "object");
  const liveUrl = `http://127.0.0.1:${addr.port}/v1`;
  try {
    await fn(liveUrl);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

describe("CLI prove-doors", () => {
  it("package.json exposes prove-doors → cli prove-doors", () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(root, "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };
    assert.ok(pkg.scripts["prove-doors"], "missing npm run prove-doors");
    assert.match(pkg.scripts["prove-doors"], /prove-doors/);
  });

  it("VS Code / Codespaces task wires prove-doors --json --out prove-doors.json (keyless)", () => {
    const tasksPath = path.join(root, ".vscode/tasks.json");
    assert.ok(fs.existsSync(tasksPath), "missing .vscode/tasks.json");
    const tasks = JSON.parse(fs.readFileSync(tasksPath, "utf8")) as {
      tasks: Array<{ label?: string; command?: string }>;
    };
    const keyless = tasks.tasks.find((t) =>
      /prove-doors \(keyless\)/i.test(String(t.label ?? "")),
    );
    assert.ok(keyless, 'missing VS Code task "ZERODAY: prove-doors (keyless)"');
    assert.equal(keyless.label, "ZERODAY: prove-doors (keyless)");
    assert.match(String(keyless.command), /npm run prove-doors/);
    assert.match(String(keyless.command), /--json/);
    assert.match(String(keyless.command), /--out prove-doors\.json/);
    assert.doesNotMatch(String(keyless.command), /--live-url/);
  });

  it("pass + B skip: --json exits 0 without --live-url", () => {
    const r = runProveDoorsCliSync(["--json"]);
    assert.equal(
      r.status,
      0,
      `prove-doors --json failed (status=${r.status})\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`,
    );
    const json = JSON.parse(r.stdout) as {
      schemaVersion: string;
      ok: boolean;
      doors: {
        a: { status: string };
        cassette: { status: string };
        b: { status: string; reason?: string };
        d: { status: string; historical?: boolean; startsRunPod?: boolean };
        e: { status: string; dryRun?: boolean; neverCallsGitHub?: boolean };
      };
    };
    assert.equal(json.schemaVersion, PROVE_DOORS_SCHEMA);
    assert.equal(json.ok, true);
    assert.equal(json.doors.a.status, "ok");
    assert.equal(json.doors.cassette.status, "ok");
    assert.equal(json.doors.b.status, "skipped");
    assert.equal(json.doors.b.reason, "liveUrl omitted");
    assert.equal(json.doors.d.status, "ok");
    assert.equal(json.doors.d.historical, true);
    assert.equal(json.doors.d.startsRunPod, false);
    assert.equal(json.doors.e.status, "ok");
    assert.equal(json.doors.e.dryRun, true);
    assert.equal(json.doors.e.neverCallsGitHub, true);
  });

  it("cassette fail: --expect-file mismatch exits 1 · ok false", () => {
    const r = runProveDoorsCliSync([
      "--json",
      "--expect-file",
      "src/definitely-not-this.js",
    ]);
    assert.equal(
      r.status,
      1,
      `expected exit 1 on cassette fail (got ${r.status})\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`,
    );
    const json = JSON.parse(r.stdout) as {
      ok: boolean;
      doors: {
        a: { status: string };
        cassette: { status: string; code?: string };
        b: { status: string };
      };
    };
    assert.equal(json.ok, false);
    assert.equal(json.doors.a.status, "ok");
    assert.equal(json.doors.cassette.status, "failed");
    assert.equal(json.doors.cassette.code, "ASSERT_MISMATCH");
    assert.equal(json.doors.b.status, "skipped");
  });

  it("Door B fail with mock HTTP non-200 · exits 1", async () => {
    await withMockModelsServer(
      (req, res) => {
        if (req.method === "GET" && req.url === "/v1/models") {
          res.writeHead(503, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "down" }));
          return;
        }
        res.writeHead(404);
        res.end();
      },
      async (liveUrl) => {
        const r = await runProveDoorsCliAsync(["--json", "--live-url", liveUrl]);
        assert.equal(
          r.status,
          1,
          `expected exit 1 on Door B fail (got ${r.status})\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`,
        );
        const json = JSON.parse(r.stdout) as {
          ok: boolean;
          doors: {
            a: { status: string };
            cassette: { status: string };
            b: { status: string; code?: string; provisioned?: boolean };
          };
        };
        assert.equal(json.ok, false);
        assert.equal(json.doors.a.status, "ok");
        assert.equal(json.doors.cassette.status, "ok");
        assert.equal(json.doors.b.status, "failed");
        assert.equal(json.doors.b.code, "PROBE_HTTP_FAILED");
        assert.equal(json.doors.b.provisioned, false);
      },
    );
  });

  it("human banner mentions doors when not --json", () => {
    const r = runProveDoorsCliSync([]);
    assert.equal(
      r.status,
      0,
      `prove-doors banner failed (status=${r.status})\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`,
    );
    assert.match(r.stdout, /prove-doors/i);
    assert.match(r.stdout, /Door A\s*:\s*ok/i);
    assert.match(r.stdout, /cassette:\s*ok/i);
    assert.match(r.stdout, /Door B\s*:\s*skipped/i);
    assert.match(r.stdout, /Door D\s*:\s*ok/i);
    assert.match(r.stdout, /Door E\s*:\s*ok/i);
    assert.match(r.stdout, /dry-run Code Scanning|not live upload/i);
    assert.match(r.stdout, /fail-closed|needs human/i);
  });

  it("--out writes full prove-doors JSON with expected doors · still prints --json", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "prove-doors-out-"));
    const outFile = path.join(tmp, "prove-doors.json");
    const r = runProveDoorsCliSync(["--json", "--out", outFile]);
    assert.equal(
      r.status,
      0,
      `prove-doors --out failed (status=${r.status})\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`,
    );
    assert.ok(fs.existsSync(outFile), "expected --out file to exist");
    const fromFile = JSON.parse(fs.readFileSync(outFile, "utf8")) as {
      schemaVersion: string;
      ok: boolean;
      doors: {
        a: { status: string };
        cassette: { status: string };
        b: { status: string };
        d: { status: string };
        e: { status: string };
      };
    };
    const fromStdout = JSON.parse(r.stdout) as typeof fromFile;
    assert.equal(fromFile.schemaVersion, PROVE_DOORS_SCHEMA);
    assert.equal(fromFile.ok, true);
    assert.equal(fromFile.doors.a.status, "ok");
    assert.equal(fromFile.doors.cassette.status, "ok");
    assert.equal(fromFile.doors.b.status, "skipped");
    assert.equal(fromFile.doors.d.status, "ok");
    assert.equal(fromFile.doors.e.status, "ok");
    assert.deepEqual(fromFile, fromStdout);
  });

  it("--out-file alias writes JSON · banner mode still prints human card", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "prove-doors-out-file-"));
    const outFile = path.join(tmp, "nested", "prove-doors.json");
    const r = runProveDoorsCliSync(["--out-file", outFile]);
    assert.equal(
      r.status,
      0,
      `prove-doors --out-file failed (status=${r.status})\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`,
    );
    assert.match(r.stdout, /Door A\s*:\s*ok/i);
    assert.match(r.stdout, /Wrote\s*:\s*/i);
    const json = JSON.parse(fs.readFileSync(outFile, "utf8")) as {
      ok: boolean;
      doors: { a: { status: string }; e: { status: string } };
    };
    assert.equal(json.ok, true);
    assert.equal(json.doors.a.status, "ok");
    assert.equal(json.doors.e.status, "ok");
  });

  it("--out fails closed when path is not writable", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "prove-doors-out-deny-"));
    const blocker = path.join(tmp, "not-a-dir");
    fs.writeFileSync(blocker, "x");
    const outFile = path.join(blocker, "prove-doors.json");
    const r = runProveDoorsCliSync(["--json", "--out", outFile]);
    assert.equal(
      r.status,
      2,
      `expected exit 2 on unwritable --out (got ${r.status})\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`,
    );
    assert.equal(fs.existsSync(outFile), false);
    const json = JSON.parse(r.stdout) as {
      schemaVersion: string;
      ok: boolean;
      error?: string;
    };
    assert.equal(json.schemaVersion, PROVE_DOORS_SCHEMA);
    assert.equal(json.ok, false);
    assert.match(String(json.error ?? ""), /--out write failed/i);
  });
});
