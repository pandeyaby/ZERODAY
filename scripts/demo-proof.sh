#!/usr/bin/env bash
# scripts/demo-proof.sh — CI-safe public proof (fixture locate → SARIF)
#
# Regenerates examples/sample-live-sarif/ from the bundled demo-app.
# Does NOT download weights. Does NOT call live Antares.
#
# Live product path (separate — needs local completions):
#   bash scripts/quickstart-live.sh <authorized-repo> CWE-89
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

OUT="${1:-examples/sample-live-sarif}"
TMP="$(mktemp -d /tmp/zeroday-demo-proof.XXXXXX)"
trap 'rm -rf "$TMP"' EXIT

echo "ZERODAY demo proof (CI / no-GPU fixture — not live Antares)"
echo "──────────────────────────────────────────────────────────"

npm run zeroday -- locate \
  --cwe CWE-89 \
  --fixture \
  --repo fixtures/locate/demo-app \
  --output "$TMP"

test -f "$TMP/report.sarif"
test -f "$TMP/report.json"

mkdir -p "$OUT/demo-app"

OUT="$OUT" TMP="$TMP" node << 'NODE'
const fs = require("fs");
const path = require("path");
const out = process.env.OUT;
const tmp = process.env.TMP;
const sarif = JSON.parse(fs.readFileSync(path.join(tmp, "report.sarif"), "utf8"));
for (const run of sarif.runs) {
  run.tool.driver.name = "ZERODAY-Antares";
  if (run.originalUriBaseIds && run.originalUriBaseIds["%SRCROOT%"]) {
    run.originalUriBaseIds["%SRCROOT%"].uri =
      "file:///examples/sample-live-sarif/demo-app/";
  }
  if (run.properties) {
    run.properties.warnings = [
      "Public sample regenerated via locate --fixture (CI / no-GPU).",
      "Live runs use the same SARIF schema with mode=live.",
    ];
  }
}
fs.writeFileSync(
  path.join(out, "report.sarif"),
  JSON.stringify(sarif, null, 2) + "\n",
);
const excerpt = {
  $schema: sarif.$schema,
  version: sarif.version,
  runs: [
    {
      tool: {
        driver: {
          name: "ZERODAY-Antares",
          informationUri: "https://github.com/pandeyaby/ZERODAY",
        },
      },
      results: sarif.runs[0].results.slice(0, 2),
    },
  ],
};
fs.writeFileSync(
  path.join(out, "report.excerpt.sarif.json"),
  JSON.stringify(excerpt, null, 2) + "\n",
);
const report = JSON.parse(
  fs.readFileSync(path.join(tmp, "report.json"), "utf8"),
);
report.targetRepo = "examples/sample-live-sarif/demo-app";
report.snapshotPath = "(destroyed after run)";
report.warnings = [
  "Public sample: fixture/recorded Antares-style localization (not live weights).",
];
delete report.evidence;
fs.writeFileSync(
  path.join(out, "report.json"),
  JSON.stringify(report, null, 2) + "\n",
);
NODE

printf '%s\n' \
  'Public path label for sample SARIF uris (see fixtures/locate/demo-app for sources).' \
  > "$OUT/demo-app/README.md"

echo ""
echo "Proof artifacts written:"
echo "  SARIF   $OUT/report.sarif"
echo "  Excerpt $OUT/report.excerpt.sarif.json"
echo "  JSON    $OUT/report.json"
echo ""
echo "Live path (needs local completions + HF license accept):"
echo "  bash scripts/quickstart-live.sh <authorized-repo> CWE-89"
echo "Posture: localization only · not exploitability proof · no PoC"
