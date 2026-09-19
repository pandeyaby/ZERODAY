/**
 * Shared FAQ — Keyless Strength honesty (post-K5).
 * UI reads this module; docs/faq.md mirrors the same Q&As (sync-tested).
 * Localization ≠ exploitability. Not a Cisco product.
 */

export type FaqBlock =
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] };

export interface FaqItem {
  id: string;
  question: string;
  answer: FaqBlock[];
}

export const FAQ_INTRO =
  "Honest answers after Keyless Strength. Localization is not proof of exploitability. ZERODAY is not a Cisco product.";

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: "keyless-mean-agent",
    question: "Does keyless mean a local AI agent?",
    answer: [
      {
        type: "p",
        text: "No. Keyless means no Antares HF token, no vendor API keys, and no cloud inference of customer source unless you explicitly opt into remote inference.",
      },
      {
        type: "p",
        text: "The keyless surface includes fixture smoke (`npm run mvp` / `locate --fixture`), thin heuristics (`locate --rules`), SARIF ingest (`locate --from-sarif`), org cassette replay (`locate --recording`), and the Desk loop (inventory → packet → harden → classify → craft) on your tree.",
      },
      {
        type: "p",
        text: "`zeroday operate` is a separate coding-agent path (emit brief → agent submission → package). It is one door, not the definition of keyless.",
      },
    ],
  },
  {
    id: "how-keyless-finds",
    question: "How does keyless “find” vulnerabilities?",
    answer: [
      {
        type: "ul",
        items: [
          "Fixture / mvp — replays a recorded demo brain for CI and strangers. Proves the workstation + SARIF habit; does not scan your live tree.",
          "`locate --rules` — thin in-repo CWE heuristics on an authorized `--repo` you pass. Candidate files only; not Antares File F1.",
          "`locate --from-sarif` — ingests a third-party SARIF file from disk into the same evidence writers. Reuses scanner output; does not invent novel CVEs.",
          "`locate --recording` — replays a human-reviewed redacted org cassette. Regression, not discovery.",
        ],
      },
      {
        type: "p",
        text: "None of these invent novel CVEs or prove exploitability. Live Antares (or another completions brain you already host) is the opt-in model localization path.",
      },
    ],
  },
  {
    id: "useless-without-antares",
    question: "Is ZERODAY useless without Antares?",
    answer: [
      {
        type: "p",
        text: "No — if you want Desk, CI fixture smoke, `--rules` candidates on your tree, SARIF ingest, org recordings, or the operate harness. Those paths run keyless without Antares weights.",
      },
      {
        type: "p",
        text: "Yes — if the only thing you want is Antares-quality model localization and you refuse every other brain (local Ollama/vLLM/LM Studio, rules, ingest, fixtures). Then you need a completions host serving Antares-1B (HF gated accept + CUDA/vLLM or equivalent).",
      },
    ],
  },
  {
    id: "verify-cwe-in-repo",
    question: "Does keyless verify that a CWE is present in my current repo?",
    answer: [
      {
        type: "ul",
        items: [
          "Fixture / mvp — No. Recorded demo only; not your tree.",
          "`locate --rules` — Emits heuristic candidates on the `--repo` you authorize. Not Antares File F1; not exploit proof.",
          "`locate --from-sarif` — Reflects what a third-party scanner already claimed in that file.",
          "Live Antares / `--endpoint` — Model localization on an authorized repo when you host a completions brain. Quality depends on the model; Antares-1B is recommended when available.",
        ],
      },
      {
        type: "p",
        text: "Always set needs_human. Localization ≠ exploitability.",
      },
    ],
  },
  {
    id: "doors-table",
    question: "Fixture vs rules vs ingest vs recording vs live Antares?",
    answer: [
      {
        type: "table",
        headers: ["Door", "Brain", "What it proves", "SARIF mode"],
        rows: [
          [
            "Fixture / mvp",
            "Deterministic recorded demo",
            "Factory shape + SARIF habit ($0)",
            "fixture",
          ],
          [
            "Rules",
            "Thin in-repo CWE heuristics",
            "Keyless candidates on your tree ($0)",
            "rules",
          ],
          [
            "SARIF ingest",
            "Existing CodeQL/Semgrep/… SARIF",
            "Reuse third-party findings ($0)",
            "ingest",
          ],
          [
            "Org recording",
            "Redacted cassette replay",
            "CI regression of a prior localize ($0)",
            "recording",
          ],
          [
            "Live completions",
            "Antares-1B recommended; or local Ollama/vLLM/LM Studio",
            "Live localization (quality depends on brain; may cost $)",
            "live",
          ],
        ],
      },
      {
        type: "p",
        text: "Doors are mutually exclusive flags — no silent fixture fallback when `--live` / `--endpoint` is set.",
      },
    ],
  },
  {
    id: "desk-without-locate",
    question: "What does Desk do at $0 without locate?",
    answer: [
      {
        type: "p",
        text: "Desk runs keyless on real paths (cwd / `--repo` / `--from`) without Antares: inventory → packet → harden → classify → craft.",
      },
      {
        type: "ul",
        items: [
          "inventory — config / agent / package surfaces on authorized trees",
          "packet — offline share pack from inventory + existing SARIF",
          "harden — recommend-only agent/package hygiene notes",
          "classify — crash / telemetry labels with needs_human (fixture or from prior reports)",
          "craft — generate-only defensive SKILL.md / plugin stubs (no auto-install, no PoCs)",
        ],
      },
      {
        type: "p",
        text: "Desk is not localization or vuln discovery. Use locate doors for that. Fixtures remain available via `--fixture` for CI smoke.",
      },
    ],
  },
  {
    id: "local-brain-vs-antares",
    question: "Is local Ollama / `--endpoint` the same as Antares File F1?",
    answer: [
      {
        type: "p",
        text: "No. Any OpenAI-compatible `POST /v1/completions` host can drive `locate --endpoint` (mode: live), but arbitrary local models ≠ Antares File F1. Antares-1B remains the recommended brain when you accept HF terms and serve it on CUDA/vLLM.",
      },
      {
        type: "p",
        text: "Start with print-only checklists: `zeroday doctor` (local Ollama/vLLM/LM Studio) and `zeroday antares doctor` (Antares/RunPod). Neither spends money or downloads `model.safetensors`. Non-loopback endpoints still need `--remote-inference` / `ZERODAY_REMOTE_INFERENCE_ACK=1`.",
      },
    ],
  },
  {
    id: "localization-vs-exploitability",
    question: "Is localization exploitability?",
    answer: [
      {
        type: "p",
        text: "No. Findings are detector-lane candidates. Human review required (`needs_human: true`). No auto-merge. ZERODAY never writes exploits, PoCs, payloads, or attack procedures.",
      },
    ],
  },
  {
    id: "vendor-push",
    question: "Does ZERODAY push to Splunk / XSOAR / Security Hub?",
    answer: [
      {
        type: "p",
        text: "No. Local files only (SARIF, Splunk CIM JSON, ASFF, …). Your team owns ingest and credentials. No BatchImportFindings, no live HEC, no Cisco Security Cloud API from this repo.",
      },
    ],
  },
  {
    id: "partnership",
    question: "Are you a Cisco / Splunk partner product?",
    answer: [
      {
        type: "p",
        text: "No. Not an official Cisco, Splunk, Palo Alto, Fortinet, CrowdStrike, AWS, or RunPod product. Sister tools — Antares, Foundry Security Spec, Project CodeGuard — compose; they do not make ZERODAY a partnership claim.",
      },
    ],
  },
  {
    id: "poc-refuse",
    question: "Can I get a PoC?",
    answer: [
      {
        type: "p",
        text: "No. If asked for fix + PoC: patch draft only (with `--i-asked-for-a-fix`), refuse the PoC in one sentence. Never auto-merge.",
      },
    ],
  },
  {
    id: "antares-weights-hf",
    question: "Do I need Antares weights / Hugging Face gated terms?",
    answer: [
      {
        type: "p",
        text: "Only for optional live Antares localization (`locate --live --endpoint …`) on a workstation that already hosts `fdtn-ai/antares-1b` via completions. Accept HF terms yourself — never scrape or bypass. CI never downloads `model.safetensors`. ZERODAY never downloads weights for you.",
      },
    ],
  },
  {
    id: "stranger-trust-loop",
    question: "What is the stranger trust loop after locate?",
    answer: [
      {
        type: "p",
        text: "Design-partner one-screen story: fixture locate → SARIF → `paired-probe:from-sarif` → checked-in sample DIPTYCH-shaped grade — no DIPTYCH clone, no GPU.",
      },
      {
        type: "ul",
        items: [
          "`npm run mvp` — fixture locate → `zeroday-reports/mvp/report.sarif`",
          "`npm run paired-probe:from-sarif -- --sarif zeroday-reports/mvp` — envelopes + coverage matrix",
          "Open `docs/reports/diptych-sample-grade.md` (illustrative sample grade; not a live DIPTYCH harness run)",
          "One-shot: `npm run trust-loop` (prints the same paths)",
        ],
      },
      {
        type: "p",
        text: "Honest non-claims: localization ≠ exploitability · no AUROC · DIPTYCH grades · ZeroDay emits · `needs_human` stays true. See `docs/paired-probes.md`, `docs/design-partner-trust.md`, and `SUPPORT.md`.",
      },
    ],
  },
];

/** Question titles in display order (for sync tests / indexes). */
export function faqQuestions(): string[] {
  return FAQ_ITEMS.map((item) => item.question);
}

/** Render structured FAQ to markdown (keeps docs/faq.md generator-friendly). */
export function faqToMarkdown(): string {
  const lines: string[] = ["# FAQ", "", FAQ_INTRO, ""];
  for (const item of FAQ_ITEMS) {
    lines.push(`## ${item.question}`, "");
    for (const block of item.answer) {
      if (block.type === "p") {
        lines.push(block.text, "");
      } else if (block.type === "ul") {
        for (const entry of block.items) {
          lines.push(`- ${entry}`);
        }
        lines.push("");
      } else if (block.type === "table") {
        lines.push(`| ${block.headers.join(" | ")} |`);
        lines.push(`| ${block.headers.map(() => "---").join(" | ")} |`);
        for (const row of block.rows) {
          lines.push(`| ${row.join(" | ")} |`);
        }
        lines.push("");
      }
    }
  }
  return `${lines.join("\n").trimEnd()}\n`;
}
