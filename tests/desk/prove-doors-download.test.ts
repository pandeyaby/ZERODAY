/**
 * Client-side prove-doors.json download helper — serialize + download wiring.
 * Matches CLI `prove-doors --out prove-doors.json` / CI artifact shape.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  downloadProveDoorsJson,
  PROVE_DOORS_DOWNLOAD_FILENAME,
  PROVE_DOORS_DOWNLOAD_SCHEMA,
  serializeProveDoorsJson,
} from "../../src/desk/prove-doors-download.ts";
import { PROVE_DOORS_SCHEMA } from "../../src/desk/prove-doors.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const SAMPLE_PAYLOAD = {
  schemaVersion: PROVE_DOORS_DOWNLOAD_SCHEMA,
  ok: true,
  generatedAt: "2026-09-20T00:00:00.000Z",
  doors: {
    a: { status: "ok", label: "a" },
    cassette: { status: "ok", label: "cassette" },
    b: { status: "skipped", label: "b", reason: "liveUrl omitted" },
    d: { status: "ok", label: "d" },
    e: { status: "ok", label: "e" },
  },
  nonClaims: { localizationNotExploitability: true },
};

describe("prove-doors download helper", () => {
  it("serializeProveDoorsJson matches CLI --out pretty JSON + trailing newline", () => {
    const text = serializeProveDoorsJson(SAMPLE_PAYLOAD);
    assert.equal(text, `${JSON.stringify(SAMPLE_PAYLOAD, null, 2)}\n`);
    assert.ok(text.endsWith("\n"));
    const parsed = JSON.parse(text) as typeof SAMPLE_PAYLOAD;
    assert.equal(parsed.schemaVersion, PROVE_DOORS_SCHEMA);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.doors.b.status, "skipped");
  });

  it("downloadProveDoorsJson uses filename prove-doors.json and clicks anchor", () => {
    const clicks: string[] = [];
    const created: Array<{ download: string; href: string }> = [];
    let revoked: string | null = null;
    const fakeAnchor = {
      href: "",
      download: "",
      rel: "",
      parentNode: null as { removeChild: (el: unknown) => void } | null,
      setAttribute(_k: string, _v: string) {},
      click() {
        clicks.push(this.download);
      },
    };

    const result = downloadProveDoorsJson(SAMPLE_PAYLOAD, {
      deps: {
        createObjectURL: (blob) => {
          assert.ok(blob instanceof Blob);
          assert.match(blob.type, /application\/json/);
          return "blob:prove-doors-test";
        },
        revokeObjectURL: (url) => {
          revoked = url;
        },
        createElement: ((tag: string) => {
          assert.equal(tag, "a");
          return fakeAnchor as unknown as HTMLAnchorElement;
        }) as Document["createElement"],
        appendChild: (el) => {
          created.push({
            download: (el as HTMLAnchorElement).download,
            href: (el as HTMLAnchorElement).href,
          });
          fakeAnchor.parentNode = {
            removeChild() {},
          };
        },
        removeChild: () => {},
      },
    });

    assert.equal(result.filename, PROVE_DOORS_DOWNLOAD_FILENAME);
    assert.equal(result.filename, "prove-doors.json");
    assert.equal(result.schemaHint, PROVE_DOORS_SCHEMA);
    assert.equal(result.text, serializeProveDoorsJson(SAMPLE_PAYLOAD));
    assert.deepEqual(clicks, ["prove-doors.json"]);
    assert.equal(fakeAnchor.download, "prove-doors.json");
    assert.equal(fakeAnchor.href, "blob:prove-doors-test");
    assert.equal(revoked, "blob:prove-doors-test");
    assert.equal(created.length, 1);
    assert.equal(created[0]?.download, "prove-doors.json");
  });

  it("panel wires Download prove-doors.json + Copy after Run-all result", () => {
    const prove = fs.readFileSync(
      path.join(root, "src/components/operator/prove-doors-panel.tsx"),
      "utf8",
    );
    const helper = fs.readFileSync(
      path.join(root, "src/desk/prove-doors-download.ts"),
      "utf8",
    );
    assert.match(helper, /PROVE_DOORS_DOWNLOAD_FILENAME/);
    assert.match(helper, /serializeProveDoorsJson/);
    assert.match(helper, /downloadProveDoorsJson/);
    assert.match(helper, /zeroday-prove-doors\/v1/);
    assert.match(prove, /downloadProveDoorsJson/);
    assert.match(prove, /PROVE_DOORS_DOWNLOAD_FILENAME/);
    assert.match(prove, /data-testid="prove-doors-run-all-download"/);
    assert.match(prove, /testId="prove-doors-run-all-copy"/);
    assert.match(prove, /Download \{PROVE_DOORS_DOWNLOAD_FILENAME\}/);
    assert.match(prove, /serializeProveDoorsJson\(allResult\)/);
    assert.match(prove, /Same shape as CLI/);
    assert.doesNotMatch(prove, /create-pod|auto-provision|AUROC\s*=/i);
  });
});
