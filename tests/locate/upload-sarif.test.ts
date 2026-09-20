/**
 * upload-sarif — dry-run + fail-closed validation.
 * Never hits GitHub; transport mock asserts no network on dry-run.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import {
  uploadSarif,
  loadAndValidateSarif,
  encodeSarifForGitHub,
  buildUploadPayload,
  formatDryRunSummary,
  UploadSarifError,
  type UploadSarifPayload,
  type UploadSarifResult,
} from "../../src/locate/upload-sarif.ts";

const FIXTURE_SARIF = path.resolve(
  "fixtures/locate/ingest-sample/sample.sarif",
);
const SAMPLE_LIVE_SARIF = path.resolve(
  "examples/sample-live-sarif/report.sarif",
);

const FAKE_COMMIT = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const FAKE_REF = "refs/heads/main";
const FAKE_REPO = "pandeyaby/ZERODAY";

describe("upload-sarif", () => {
  it("loadAndValidateSarif accepts fixture SARIF", () => {
    const loaded = loadAndValidateSarif(FIXTURE_SARIF);
    assert.ok(loaded.bytes > 0);
    assert.equal(typeof loaded.raw, "string");
  });

  it("encodeSarifForGitHub is gzip+base64 round-trippable", () => {
    const { raw } = loadAndValidateSarif(SAMPLE_LIVE_SARIF);
    const b64 = encodeSarifForGitHub(raw);
    const round = gunzipSync(Buffer.from(b64, "base64")).toString("utf8");
    assert.equal(round, raw);
  });

  it("dry-run with valid fixture SARIF succeeds and never invokes transport", () => {
    let transportCalls = 0;
    const transport = (_payload: UploadSarifPayload): UploadSarifResult => {
      transportCalls += 1;
      throw new Error("network must not be called in dry-run");
    };

    const result = uploadSarif({
      sarifPath: FIXTURE_SARIF,
      repository: FAKE_REPO,
      ref: FAKE_REF,
      commit: FAKE_COMMIT,
      dryRun: true,
      transport,
    });

    assert.equal(result.ok, true);
    assert.equal(result.dryRun, true);
    assert.equal(transportCalls, 0);
    assert.match(result.payload.endpoint, /\/code-scanning\/sarifs$/);
    assert.equal(result.payload.method, "POST");
    assert.equal(result.payload.body.commit_sha, FAKE_COMMIT);
    assert.equal(result.payload.body.ref, FAKE_REF);
    assert.ok(result.payload.body.sarif.length > 0);
    assert.equal(result.payload.posture.localizationOnly, true);
    assert.equal(result.payload.posture.notExploitProof, true);
    assert.match(formatDryRunSummary(result.payload), /dry-run/i);
    assert.match(result.message, /Dry-run OK/i);
  });

  it("dry-run can write request JSON without network", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-upload-sarif-"));
    const out = path.join(dir, "request.json");
    let transportCalls = 0;

    const result = uploadSarif({
      sarifPath: SAMPLE_LIVE_SARIF,
      repository: FAKE_REPO,
      ref: FAKE_REF,
      commit: FAKE_COMMIT,
      dryRun: true,
      writeRequest: out,
      transport: () => {
        transportCalls += 1;
        throw new Error("network");
      },
    });

    assert.equal(result.ok, true);
    assert.equal(transportCalls, 0);
    assert.ok(fs.existsSync(out));
    const written = JSON.parse(fs.readFileSync(out, "utf8")) as UploadSarifPayload;
    assert.equal(written.dryRun, true);
    assert.equal(written.body.commit_sha, FAKE_COMMIT);
    assert.ok(written.body.sarif.length > 10);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("missing SARIF fails closed", () => {
    assert.throws(
      () =>
        uploadSarif({
          sarifPath: path.join(os.tmpdir(), "no-such-zeroday.sarif"),
          repository: FAKE_REPO,
          ref: FAKE_REF,
          commit: FAKE_COMMIT,
          dryRun: true,
        }),
      (e: unknown) =>
        e instanceof UploadSarifError && e.code === "missing_sarif",
    );
  });

  it("invalid JSON SARIF fails closed", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-upload-sarif-"));
    const bad = path.join(dir, "bad.sarif");
    fs.writeFileSync(bad, "{not-json", "utf8");
    assert.throws(
      () =>
        uploadSarif({
          sarifPath: bad,
          repository: FAKE_REPO,
          ref: FAKE_REF,
          commit: FAKE_COMMIT,
          dryRun: true,
        }),
      (e: unknown) =>
        e instanceof UploadSarifError && e.code === "invalid_sarif",
    );
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("invalid SARIF shape fails closed", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zeroday-upload-sarif-"));
    const bad = path.join(dir, "shape.sarif");
    fs.writeFileSync(
      bad,
      JSON.stringify({ version: "2.1.0", runs: [] }),
      "utf8",
    );
    assert.throws(
      () =>
        uploadSarif({
          sarifPath: bad,
          repository: FAKE_REPO,
          ref: FAKE_REF,
          commit: FAKE_COMMIT,
          dryRun: true,
        }),
      (e: unknown) =>
        e instanceof UploadSarifError && e.code === "invalid_sarif",
    );
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("bad commit sha fails closed", () => {
    assert.throws(
      () =>
        buildUploadPayload({
          sarifPath: FIXTURE_SARIF,
          repository: FAKE_REPO,
          ref: FAKE_REF,
          commit: "short",
          dryRun: true,
        }),
      (e: unknown) =>
        e instanceof UploadSarifError && e.code === "bad_commit",
    );
  });

  it("live path invokes transport once (mocked — no real network)", () => {
    let transportCalls = 0;
    const result = uploadSarif({
      sarifPath: FIXTURE_SARIF,
      repository: FAKE_REPO,
      ref: FAKE_REF,
      commit: FAKE_COMMIT,
      dryRun: false,
      transport: (payload) => {
        transportCalls += 1;
        assert.equal(payload.dryRun, false);
        assert.ok(payload.body.sarif.length > 0);
        return {
          ok: true,
          dryRun: false,
          payload,
          uploadId: "test-id",
          message: "Uploaded SARIF to Code Scanning (id=test-id)",
        };
      },
    });
    assert.equal(transportCalls, 1);
    assert.equal(result.uploadId, "test-id");
    assert.equal(result.dryRun, false);
  });
});
