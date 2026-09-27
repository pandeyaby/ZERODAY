/**
 * Desk web UI request guard: loopback-only Host (DNS rebinding), optional token,
 * same-origin JSON for state-changing API calls (CSRF), and server-only body
 * fields (a client-chosen `cwd` would move the path sandbox).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { checkUiRequest, hostnameOf, type GuardRequest } from "../../src/lib/ui-guard.ts";
import { publicRequestBody } from "../../src/lib/request-body.ts";

const root = path.resolve(import.meta.dirname, "../..");

const base: GuardRequest = {
  method: "GET",
  pathname: "/play",
  host: "127.0.0.1:3333",
  origin: null,
  secFetchSite: null,
  contentType: null,
  cookieToken: null,
  authorization: null,
  queryToken: null,
};
const post = (over: Partial<GuardRequest> = {}): GuardRequest => ({
  ...base,
  method: "POST",
  pathname: "/api/desk",
  origin: "http://127.0.0.1:3333",
  secFetchSite: "same-origin",
  contentType: "application/json",
  ...over,
});

describe("Desk UI guard", () => {
  it("parses Host headers", () => {
    assert.equal(hostnameOf("localhost:3333"), "localhost");
    assert.equal(hostnameOf("[::1]:3333"), "::1");
    assert.equal(hostnameOf("::1"), "::1");
    assert.equal(hostnameOf("Example.COM"), "example.com");
  });

  it("serves loopback hosts and the UI's own JSON posts", () => {
    for (const host of ["127.0.0.1:3333", "localhost:3333", "[::1]:3333"]) {
      assert.equal(checkUiRequest({ ...base, host }, {}).ok, true, host);
    }
    assert.equal(checkUiRequest(post(), {}).ok, true);
    assert.equal(checkUiRequest(post({ origin: null, secFetchSite: null }), {}).ok, true, "curl-style");
  });

  it("refuses foreign Host headers (DNS rebinding, LAN)", () => {
    const r = checkUiRequest({ ...base, host: "evil.example:3333" }, {});
    assert.equal(r.ok, false);
    assert.equal(!r.ok && r.status, 403);
    assert.equal(checkUiRequest({ ...base, host: null }, {}).ok, false);
    // Allow-listed host without a token is still refused.
    assert.equal(checkUiRequest({ ...base, host: "desk.lan:3333" }, { allowedHosts: "desk.lan" }).ok, false);
  });

  it("refuses cross-site and non-JSON state-changing calls (CSRF)", () => {
    const cases: Array<[string, Partial<GuardRequest>, number]> = [
      ["cross-site fetch", { secFetchSite: "cross-site" }, 403],
      ["same-site subdomain", { secFetchSite: "same-site" }, 403],
      ["foreign Origin", { origin: "https://evil.example", secFetchSite: null }, 403],
      ["opaque Origin", { origin: "null", secFetchSite: null }, 403],
      ["text/plain form", { contentType: "text/plain" }, 415],
      ["urlencoded form", { contentType: "application/x-www-form-urlencoded" }, 415],
      ["no content type", { contentType: null }, 415],
    ];
    for (const [label, over, status] of cases) {
      const r = checkUiRequest(post(over), {});
      assert.equal(r.ok, false, label);
      assert.equal(!r.ok && r.status, status, label);
    }
    // GET stays readable for same-host navigation.
    assert.equal(checkUiRequest({ ...base, pathname: "/api/health", secFetchSite: "cross-site" }, {}).ok, true);
  });

  it("requires the token everywhere when ZERODAY_UI_TOKEN is set", () => {
    const env = { token: "s3cret-token-value", allowedHosts: "desk.lan" };
    assert.equal(checkUiRequest(base, env).ok, false);
    assert.equal(checkUiRequest({ ...base, cookieToken: "wrong" }, env).ok, false);
    assert.equal(checkUiRequest({ ...base, cookieToken: env.token }, env).ok, true);
    assert.equal(checkUiRequest({ ...base, authorization: `Bearer ${env.token}` }, env).ok, true);
    const q = checkUiRequest({ ...base, queryToken: env.token }, env);
    assert.deepEqual(q, { ok: true, setTokenCookie: true });
    assert.equal(checkUiRequest({ ...base, host: "desk.lan:3333", cookieToken: env.token }, env).ok, true);
    assert.equal(checkUiRequest({ ...base, host: "other.lan", cookieToken: env.token }, env).ok, false);
  });

  it("drops server-only fields from request bodies", () => {
    const body = publicRequestBody({
      action: "rules",
      repo: "fixtures/x",
      cwd: "/",
      probeResult: { ok: true },
      locateProbeResult: { ok: true },
    } as Record<string, unknown>);
    assert.deepEqual(body, { action: "rules", repo: "fixtures/x" });
    assert.deepEqual(publicRequestBody(null as unknown as object), {});
  });

  it("is wired: middleware, routes, loopback scripts, headers", () => {
    const mw = fs.readFileSync(path.join(root, "src/middleware.ts"), "utf8");
    assert.match(mw, /checkUiRequest/);
    for (const r of ["desk", "live", "reports"]) {
      const src = fs.readFileSync(path.join(root, `src/app/api/${r}/route.ts`), "utf8");
      assert.match(src, /publicRequestBody\(/, r);
    }
    const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")) as { scripts: Record<string, string> };
    assert.match(pkg.scripts.dev!, /-H 127\.0\.0\.1/);
    assert.match(pkg.scripts.start!, /-H 127\.0\.0\.1/);
    const cfg = fs.readFileSync(path.join(root, "next.config.ts"), "utf8");
    assert.match(cfg, /frame-ancestors 'none'/);
  });
});
