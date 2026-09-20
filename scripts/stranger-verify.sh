#!/usr/bin/env bash
# scripts/stranger-verify.sh — prove-doors card for first-time visitors
#
# Keyless default. Reuses npm run trust-loop (locate SARIF → paired-probe).
# Does NOT provision pods, invoke RunPod pod-creation APIs, pull HF weights, or
# invent AUROC / F1 / latency SLAs.
#
# Door A: what just ran (PASS + artifact pointers)
# Door B: cite docs/gpu-claims.md § Live re-proof (2026-09-19) — dated measured
#         citation only by default; never spend GPU money from this script.
# Opt-in: --live-url <openai-compatible /v1> → GET /v1/models against an
#         operator-supplied URL only (mode: operator_endpoint). Probe ≠ dated
#         Secure A40 re-proof. provisioned: false · spendUsd: null.
#
# Machine-readable: --json or ZERODAY_STRANGER_JSON=1 → single JSON object on stdout
# (trust-loop prose on stderr). Default remains the human prove-doors card.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

OUT_ROOT="${TRUST_LOOP_OUT:-zeroday-reports/trust-loop}"
SAMPLE_GRADE_MD="docs/reports/diptych-sample-grade.md"
GPU_CLAIMS="docs/gpu-claims.md"
SCHEMA_VERSION="zeroday-stranger-verify/v1"

# Door B citation facts — quote only what docs/gpu-claims.md § Live re-proof already records.
DOOR_B_SECTION="Live re-proof (2026-09-19 PT)"
DOOR_B_POD_ID="d65ny3xqf7bwza"
DOOR_B_TIER="RunPod Secure Cloud · NVIDIA A40"
DOOR_B_ESTIMATED_SPEND='~$0.034'
DOOR_B_MODELS_HTTP=200
DOOR_B_COMPLETIONS_HTTP=200
DOOR_B_LOCATE_FILE="src/users.js"

usage() {
  cat <<'EOF'
Usage: npm run stranger:verify   (alias: npm run doors)

  Keyless prove-doors path for strangers:
    1. Runs npm run trust-loop (fixture SARIF → paired-probe:from-sarif)
    2. Prints Door A / Door B honest card (Door B = citation only — no GPU)

  Options:
    --json              Print a single JSON object to stdout (schemaVersion + doorA/doorB/nonClaims)
                        Same as ZERODAY_STRANGER_JSON=1. Trust-loop prose goes to stderr.
    --human             Force human-readable card (default when --json is not set)
    --mvp               Forwarded to trust-loop (run npm run mvp first)
    --live-url <url>    Opt-in Door B probe: GET /v1/models on an operator-supplied
                        OpenAI-compatible base (e.g. http://127.0.0.1:8000/v1).
                        Records status + latency under doorB.probe; mode=operator_endpoint;
                        provisioned=false; spendUsd=null. NEVER creates RunPod pods,
                        NEVER reads HF tokens / pulls weights. Probe ≠ dated A40 re-proof.
    --help              Show this help

Never provisions pods. Never invokes RunPod pod-creation APIs. Never invents AUROC / File-F1 / SLAs.
EOF
}

JSON_MODE=0
if [[ "${ZERODAY_STRANGER_JSON:-}" == "1" ]]; then
  JSON_MODE=1
fi

LIVE_URL=""
FORWARD_ARGS=()
ARGS=("$@")
i=0
while [[ $i -lt ${#ARGS[@]} ]]; do
  arg="${ARGS[$i]}"
  case "$arg" in
    --help|-h) usage; exit 0 ;;
    --json) JSON_MODE=1 ;;
    --human) JSON_MODE=0 ;;
    --mvp) FORWARD_ARGS+=(--mvp) ;;
    --live-url=*)
      LIVE_URL="${arg#--live-url=}"
      ;;
    --live-url)
      i=$((i + 1))
      if [[ $i -ge ${#ARGS[@]} ]]; then
        echo "ERROR: --live-url requires a URL (e.g. http://127.0.0.1:8000/v1)" >&2
        usage >&2
        exit 2
      fi
      LIVE_URL="${ARGS[$i]}"
      ;;
    *)
      echo "Unknown arg: $arg" >&2
      usage >&2
      exit 2
      ;;
  esac
  i=$((i + 1))
done

if [[ -n "$LIVE_URL" ]]; then
  LIVE_URL="$(echo "$LIVE_URL" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
  if [[ -z "$LIVE_URL" ]]; then
    echo "ERROR: --live-url is empty" >&2
    exit 2
  fi
  # Refuse weight-pull / RunPod-create side channels — probe is HTTP GET only.
  # Do not read HF_TOKEN / HUGGING_FACE_HUB_TOKEN / RUNPOD_API_KEY for this path.
  unset HF_TOKEN HUGGING_FACE_HUB_TOKEN RUNPOD_API_KEY RUNPOD_API_KEY_ESCAPED 2>/dev/null || true
fi

DOOR_A_COMMAND="npm run trust-loop"
if [[ ${#FORWARD_ARGS[@]} -gt 0 ]]; then
  DOOR_A_COMMAND="npm run trust-loop -- ${FORWARD_ARGS[*]}"
fi

# ── Door A: run keyless trust-loop ──────────────────────────────────────────
run_trust_loop() {
  if [[ ${#FORWARD_ARGS[@]} -gt 0 ]]; then
    npm run trust-loop -- "${FORWARD_ARGS[@]}"
  else
    npm run trust-loop
  fi
}

if [[ "$JSON_MODE" -eq 1 ]]; then
  # Keep stdout clean for jq / CI parsers — trust-loop prose on stderr.
  run_trust_loop >&2
else
  echo "ZERODAY prove-doors (keyless · no GPU spend · no RunPod pod-creation)"
  echo "════════════════════════════════════════════"
  echo ""
  run_trust_loop
fi

MATRIX="$OUT_ROOT/paired-probe/coverage/matrix.json"
ENVELOPES="$OUT_ROOT/paired-probe/"

# ── Door B opt-in: operator-supplied endpoint probe (GET /v1/models only) ───
# Probe result file (empty when --live-url unset). Shape matches doorB.probe.
PROBE_JSON_FILE="$(mktemp "${TMPDIR:-/tmp}/zeroday-stranger-probe.XXXXXX")"
trap 'rm -f "$PROBE_JSON_FILE"' EXIT

PROBE_MODE="citation"
PROBE_RAN="false"
if [[ -n "$LIVE_URL" ]]; then
  PROBE_MODE="operator_endpoint"
  # Node probe: normalize like completionsBaseUrl, GET /v1/models, record latency.
  # Never talks to RunPod management APIs; never uses HF tokens.
  LIVE_URL="$LIVE_URL" PROBE_JSON_FILE="$PROBE_JSON_FILE" node <<'NODE'
const fs = require("node:fs");
const endpoint = String(process.env.LIVE_URL || "").trim();
const outPath = process.env.PROBE_JSON_FILE;

function modelsUrlFrom(raw) {
  let base = raw.replace(/\/+$/, "");
  if (/\/v1\/completions$/i.test(base)) base = base.replace(/\/v1\/completions$/i, "");
  else if (/\/v1$/i.test(base)) base = base.replace(/\/v1$/i, "");
  return `${base}/v1/models`;
}

const modelsUrl = modelsUrlFrom(endpoint);
const started = Date.now();
const result = {
  mode: "operator_endpoint",
  provisioned: false,
  spendUsd: null,
  modelsUrl,
  endpoint,
  ok: false,
  httpStatus: null,
  latencyMs: null,
  detail: "",
};

(async () => {
  try {
    const res = await fetch(modelsUrl, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });
    const latencyMs = Date.now() - started;
    let modelCount = null;
    try {
      const body = await res.json();
      if (body && Array.isArray(body.data)) modelCount = body.data.length;
    } catch {
      /* body optional for health */
    }
    result.httpStatus = res.status;
    result.latencyMs = latencyMs;
    result.ok = res.ok;
    result.detail = res.ok
      ? `GET ${modelsUrl} → ${res.status} (${latencyMs}ms${modelCount != null ? `; ${modelCount} model(s)` : ""})`
      : `GET ${modelsUrl} → ${res.status} (${latencyMs}ms)`;
  } catch (e) {
    result.latencyMs = Date.now() - started;
    result.httpStatus = null;
    result.ok = false;
    result.detail = `GET ${modelsUrl} failed: ${e && e.message ? e.message : String(e)}`;
  }
  fs.writeFileSync(outPath, JSON.stringify(result));
  process.exit(0);
})();
NODE
  PROBE_RAN="true"
fi

emit_json() {
  # Single object on stdout.
  # Default doorB.mode=citation · ran=false. With --live-url: mode=operator_endpoint
  # + doorB.probe (provisioned:false, spendUsd:null) — not measured A40 re-proof.
  # shellcheck disable=SC2016
  node -e '
const fs = require("node:fs");
let probe = null;
const probePath = process.env.PROBE_JSON_FILE;
if (probePath && fs.existsSync(probePath)) {
  const raw = fs.readFileSync(probePath, "utf8").trim();
  if (raw) probe = JSON.parse(raw);
}
const citation = {
  doc: process.env.GPU_CLAIMS,
  section: process.env.DOOR_B_SECTION,
  factsDocumented: {
    podId: process.env.DOOR_B_POD_ID,
    tierGpu: process.env.DOOR_B_TIER,
    estimatedSpend: process.env.DOOR_B_ESTIMATED_SPEND,
    modelsHttp: Number(process.env.DOOR_B_MODELS_HTTP),
    completionsHttp: Number(process.env.DOOR_B_COMPLETIONS_HTTP),
    liveLocateRankedFile: process.env.DOOR_B_LOCATE_FILE,
  },
};
const doorB = probe
  ? {
      mode: "operator_endpoint",
      ran: true,
      provisioned: false,
      spendUsd: null,
      probe: {
        modelsUrl: probe.modelsUrl,
        endpoint: probe.endpoint,
        ok: probe.ok,
        httpStatus: probe.httpStatus,
        latencyMs: probe.latencyMs,
        detail: probe.detail,
        provisioned: false,
        spendUsd: null,
        mode: "operator_endpoint",
      },
      citation,
      note: "Operator-supplied endpoint probe only (GET /v1/models) — not measured Secure A40 re-proof; cite docs/gpu-claims.md § Live re-proof for historical facts. No pod create / no HF pull / spendUsd null.",
    }
  : {
      mode: "citation",
      ran: false,
      citation,
      note: "Door B was not executed by this command — quote docs/gpu-claims.md only; do not invent $ / pod / latency.",
    };
const payload = {
  schemaVersion: process.env.SCHEMA_VERSION,
  doorA: {
    status: "pass",
    ran: true,
    command: process.env.DOOR_A_COMMAND,
    artifacts: {
      envelopes: process.env.ENVELOPES,
      matrix: process.env.MATRIX,
      sampleGradeMd: process.env.SAMPLE_GRADE_MD,
    },
  },
  doorB,
  nonClaims: {
    localizationNotExploitability: true,
    needsHuman: true,
    noAurocFileF1OrgLatencySla: true,
    ciBadgeNotVulnProof: true,
    diptychGradesSeparately: true,
    sampleGradeIllustrative: true,
    probeNotMeasuredA40ReProof: true,
    noRunPodCreateFromStrangerVerify: true,
  },
};
process.stdout.write(JSON.stringify(payload) + "\n");
'
}

emit_json_env() {
  SCHEMA_VERSION="$SCHEMA_VERSION" \
  DOOR_A_COMMAND="$DOOR_A_COMMAND" \
  ENVELOPES="$ENVELOPES" \
  MATRIX="$MATRIX" \
  SAMPLE_GRADE_MD="$SAMPLE_GRADE_MD" \
  GPU_CLAIMS="$GPU_CLAIMS" \
  DOOR_B_SECTION="$DOOR_B_SECTION" \
  DOOR_B_POD_ID="$DOOR_B_POD_ID" \
  DOOR_B_TIER="$DOOR_B_TIER" \
  DOOR_B_ESTIMATED_SPEND="$DOOR_B_ESTIMATED_SPEND" \
  DOOR_B_MODELS_HTTP="$DOOR_B_MODELS_HTTP" \
  DOOR_B_COMPLETIONS_HTTP="$DOOR_B_COMPLETIONS_HTTP" \
  DOOR_B_LOCATE_FILE="$DOOR_B_LOCATE_FILE" \
  PROBE_JSON_FILE="$PROBE_JSON_FILE" \
    emit_json
}

if [[ "$JSON_MODE" -eq 1 ]]; then
  emit_json_env
  exit 0
fi

echo ""
echo "════════════════════════════════════════════"
echo "PROVE-DOORS CARD"
echo "════════════════════════════════════════════"
echo ""
echo "Door A — Keyless (just ran · PASS)"
echo "  Ran: npm run trust-loop → paired-probe:from-sarif (offline fixture SARIF)"
echo "  Artifacts:"
echo "    envelopes : $ENVELOPES"
echo "    matrix    : $MATRIX"
echo "    sample md : $SAMPLE_GRADE_MD"
echo "  Also see: npm run mvp → zeroday-reports/mvp/ (fixture locate → SARIF)"
echo "  CI badge story: docs/ci-trust.md"
echo ""

if [[ "$PROBE_MODE" == "operator_endpoint" ]]; then
  PROBE_DETAIL="$(PROBE_JSON_FILE="$PROBE_JSON_FILE" node -e '
const fs = require("node:fs");
const p = JSON.parse(fs.readFileSync(process.env.PROBE_JSON_FILE, "utf8"));
const status = p.httpStatus == null ? "unreachable" : String(p.httpStatus);
const lat = p.latencyMs == null ? "?" : String(p.latencyMs);
process.stdout.write([
  p.ok ? "ok" : "fail",
  p.modelsUrl,
  status,
  lat,
  p.detail || "",
].join("\t"));
')"
  IFS=$'\t' read -r PROBE_OK_LABEL PROBE_MODELS_URL PROBE_HTTP PROBE_LAT PROBE_DETAIL_TEXT <<<"$PROBE_DETAIL"
  echo "Door B — Operator endpoint probe (opt-in · NOT provisioned · spendUsd null)"
  echo "  Mode: operator_endpoint · provisioned: false · spendUsd: null"
  echo "  Probe: GET $PROBE_MODELS_URL → $PROBE_HTTP in ${PROBE_LAT}ms ($PROBE_OK_LABEL)"
  echo "  Detail: $PROBE_DETAIL_TEXT"
  echo "  Honest: validates YOUR endpoint only — not the dated Secure A40 re-proof."
  echo "  Historical cite (separate): $GPU_CLAIMS § Live re-proof (2026-09-19 PT)"
  echo "    · pod id $DOOR_B_POD_ID · tier $DOOR_B_TIER · est. \$ $DOOR_B_ESTIMATED_SPEND"
  echo "  No RunPod pod-creation · no HF token / weight pull from this command."
else
  echo "Door B — Live GPU (citation only · NOT run here)"
  echo "  Do not provision pods from this command. Cite the dated operator re-proof:"
  echo "  → $GPU_CLAIMS § Live re-proof (2026-09-19 PT)"
  echo "  Measured facts already on that page (quote only — invent nothing):"
  echo "    · pod id        $DOOR_B_POD_ID"
  echo "    · tier / GPU    $DOOR_B_TIER"
  echo "    · estimated \$   $DOOR_B_ESTIMATED_SPEND (under ≤\$0.50 ceiling; rate \$0.49/hr at create)"
  echo "    · models ping   GET /v1/models → $DOOR_B_MODELS_HTTP"
  echo "    · completions   POST /v1/completions → $DOOR_B_COMPLETIONS_HTTP"
  echo "    · live locate   ranked file $DOOR_B_LOCATE_FILE (CWE-89 fixture; localization-only)"
  echo "  Opt-in probe (your endpoint only, no spend): --live-url http://127.0.0.1:8000/v1"
  echo "  To re-run Door B yourself: docs/runpod-antares.md (you provision + terminate)."
fi

echo ""
echo "Non-claims (honest)"
echo "  · localization ≠ exploitability · needs_human stays true"
echo "  · CI badge ≠ vuln proof (see docs/ci-trust.md)"
echo "  · no AUROC / File-F1 / org-scale latency SLAs invented here"
echo "  · probe ≠ measured A40 re-proof (see docs/gpu-claims.md § Live re-proof)"
echo "  · DIPTYCH grades separately · ZeroDay emits"
echo "  · sample grade is illustrative (not a live DIPTYCH harness run)"
echo ""
echo "Docs: docs/stranger-verify.md · docs/ci-trust.md · docs/gpu-claims.md · SUPPORT.md"
echo "PASS — Door A keyless path verified locally${PROBE_RAN:+ · Door B probe recorded (not provisioned)}."
