import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  parseAllowlistedCommand,
  ALLOWED_BINARIES,
  SANDBOX_MOUNT,
} from "../../src/locate/sandbox-allowlist.ts";
import {
  detectDocker,
  SandboxSession,
  runSandboxedCommand,
  DEFAULT_COMMAND_TIMEOUT_MS,
  DEFAULT_SANDBOX_IMAGE,
} from "../../src/locate/sandbox.ts";
import { createSnapshot, destroySnapshot } from "../../src/locate/snapshot.ts";
import { defaultFixtureRepo } from "../../src/locate/fixture.ts";
import { locate } from "../../src/locate/index.ts";

describe("sandbox allowlist", () => {
  it("allows grep/find/cat style argv", () => {
    assert.equal(parseAllowlistedCommand(["grep", "-Rni", "SELECT", "."]).binary, "grep");
    assert.equal(parseAllowlistedCommand(["find", ".", "-type", "f"]).binary, "find");
    assert.equal(
      parseAllowlistedCommand(["cat", `${SANDBOX_MOUNT}/src/users.js`]).binary,
      "cat",
    );
    assert.ok(ALLOWED_BINARIES.has("ls"));
  });

  it("rejects shells, network tools, and metacharacters", () => {
    assert.throws(() => parseAllowlistedCommand(["bash", "-c", "ls"]), /shell|allowlisted|forbids/i);
    assert.throws(() => parseAllowlistedCommand(["curl", "http://x"]), /allowlisted|forbids/i);
    assert.throws(() => parseAllowlistedCommand(["grep", "a", "|", "wc"]), /metacharacter/);
    assert.throws(() => parseAllowlistedCommand(["cat", "/etc/passwd"]), /must be under/);
    assert.throws(() => parseAllowlistedCommand(["find", ".."]), /\.\./);
  });

  it("defaults match Antares-style 10s timeout and ubuntu image", () => {
    assert.equal(DEFAULT_COMMAND_TIMEOUT_MS, 10_000);
    assert.equal(DEFAULT_SANDBOX_IMAGE, "ubuntu:24.04");
  });
});

describe("sandbox docker wrapper", () => {
  it("detectDocker reports availability without throwing", () => {
    const d = detectDocker();
    assert.equal(typeof d.available, "boolean");
    assert.ok(d.detail.length > 0);
  });

  it("runs allowlisted commands in an isolated container when Docker is available", async (t) => {
    const d = detectDocker();
    if (!d.available) {
      t.skip(`skip-if-no-docker: ${d.detail}`);
      return;
    }

    const snap = createSnapshot(defaultFixtureRepo());
    let session: SandboxSession | null = null;
    try {
      try {
        session = SandboxSession.create(snap.snapshotPath, {
          pullIfMissing: true,
          commandTimeoutMs: 10_000,
        });
      } catch (e) {
        // Nested/cloud VMs sometimes expose docker.sock but cannot mount overlayfs.
        t.skip(`skip-if-docker-unusable: ${(e as Error).message.slice(0, 240)}`);
        return;
      }
      assert.equal(session.info.network, "none");
      assert.match(session.info.memoryLimit, /\d/);

      const ls = session.exec(["ls", SANDBOX_MOUNT]);
      assert.equal(ls.ok, true, ls.stderr);
      assert.match(ls.stdout, /src|README/i);

      const find = session.exec(["find", SANDBOX_MOUNT, "-type", "f", "-name", "*.js"]);
      assert.equal(find.ok, true, find.stderr);
      assert.match(find.stdout, /users\.js/);

      const cat = session.exec(["cat", `${SANDBOX_MOUNT}/src/users.js`]);
      assert.equal(cat.ok, true, cat.stderr);
      assert.match(cat.stdout, /findUserByName/);

      assert.throws(
        () => session!.exec(["curl", "http://example.com"]),
        /allowlisted|forbids/i,
      );

      const oneshot = runSandboxedCommand(snap.snapshotPath, [
        "grep",
        "-n",
        "SELECT",
        `${SANDBOX_MOUNT}/src/users.js`,
      ]);
      assert.equal(oneshot.ok, true, oneshot.stderr);
      assert.match(oneshot.stdout, /SELECT/);
    } finally {
      session?.destroy();
      destroySnapshot(snap.snapshotPath);
    }
  });

  it("fixture locate stays container-free", async () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-sbx-fix-"));
    const artifacts = await locate({
      repo: defaultFixtureRepo(),
      advisory: "CWE-89",
      fixture: true,
      outputDir: out,
    });
    assert.equal(artifacts.result.mode, "fixture");
    assert.ok(
      artifacts.result.warnings.some((w) => /container-free/i.test(w)),
    );
  });
});
