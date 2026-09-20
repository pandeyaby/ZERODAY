/**
 * Desk /play Prove doors panel — Run wiring + honesty (no GPU, no invented AUROC).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("Desk Prove doors panel", () => {
  it("play UI wires ProveDoorsPanel + Prove doors tab", () => {
    const panel = fs.readFileSync(
      path.join(root, "src/components/operator/org-usage-panel.tsx"),
      "utf8",
    );
    const prove = fs.readFileSync(
      path.join(root, "src/components/operator/prove-doors-panel.tsx"),
      "utf8",
    );
    assert.match(panel, /ProveDoorsPanel/);
    assert.match(panel, /"prove"/);
    assert.match(panel, /Prove doors/);
    assert.match(prove, /data-testid="prove-doors-panel"/);
    assert.match(prove, /npm run stranger:verify/);
    assert.match(prove, /npm run doors/);
  });

  it("panel cites Door A/B honesty facts already on gpu-claims / stranger-verify", () => {
    const prove = fs.readFileSync(
      path.join(root, "src/components/operator/prove-doors-panel.tsx"),
      "utf8",
    );
    assert.match(prove, /Door A/);
    assert.match(prove, /Door B/);
    assert.match(prove, /citation|Not run here|optional probe/i);
    assert.match(prove, /d65ny3xqf7bwza/);
    assert.match(prove, /\$0\.034|0\.034/);
    assert.match(prove, /src\/users\.js/);
    assert.match(prove, /gpu-claims\.md/);
    assert.match(prove, /ci-trust\.md/);
    assert.match(prove, /stranger-verify\.md/);
    assert.match(prove, /Live re-proof/);
    assert.match(prove, /2026-09-19/);
    assert.match(
      prove,
      /localization ≠ exploitability|localization != exploitability/i,
    );
    assert.match(prove, /CI badge ≠ vuln|CI badge.*vuln/i);
    assert.match(prove, /no AUROC|AUROC/i);
    assert.match(prove, /DIPTYCH grades/i);
    // Must not claim one-click GPU or invent metrics
    assert.doesNotMatch(prove, /create-pod|auto-provision|AUROC\s*=|File-F1\s*=/i);
  });

  it("wires Run → POST /api/stranger-verify + renders JSON (copy CLI secondary)", () => {
    const prove = fs.readFileSync(
      path.join(root, "src/components/operator/prove-doors-panel.tsx"),
      "utf8",
    );
    const route = fs.readFileSync(
      path.join(root, "src/app/api/stranger-verify/route.ts"),
      "utf8",
    );
    assert.match(prove, /data-testid="prove-doors-run"/);
    assert.match(prove, /data-testid="prove-doors-run-card"/);
    assert.match(prove, /data-testid="prove-doors-live-url"/);
    assert.match(prove, /data-testid="prove-doors-json-result"/);
    assert.match(prove, /\/api\/stranger-verify/);
    assert.match(prove, /fetch\(API_PATH|fetch\(["']\/api\/stranger-verify/);
    assert.match(prove, /method:\s*["']POST["']/);
    assert.match(prove, /liveUrl/);
    assert.match(prove, /prove-doors-copy/);
    assert.match(prove, /CLI \(secondary\)|copy-paste/i);
    assert.match(prove, /zeroday-stranger-verify\/v1/);
    assert.match(prove, /schemaVersion/);
    assert.match(prove, /doorA/);
    assert.match(prove, /doorB/);
    assert.match(prove, /nonClaims/);
    assert.match(prove, /provisioned:\s*false|provisioned: false/);
    assert.doesNotMatch(prove, /create-pod|auto-provision|AUROC\s*=/i);
    assert.match(route, /runStrangerVerify/);
    assert.match(route, /liveUrl/);
    assert.match(route, /SECRET_FIELD_REFUSED|hfToken/);
  });

  it("wires cassette:replay Run → POST /api/cassette-replay + real JSON result", () => {
    const prove = fs.readFileSync(
      path.join(root, "src/components/operator/prove-doors-panel.tsx"),
      "utf8",
    );
    const route = fs.readFileSync(
      path.join(root, "src/app/api/cassette-replay/route.ts"),
      "utf8",
    );
    assert.match(prove, /data-testid="prove-doors-cassette-card"/);
    assert.match(prove, /data-testid="prove-doors-cassette-run"/);
    assert.match(prove, /data-testid="prove-doors-cassette-json"/);
    assert.match(prove, /\/api\/cassette-replay/);
    assert.match(prove, /CASSETTE_API_PATH|fetch\(CASSETTE_API_PATH/);
    assert.match(prove, /cassette:replay/);
    assert.match(prove, /npm run cassette:replay/);
    assert.match(route, /runCassetteReplay/);
    assert.match(route, /ASSERT_MISMATCH/);
    assert.match(route, /SECRET_FIELD_REFUSED/);
    assert.doesNotMatch(prove, /create-pod|auto-provision|AUROC\s*=/i);
  });

  it("README + howto point at Desk Prove doors tab", () => {
    const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
    const howto = fs.readFileSync(path.join(root, "docs/howto.md"), "utf8");
    const stranger = fs.readFileSync(
      path.join(root, "docs/stranger-verify.md"),
      "utf8",
    );
    assert.match(readme, /Prove doors/);
    assert.match(readme, /stranger:verify/);
    assert.match(readme, /--json|machine-readable-json/i);
    assert.match(howto, /Prove doors/);
    assert.match(howto, /stranger:verify/);
    assert.match(howto, /stranger-verify-json|--json/);
    assert.match(stranger, /Prove doors/);
    assert.match(stranger, /localhost:3333\/play/);
    assert.match(stranger, /### Machine-readable JSON \(--json\)/);
    assert.match(stranger, /stranger-verify-json/);
  });
});
