import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { stopWatchdog } from "../../src/antares/runpod.ts";

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitFor(check: () => boolean, ms = 5000): Promise<boolean> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (check()) return true;
    await new Promise((r) => setTimeout(r, 50));
  }
  return check();
}

describe("antares watchdog", { skip: process.platform === "win32" }, () => {
  it("stopWatchdog kills the launcher and the CLI it runs, not just the launcher pid", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zd-watchdog-"));
    const childPidFile = path.join(dir, "child.pid");
    // Same shape as startWatchdog → bin/zeroday.mjs: a detached launcher that
    // spawnSyncs a long-running child (tsx → the watchdog command).
    const launcher = `
      const { spawnSync } = require("node:child_process");
      spawnSync(process.execPath, ["-e", ${JSON.stringify(
        `require("node:fs").writeFileSync(${JSON.stringify(childPidFile)}, String(process.pid)); setInterval(() => {}, 1000);`,
      )}], { stdio: "ignore" });
    `;
    const proc = spawn(process.execPath, ["-e", launcher], { detached: true, stdio: "ignore" });
    proc.unref();
    const launcherPid = proc.pid!;
    try {
      assert.ok(await waitFor(() => fs.existsSync(childPidFile)), "child started");
      const childPid = Number(fs.readFileSync(childPidFile, "utf8"));
      assert.ok(alive(launcherPid) && alive(childPid));

      stopWatchdog(launcherPid);

      assert.ok(await waitFor(() => !alive(childPid)), "child process stopped");
      assert.ok(await waitFor(() => !alive(launcherPid)), "launcher stopped");
    } finally {
      try {
        process.kill(-launcherPid, "SIGKILL");
      } catch {
        /* already gone */
      }
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("stopWatchdog is a no-op for a pid that has already exited", () => {
    assert.doesNotThrow(() => stopWatchdog(2 ** 22 - 7));
  });
});
