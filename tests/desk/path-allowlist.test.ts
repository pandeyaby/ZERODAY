/**
 * Desk fail-closed read path allowlist (assertAllowedReadPath).
 * Extends path-policy — does not weaken UI sandbox / ZERODAY_UI_ROOTS.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  assertAllowedReadPath,
  DESK_READ_REL_ROOTS,
  getDeskReadAllowRoots,
  PathPolicyError,
} from "../../src/lib/path-policy.ts";
import {
  GET as reportGet,
  POST as reportPost,
} from "../../src/app/api/report/route.ts";
import { POST as proveDoorsPost } from "../../src/app/api/prove-doors/route.ts";
import { POST as strangerVerifyPost } from "../../src/app/api/stranger-verify/route.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("assertAllowedReadPath (Desk read allowlist)", () => {
  it("lists intentional prefixes under root (fixtures / out / …)", () => {
    const roots = getDeskReadAllowRoots(root);
    assert.equal(roots[0], path.resolve(root));
    for (const rel of DESK_READ_REL_ROOTS) {
      assert.ok(roots.includes(path.resolve(root, rel)));
    }
  });

  it("allows fixtures + out under root", () => {
    const fix = assertAllowedReadPath(
      root,
      "fixtures/locate/ingest-sample/sample.sarif",
      { mustExist: true, kind: "file", label: "sarif" },
    );
    assert.equal(
      fix,
      path.join(root, "fixtures/locate/ingest-sample/sample.sarif"),
    );

    const outDir = path.join(root, "out");
    fs.mkdirSync(outDir, { recursive: true });
    const out = assertAllowedReadPath(root, "out", {
      mustExist: true,
      kind: "dir",
      label: "out",
    });
    assert.equal(out, outDir);
  });

  it("rejects empty / whitespace", () => {
    assert.throws(
      () => assertAllowedReadPath(root, ""),
      (e: Error) =>
        e instanceof PathPolicyError && /path is required/i.test(e.message),
    );
    assert.throws(
      () => assertAllowedReadPath(root, "   ", { label: "from" }),
      PathPolicyError,
    );
  });

  it("rejects ../etc/passwd traversal", () => {
    assert.throws(
      () =>
        assertAllowedReadPath(root, "../etc/passwd", {
          label: "from",
        }),
      (e: Error) =>
        e instanceof PathPolicyError && /escapes sandbox/i.test(e.message),
    );
    assert.throws(
      () =>
        assertAllowedReadPath(
          path.join(root, "fixtures"),
          "../../etc/passwd",
          { label: "sarif" },
        ),
      PathPolicyError,
    );
  });

  it("rejects absolute paths outside root", () => {
    const outside = path.join(os.tmpdir(), `zd-desk-escape-${Date.now()}`);
    fs.mkdirSync(outside, { recursive: true });
    try {
      assert.throws(
        () =>
          assertAllowedReadPath(root, outside, {
            label: "from",
          }),
        PathPolicyError,
      );
    } finally {
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });

  it("rejects symlink escape outside root when detectable", () => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), "zd-desk-sym-out-"));
    const linkParent = path.join(root, "out");
    fs.mkdirSync(linkParent, { recursive: true });
    const link = path.join(
      linkParent,
      `.tmp-symlink-escape-${process.pid}-${Date.now()}`,
    );
    try {
      fs.symlinkSync(outside, link);
      assert.throws(
        () =>
          assertAllowedReadPath(root, link, {
            label: "from",
          }),
        (e: Error) =>
          e instanceof PathPolicyError && /escapes sandbox/i.test(e.message),
      );
    } finally {
      try {
        fs.lstatSync(link);
        fs.unlinkSync(link);
      } catch {
        /* link may not exist */
      }
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });

  it("does not honor ZERODAY_UI_ROOTS widening for Desk reads", () => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), "zd-desk-ui-root-"));
    const prev = process.env.ZERODAY_UI_ROOTS;
    process.env.ZERODAY_UI_ROOTS = outside;
    try {
      assert.throws(
        () =>
          assertAllowedReadPath(root, outside, {
            label: "from",
          }),
        PathPolicyError,
      );
    } finally {
      if (prev === undefined) delete process.env.ZERODAY_UI_ROOTS;
      else process.env.ZERODAY_UI_ROOTS = prev;
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });
});

describe("Desk API path allowlist (fail-closed 400)", () => {
  it("POST /api/report rejects path traversal with PATH_POLICY 400", async () => {
    const req = new Request("http://localhost/api/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from: "../etc/passwd" }),
    });
    const res = await reportPost(req);
    assert.equal(res.status, 400);
    const body = (await res.json()) as {
      ok: boolean;
      code?: string;
      error: string;
      runpod: boolean;
    };
    assert.equal(body.ok, false);
    assert.equal(body.code, "PATH_POLICY");
    assert.match(body.error, /escapes sandbox|path/i);
    assert.equal(body.runpod, false);
  });

  it("POST /api/report rejects absolute outside root with PATH_POLICY 400", async () => {
    const outside = path.join(os.tmpdir(), `zd-report-escape-${Date.now()}.json`);
    fs.writeFileSync(outside, "{}\n", "utf8");
    try {
      const req = new Request("http://localhost/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: outside }),
      });
      const res = await reportPost(req);
      assert.equal(res.status, 400);
      const body = (await res.json()) as { ok: boolean; code?: string };
      assert.equal(body.ok, false);
      assert.equal(body.code, "PATH_POLICY");
    } finally {
      fs.rmSync(outside, { force: true });
    }
  });

  it("GET /api/report?catalog=1 still works (no path gate)", async () => {
    const res = await reportGet(
      new Request("http://localhost/api/report?catalog=1"),
    );
    assert.equal(res.status, 200);
  });

  it("POST /api/prove-doors rejects recording escape with PATH_POLICY 400", async () => {
    const req = new Request("http://localhost/api/prove-doors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recording: "/etc/passwd" }),
    });
    const res = await proveDoorsPost(req);
    assert.equal(res.status, 400);
    const body = (await res.json()) as {
      ok: boolean;
      code?: string;
      error: string;
    };
    assert.equal(body.ok, false);
    assert.equal(body.code, "PATH_POLICY");
    assert.match(body.error, /escapes sandbox|path/i);
  });

  it("POST /api/stranger-verify without path fields still 200 (liveUrl-only)", async () => {
    const req = new Request("http://localhost/api/stranger-verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const res = await strangerVerifyPost(req);
    assert.equal(res.status, 200);
  });
});
