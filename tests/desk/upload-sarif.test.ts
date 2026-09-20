/**
 * Desk upload-sarif dry-run — API + in-process runner.
 * Valid fixture → 200; missing/invalid → 4xx; never invokes network transport.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  runUploadSarifDryRun,
  resolveDeskSarifPath,
  uploadSarifDeskCatalog,
  UploadSarifDeskError,
  UPLOAD_SARIF_DESK_SCHEMA,
  UPLOAD_SARIF_DESK_DEFAULT_FIXTURE,
  UPLOAD_SARIF_DESK_REPO_ROOT,
} from "../../src/desk/upload-sarif.ts";
import {
  GET as uploadSarifGet,
  POST as uploadSarifPost,
} from "../../src/app/api/upload-sarif/route.ts";
import type {
  UploadSarifPayload,
  UploadSarifResult,
} from "../../src/locate/upload-sarif.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURE_SARIF = path.join(
  root,
  "fixtures/locate/ingest-sample/sample.sarif",
);
const FAKE_COMMIT = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const FAKE_REF = "refs/heads/main";
const FAKE_REPO = "pandeyaby/ZERODAY";

function mkSandboxTmp(): string {
  const base = path.join(root, "zeroday-reports");
  fs.mkdirSync(base, { recursive: true });
  return fs.mkdtempSync(path.join(base, ".tmp-upload-"));
}

describe("Desk upload-sarif dry-run (in-process)", () => {
  it("catalog documents POST /api/upload-sarif + Desk dry-run only", () => {
    const c = uploadSarifDeskCatalog();
    assert.equal(c.kind, "upload-sarif-desk-catalog");
    assert.equal(c.schemaVersion, UPLOAD_SARIF_DESK_SCHEMA);
    assert.match(c.endpoint, /\/api\/upload-sarif/);
    assert.equal(c.deskDryRunOnly, true);
    assert.match(c.liveUpload, /CLI only|security_events/i);
    assert.ok(c.honesty.some((h) => /dry-run only|never calls GitHub/i.test(h)));
    assert.ok(c.honesty.some((h) => /no GPU|RunPod/i.test(h)));
    assert.equal(c.defaults.sarifPath, UPLOAD_SARIF_DESK_DEFAULT_FIXTURE);
  });

  it("resolveDeskSarifPath prefers explicit path then fixture", () => {
    const explicit = resolveDeskSarifPath({
      sarifPath: FIXTURE_SARIF,
      cwd: root,
      repoRoot: root,
    });
    assert.equal(explicit.source, "sarifPath");
    assert.equal(explicit.resolved, path.resolve(FIXTURE_SARIF));

    const fixture = resolveDeskSarifPath({
      fixture: true,
      cwd: root,
      repoRoot: root,
    });
    assert.equal(fixture.source, "fixture");
    assert.match(fixture.resolved, /sample\.sarif$/);
  });

  it("valid fixture SARIF dry-run succeeds and never invokes transport", () => {
    let transportCalls = 0;
    const transport = (_payload: UploadSarifPayload): UploadSarifResult => {
      transportCalls += 1;
      throw new Error("network must not be called in Desk dry-run");
    };

    const result = runUploadSarifDryRun({
      sarifPath: FIXTURE_SARIF,
      repository: FAKE_REPO,
      ref: FAKE_REF,
      commit: FAKE_COMMIT,
      cwd: root,
      transport,
    });

    assert.equal(result.schemaVersion, UPLOAD_SARIF_DESK_SCHEMA);
    assert.equal(result.ok, true);
    assert.equal(result.dryRun, true);
    assert.equal(result.source, "sarifPath");
    assert.equal(transportCalls, 0);
    assert.equal(result.payload.dryRun, true);
    assert.match(result.payload.endpoint, /\/code-scanning\/sarifs$/);
    assert.equal(result.payload.body.commit_sha, FAKE_COMMIT);
    assert.equal(result.nonClaims.deskDryRunOnly, true);
    assert.equal(result.nonClaims.neverCallsGitHubFromDesk, true);
    assert.equal(result.nonClaims.liveUploadCliOnly, true);
    assert.equal(result.posture.localizationOnly, true);
    assert.doesNotMatch(
      JSON.stringify(result),
      /create-pod|RunPod create|AUROC\s*=/i,
    );
  });

  it("fixture:true uses checked-in sample without network", () => {
    let transportCalls = 0;
    const result = runUploadSarifDryRun({
      fixture: true,
      repository: FAKE_REPO,
      ref: FAKE_REF,
      commit: FAKE_COMMIT,
      cwd: root,
      transport: () => {
        transportCalls += 1;
        throw new Error("no network");
      },
    });
    assert.equal(result.source, "fixture");
    assert.equal(transportCalls, 0);
    assert.equal(result.ok, true);
  });

  it("fail-closed on missing SARIF", () => {
    assert.throws(
      () =>
        runUploadSarifDryRun({
          sarifPath: path.join(root, "does-not-exist.sarif"),
          repository: FAKE_REPO,
          ref: FAKE_REF,
          commit: FAKE_COMMIT,
          cwd: root,
        }),
      (e: unknown) =>
        e instanceof UploadSarifDeskError &&
        (e.code === "PATH_POLICY" || e.code === "missing_sarif"),
    );
  });

  it("fail-closed on invalid SARIF shape", () => {
    const dir = mkSandboxTmp();
    const bad = path.join(dir, "bad.sarif");
    fs.writeFileSync(bad, JSON.stringify({ version: "2.1.0", runs: [] }), "utf8");
    try {
      assert.throws(
        () =>
          runUploadSarifDryRun({
            sarifPath: bad,
            repository: FAKE_REPO,
            ref: FAKE_REF,
            commit: FAKE_COMMIT,
            cwd: root,
          }),
        (e: unknown) =>
          e instanceof UploadSarifDeskError && e.code === "invalid_sarif",
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("POST /api/upload-sarif", () => {
  it("GET returns catalog", async () => {
    const res = await uploadSarifGet();
    assert.equal(res.status, 200);
    const json = (await res.json()) as {
      kind: string;
      endpoint: string;
      deskDryRunOnly: boolean;
    };
    assert.equal(json.kind, "upload-sarif-desk-catalog");
    assert.match(json.endpoint, /upload-sarif/);
    assert.equal(json.deskDryRunOnly, true);
  });

  it("valid fixture SARIF dry-run returns 200 + payload (no network)", async () => {
    const req = new Request("http://localhost/api/upload-sarif", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sarifPath: FIXTURE_SARIF,
        repository: FAKE_REPO,
        ref: FAKE_REF,
        commit: FAKE_COMMIT,
      }),
    });
    const res = await uploadSarifPost(req);
    assert.equal(res.status, 200);
    const json = (await res.json()) as {
      ok: boolean;
      dryRun: boolean;
      schemaVersion: string;
      payload: UploadSarifPayload;
      nonClaims: { neverCallsGitHubFromDesk: boolean };
    };
    assert.equal(json.ok, true);
    assert.equal(json.dryRun, true);
    assert.equal(json.schemaVersion, UPLOAD_SARIF_DESK_SCHEMA);
    assert.equal(json.payload.dryRun, true);
    assert.ok(json.payload.body.sarif.length > 0);
    assert.equal(json.nonClaims.neverCallsGitHubFromDesk, true);
  });

  it("fixture:true without sarifPath returns 200", async () => {
    const req = new Request("http://localhost/api/upload-sarif", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fixture: true,
        repository: FAKE_REPO,
        ref: FAKE_REF,
        commit: FAKE_COMMIT,
      }),
    });
    const res = await uploadSarifPost(req);
    assert.equal(res.status, 200);
    const json = (await res.json()) as { ok: boolean; source: string };
    assert.equal(json.ok, true);
    assert.equal(json.source, "fixture");
  });

  it("missing SARIF returns 4xx", async () => {
    const req = new Request("http://localhost/api/upload-sarif", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sarifPath: path.join(root, "missing-nowhere.sarif"),
        repository: FAKE_REPO,
        ref: FAKE_REF,
        commit: FAKE_COMMIT,
      }),
    });
    const res = await uploadSarifPost(req);
    assert.ok(res.status >= 400 && res.status < 500);
    const json = (await res.json()) as {
      ok: boolean;
      dryRun: boolean;
      code?: string;
    };
    assert.equal(json.ok, false);
    assert.equal(json.dryRun, true);
    assert.ok(
      json.code === "PATH_POLICY" || json.code === "missing_sarif",
    );
  });

  it("invalid SARIF returns 400", async () => {
    const dir = mkSandboxTmp();
    const bad = path.join(dir, "bad.sarif");
    fs.writeFileSync(bad, "{ not valid sarif shape }", "utf8");
    try {
      const req = new Request("http://localhost/api/upload-sarif", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sarifPath: bad,
          repository: FAKE_REPO,
          ref: FAKE_REF,
          commit: FAKE_COMMIT,
        }),
      });
      const res = await uploadSarifPost(req);
      assert.equal(res.status, 400);
      const json = (await res.json()) as { ok: boolean; code?: string };
      assert.equal(json.ok, false);
      assert.equal(json.code, "invalid_sarif");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects dryRun:false (live upload refused)", async () => {
    const req = new Request("http://localhost/api/upload-sarif", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sarifPath: FIXTURE_SARIF,
        dryRun: false,
        repository: FAKE_REPO,
        ref: FAKE_REF,
        commit: FAKE_COMMIT,
      }),
    });
    const res = await uploadSarifPost(req);
    assert.equal(res.status, 403);
    const json = (await res.json()) as { code?: string; ok: boolean };
    assert.equal(json.code, "LIVE_REFUSED");
    assert.equal(json.ok, false);
  });

  it("rejects live:true", async () => {
    const req = new Request("http://localhost/api/upload-sarif", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fixture: true,
        live: true,
        repository: FAKE_REPO,
        ref: FAKE_REF,
        commit: FAKE_COMMIT,
      }),
    });
    const res = await uploadSarifPost(req);
    assert.equal(res.status, 403);
    const json = (await res.json()) as { code?: string };
    assert.equal(json.code, "LIVE_REFUSED");
  });

  it("rejects secret fields", async () => {
    const req = new Request("http://localhost/api/upload-sarif", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fixture: true,
        githubToken: "ghp_fake",
        repository: FAKE_REPO,
        ref: FAKE_REF,
        commit: FAKE_COMMIT,
      }),
    });
    const res = await uploadSarifPost(req);
    assert.equal(res.status, 403);
    const json = (await res.json()) as { code?: string };
    assert.equal(json.code, "SECRET_FIELD_REFUSED");
  });
});

describe("Prove doors upload-sarif dry-run wiring", () => {
  it("panel wires Dry-run Code Scanning upload → POST /api/upload-sarif", () => {
    const prove = fs.readFileSync(
      path.join(root, "src/components/operator/prove-doors-panel.tsx"),
      "utf8",
    );
    const route = fs.readFileSync(
      path.join(root, "src/app/api/upload-sarif/route.ts"),
      "utf8",
    );
    const desk = fs.readFileSync(
      path.join(root, "src/desk/upload-sarif.ts"),
      "utf8",
    );
    assert.match(prove, /data-testid="prove-doors-upload-sarif-card"/);
    assert.match(prove, /data-testid="prove-doors-upload-sarif-run"/);
    assert.match(prove, /data-testid="prove-doors-upload-sarif-json"/);
    assert.match(prove, /Dry-run Code Scanning upload/);
    assert.match(prove, /\/api\/upload-sarif/);
    assert.match(prove, /UPLOAD_SARIF_API_PATH|fetch\(UPLOAD_SARIF_API_PATH/);
    assert.match(prove, /never calls GitHub from Desk/i);
    assert.match(prove, /security_events/);
    assert.match(route, /runUploadSarifDryRun/);
    assert.match(route, /LIVE_REFUSED/);
    assert.match(route, /dryRun === false/);
    assert.match(desk, /deskDryRunOnly/);
    assert.match(desk, /neverCallsGitHubFromDesk/);
    assert.doesNotMatch(prove, /create-pod|auto-provision|AUROC\s*=/i);
    assert.equal(UPLOAD_SARIF_DESK_REPO_ROOT, root);
  });

  it("exporters.md notes Desk dry-run only", () => {
    const exporters = fs.readFileSync(
      path.join(root, "docs/exporters.md"),
      "utf8",
    );
    assert.match(exporters, /Desk.*dry-run only|POST \/api\/upload-sarif/i);
    assert.match(exporters, /live upload stays CLI|security_events/i);
  });
});
