# Antares localization benchmark (real advisories)

35 published GitHub-reviewed advisories across 12 CWEs, one project each, newest first (published 2026-06-23 … 2026-09-24). Each repository is checked out at the **parent of the fix commit** (no history), every arm is given **only the CWE**, and a run scores a hit when a file the fix modified (tests excluded) is ranked. Cases: [`bench/antares/cases.json`](../bench/antares/cases.json) · curation: [`bench/antares/curate.py`](../bench/antares/curate.py) · runner: `npm run bench:antares`.

Model: `fdtn-ai/antares-1b` via `cisco-antares-cli`.

**Ground-truth corrections.** A file the fix *added* does not exist in the vulnerable snapshot, so it cannot be ranked. One case is left out because its only fixed file was added by the fix: [GHSA-w6w4-rjh9-9r58](https://github.com/advisories/GHSA-w6w4-rjh9-9r58). [GHSA-xpjq-3w4w-w5wr](https://github.com/advisories/GHSA-xpjq-3w4w-w5wr) drops `markdownSanitizeSchema.ts`; [GHSA-mw6r-2hvm-4rp2](https://github.com/advisories/GHSA-mw6r-2hvm-4rp2) drops `safe_parser.py`. All runs are re-scored from their recorded ranked lists.

## What this shows

- **Antares reaches weaknesses the rules cannot model.** Missing authorization, authentication, ReDoS and prototype pollution: the rules find nothing; Antares-1B puts a fixed file in the top 3 in 22% (95% CI 8–36) of runs (paired difference +22 points (95% CI +8 to +36), measurable). Where the rules do apply, Antares vs rules on Hit@1 is +10 points (95% CI −10 to +30); over all cases +11 points (95% CI −2 to +25) — not a measurable difference at this sample size.
- **Antares-1B varies from run to run**, and `--samples 2` runs it twice and merges by vote (`scan` and `locate --live` default to one run). Run live on all 35 cases (3 passes each), it ranked the fixed file first in 29% (95% CI 17–41) of runs, against 26% (95% CI 16–36) for a single run: a paired difference of +3 points (95% CI −6 to +11). That is within the noise at this sample size, and merging costs a second run.
- **Showing both lists helps a reviewer, at a cost.** The top 3 of *either* list holds a fixed file more often than either list alone (tables below), but that is up to 6 files to read instead of 3. `scan` and `locate --live` show both and mark where they agree.
- **Sending the rules findings to Antares as context did not help** (paired differences below), so it is off by default (`--context` opts in). Runs where the rules had nothing to send are identical to Antares alone; the gap on model-only CWEs is run-to-run variation, which shows how noisy single runs are.

## Training-data overlap

Antares-1B's training data ends **2025-04-10** ([model card](https://huggingface.co/fdtn-ai/antares-1b)). Every advisory was published after that (earliest **2026-06-23**), and 34 of 35 fixes were committed after it (earliest 2026-03-01; dates from `npm run bench:antares:fixdates`). One fix predates the cutoff despite a recent advisory — [GHSA-v8fg-2rw7-q452](https://github.com/advisories/GHSA-v8fg-2rw7-q452) (CWE-89, fixed 2024-10-02) — so the model may have seen it. The table below leaves it out; the other tables include it.

### Only fixes committed after 2025-04-10 (34 cases)

| Arm | Cases | Runs | Hit@1 <sub>95% CI</sub> | Hit@3 <sub>95% CI</sub> | File F1 | Recall | Precision | No answer | Incomplete / failed | Median time | Median tool calls |
|-----|------:|-----:|------:|------:|--------:|-------:|----------:|----------:|--------------------:|------------:|------------------:|
| ZERODAY rules | 34 | 34 | **15%** <sub>3–26</sub> | **21%** <sub>9–35</sub> | 0.138 <sub>0.05–0.25</sub> | 22% | 23% | 16 | 0 | 1.8s | — |
| Antares-1B alone | 34 | 102 | **25%** <sub>16–36</sub> | **31%** <sub>21–43</sub> | 0.242 <sub>0.15–0.35</sub> | 29% | 24% | 2 | 2 | 42s | 30 |
| Antares-1B `--samples 2` (live) | 34 | 102 | **27%** <sub>16–41</sub> | **35%** <sub>23–49</sub> | 0.195 <sub>0.11–0.29</sub> | 33% | 18% | 0 | 0 | 73.2s | 56 |
| Antares-1B + ZERODAY context (context sent in 36 of 68 runs) | 34 | 68 | **19%** <sub>9–31</sub> | **22%** <sub>10–35</sub> | 0.165 <sub>0.07–0.27</sub> | 18% | 18% | 0 | 0 | 44.9s | 30 |

The vulnerable code itself may predate the cutoff; the label saying where the flaw is does not.

## Compared with the model card

The model card reports **File F1 0.209** for Antares-1B on VLoc Bench (500 tasks, 147 CWEs, 15 terminal calls, mean of 3 runs). Here a single Antares-1B run scores **0.242** (95% CI 0.15–0.34), computed the same way per run (no answer scores 0) and averaged. The model card's figure is inside that interval: **no measurable difference** — read it as consistent with the card, not better. The setups differ: 35 hand-picked recent advisories across 12 CWEs, ZERODAY's default budget of 30 tool calls (not 15), and ground truth limited to modified source files. Hit@1 / Hit@3 answer the question a reviewer asks — *is the file I read first the right one?* — and every interval here is a bootstrap over cases.

## CWEs the rules engine covers (89, 79, 22, 78, 94, 502, 918, 601)

| Arm | Cases | Runs | Hit@1 <sub>95% CI</sub> | Hit@3 <sub>95% CI</sub> | File F1 | Recall | Precision | No answer | Incomplete / failed | Median time | Median tool calls |
|-----|------:|-----:|------:|------:|--------:|-------:|----------:|----------:|--------------------:|------------:|------------------:|
| ZERODAY rules | 23 | 23 | **22%** <sub>4–39</sub> | **30%** <sub>13–48</sub> | 0.205 <sub>0.07–0.36</sub> | 32% | 22% | 4 | 0 | 6.3s | — |
| Antares-1B alone | 23 | 69 | **32%** <sub>17–46</sub> | **36%** <sub>22–52</sub> | 0.279 <sub>0.15–0.42</sub> | 31% | 29% | 1 | 1 | 42.2s | 30 |
| Antares-1B `--samples 2` (live) | 23 | 69 | **35%** <sub>20–51</sub> | **42%** <sub>26–59</sub> | 0.225 <sub>0.12–0.35</sub> | 36% | 21% | 0 | 0 | 72.6s | 55 |
| Antares-1B + ZERODAY context (context sent in 38 of 46 runs) | 23 | 46 | **26%** <sub>13–41</sub> | **28%** <sub>13–46</sub> | 0.208 <sub>0.09–0.34</sub> | 21% | 24% | 0 | 0 | 43s | 30 |
| Antares-1B alone, its runs 1 and 2 merged afterwards (replay of `--samples 2`) | 23 | 2 per case | **26%** | **48%** | — | 40% | — | — | — | — | — |
| Rules + Antares-1B (one run), both lists side by side | 23 | 69 | — | **54%** (top 3 of either, up to 6 files) | — | 47% (union) | — | — | — | — | — |

## CWEs only a model can attempt (862 missing authorization, 287 authentication, 1333 ReDoS, 1321 prototype pollution)

| Arm | Cases | Runs | Hit@1 <sub>95% CI</sub> | Hit@3 <sub>95% CI</sub> | File F1 | Recall | Precision | No answer | Incomplete / failed | Median time | Median tool calls |
|-----|------:|-----:|------:|------:|--------:|-------:|----------:|----------:|--------------------:|------------:|------------------:|
| ZERODAY rules | 12 | 12 | **0%** <sub>0–0</sub> | **0%** <sub>0–0</sub> | 0.000 <sub>0.00–0.00</sub> | 0% | — | 12 | 0 | 0.5s | — |
| Antares-1B alone | 12 | 36 | **14%** <sub>6–22</sub> | **22%** <sub>8–36</sub> | 0.170 <sub>0.08–0.26</sub> | 25% | 15% | 1 | 1 | 41.5s | 29 |
| Antares-1B `--samples 2` (live) | 12 | 36 | **17%** <sub>0–36</sub> | **25%** <sub>8–44</sub> | 0.140 <sub>0.04–0.27</sub> | 28% | 10% | 0 | 0 | 73.3s | 57.5 |
| Antares-1B + ZERODAY context (context sent in 0 of 24 runs) | 12 | 24 | **8%** <sub>0–21</sub> | **13%** <sub>0–29</sub> | 0.095 <sub>0.00–0.23</sub> | 13% | 9% | 0 | 0 | 47.7s | 32.5 |
| Antares-1B alone, its runs 1 and 2 merged afterwards (replay of `--samples 2`) | 12 | 2 per case | **17%** | **50%** | — | 58% | — | — | — | — | — |
| Rules + Antares-1B (one run), both lists side by side | 12 | 36 | — | **22%** (top 3 of either, up to 6 files) | — | 25% (union) | — | — | — | — | — |

## All cases

| Arm | Cases | Runs | Hit@1 <sub>95% CI</sub> | Hit@3 <sub>95% CI</sub> | File F1 | Recall | Precision | No answer | Incomplete / failed | Median time | Median tool calls |
|-----|------:|-----:|------:|------:|--------:|-------:|----------:|----------:|--------------------:|------------:|------------------:|
| ZERODAY rules | 35 | 35 | **14%** <sub>3–26</sub> | **20%** <sub>9–34</sub> | 0.134 <sub>0.05–0.24</sub> | 21% | 22% | 16 | 0 | 1.9s | — |
| Antares-1B alone | 35 | 105 | **26%** <sub>16–36</sub> | **31%** <sub>21–43</sub> | 0.242 <sub>0.15–0.34</sub> | 29% | 24% | 2 | 2 | 42.1s | 30 |
| Antares-1B `--samples 2` (live) | 35 | 105 | **29%** <sub>17–41</sub> | **36%** <sub>24–49</sub> | 0.196 <sub>0.12–0.29</sub> | 33% | 18% | 0 | 0 | 73.1s | 56 |
| Antares-1B + ZERODAY context (context sent in 38 of 70 runs) | 35 | 70 | **20%** <sub>10–31</sub> | **23%** <sub>11–36</sub> | 0.169 <sub>0.08–0.27</sub> | 18% | 19% | 0 | 0 | 45.5s | 30 |
| Antares-1B alone, its runs 1 and 2 merged afterwards (replay of `--samples 2`) | 35 | 2 per case | **23%** | **49%** | — | 46% | — | — | — | — | — |
| Rules + Antares-1B (one run), both lists side by side | 35 | 105 | — | **43%** (top 3 of either, up to 6 files) | — | 39% (union) | — | — | — | — | — |

## Paired differences

Each comparison uses the cases both arms ran, takes the per-case difference (a case's repeated runs averaged first) and bootstraps over cases. **Bold** means the 95% interval excludes zero. With this many comparisons, one or two may cross zero by chance.

| Comparison | Cases | Group | Hit@1 difference <sub>95% CI</sub> | Hit@3 difference <sub>95% CI</sub> |
|---|---:|---|---:|---:|
| Antares-1B (one run) − rules | 35 | all | +11 <sub>−2 to +25</sub> | +11 <sub>−5 to +27</sub> |
| Antares-1B (one run) − rules | 23 | rules cover | +10 <sub>−10 to +30</sub> | +6 <sub>−17 to +29</sub> |
| Antares-1B (one run) − rules | 12 | model only | **+14** <sub>+6 to +22</sub> | **+22** <sub>+8 to +36</sub> |
| `--samples 2` − one run | 35 | all | +3 <sub>−6 to +11</sub> | +5 <sub>−4 to +13</sub> |
| `--samples 2` − one run | 23 | rules cover | +3 <sub>−7 to +13</sub> | +6 <sub>−4 to +16</sub> |
| `--samples 2` − one run | 12 | model only | +3 <sub>−14 to +19</sub> | +3 <sub>−11 to +17</sub> |
| + context − Antares alone | 35 | all | −6 <sub>−15 to +1</sub> | −9 <sub>−19 to +0</sub> |
| + context − Antares alone | 23 | rules cover | −6 <sub>−18 to +4</sub> | −8 <sub>−21 to +4</sub> |
| + context − Antares alone | 12 | model only | −6 <sub>−15 to +4</sub> | −10 <sub>−25 to +4</sub> |

## Per case

| Case | CWE | Repository | Fixed file(s) | ZERODAY rules | Antares-1B alone | Antares-1B `--samples 2` (live) | Antares-1B + ZERODAY context |
|------|-----|------------|---------------|---|---|---|---|
| [GHSA-q2vg-7qgx-x5fc](https://github.com/advisories/GHSA-q2vg-7qgx-x5fc) | CWE-89 | siyuan-note/siyuan | `backlink.go` | miss | miss / miss / miss | miss / miss / miss | miss / miss |
| [GHSA-p6gw-4frg-j7jw](https://github.com/advisories/GHSA-p6gw-4frg-j7jw) | CWE-89 | mar10/wsgidav | `mysql_dav_provider.py` | **#1** | **#1** / **#1** / **#1** | **#1** / **#1** / **#1** | **#1** / **#1** |
| [GHSA-v8fg-2rw7-q452](https://github.com/advisories/GHSA-v8fg-2rw7-q452) | CWE-89 | sequelize/sequelize | `connection-manager.js`, `sql-string.js` | miss | miss / miss / **#1** | **#1** / ranked / **#1** | **#1** / miss |
| [GHSA-6rf4-v2fh-m6p4](https://github.com/advisories/GHSA-6rf4-v2fh-m6p4) | CWE-79 | JiHong88/suneditor | `core.js` | **#1** | miss / miss / miss | **#1** / miss / top-3 | miss / miss |
| [GHSA-xpjq-3w4w-w5wr](https://github.com/advisories/GHSA-xpjq-3w4w-w5wr) | CWE-79 | HKUDS/LightRAG | `ChatMessage.tsx` | **#1** | **#1** / top-3 / miss | miss / miss / **#1** | miss / **#1** |
| [GHSA-3rm2-h79c-8qw6](https://github.com/advisories/GHSA-3rm2-h79c-8qw6) | CWE-79 | imzbf/md-editor-v3 | `useCopyCode.ts`, `useMarkdownIt.ts`, `index.ts` | top-3 | miss / miss / miss | miss / miss / miss | miss / miss |
| [GHSA-g28h-2cmm-rj9x](https://github.com/advisories/GHSA-g28h-2cmm-rj9x) | CWE-22 | langchain-ai/langchain-nvidia | `_utils.py`, `chat_models.py`, `reranking.py` | none | miss / **#1** / **#1** | **#1** / **#1** / **#1** | **#1** / **#1** |
| [GHSA-vr5f-w35q-98jp](https://github.com/advisories/GHSA-vr5f-w35q-98jp) | CWE-22 | perses/perses | `list.go` | miss | miss / miss / miss | miss / miss / miss | miss / miss |
| [GHSA-cv3r-c5h8-f4g5](https://github.com/advisories/GHSA-cv3r-c5h8-f4g5) | CWE-22 | zereight/gitlab-mcp | `index.ts` | **#1** | miss / miss / **#1** | **#1** / **#1** / miss | **#1** / miss |
| [GHSA-jpf4-98qj-qr67](https://github.com/advisories/GHSA-jpf4-98qj-qr67) | CWE-78 | projectdiscovery/nuclei | `loader.go` | miss | miss / miss / miss | miss / miss / miss | miss / miss |
| [GHSA-q69g-4hcv-6jg4](https://github.com/advisories/GHSA-q69g-4hcv-6jg4) | CWE-78 | CycloneDX/cyclonedx-node-npm | `npmRunner.ts` | miss | **#1** / **#1** / **#1** | **#1** / **#1** / **#1** | **#1** / **#1** |
| [GHSA-4x45-gxvp-6283](https://github.com/advisories/GHSA-4x45-gxvp-6283) | CWE-78 | argos-ci/argos-javascript | `git.ts` | **#1** | miss / **#1** / **#1** | **#1** / **#1** / **#1** | miss / miss |
| [GHSA-756x-9hf6-q4h4](https://github.com/advisories/GHSA-756x-9hf6-q4h4) | CWE-94 | omnigent-ai/omnigent | `bundles.py` | none | miss / miss / miss | miss / miss / miss | miss / miss |
| [GHSA-mw6r-2hvm-4rp2](https://github.com/advisories/GHSA-mw6r-2hvm-4rp2) | CWE-94 | QWED-AI/qwed-mcp | `math_engine.py` | none | miss / miss / miss | miss / miss / miss | miss / miss |
| [GHSA-3496-9g83-7v6x](https://github.com/advisories/GHSA-3496-9g83-7v6x) | CWE-94 | andialbrecht/sqlparse | `output.py` | none | top-3 / top-3 / none | top-3 / miss / miss | miss / miss |
| [GHSA-2vh9-42vm-xmv2](https://github.com/advisories/GHSA-2vh9-42vm-xmv2) | CWE-502 | InternLM/lmdeploy | `engine_conn.py` | miss | miss / miss / miss | miss / miss / miss | miss / miss |
| [GHSA-rhp5-r9x4-f5g2](https://github.com/advisories/GHSA-rhp5-r9x4-f5g2) | CWE-502 | nltk/nltk | `transitionparser.py`, `picklesec.py`, `punkt.py` | miss | **#1** / miss / **#1** | **#1** / top-3 / **#1** | top-3 / **#1** |
| [GHSA-h7vf-4x9w-h99v](https://github.com/advisories/GHSA-h7vf-4x9w-h99v) | CWE-918 | oras-project/oras-go | `utils.go` | miss | miss / miss / miss | miss / miss / miss | miss / miss |
| [GHSA-p2w3-6x73-2f6x](https://github.com/advisories/GHSA-p2w3-6x73-2f6x) | CWE-918 | amir20/dozzle | `webhook.go` | miss | **#1** / **#1** / **#1** | **#1** / top-3 / **#1** | miss / miss |
| [GHSA-998g-7v5w-cr7g](https://github.com/advisories/GHSA-998g-7v5w-cr7g) | CWE-918 | MagicMirrorOrg/MagicMirror | `ip_access_control.js`, `server.js` | miss | miss / **#1** / miss | miss / miss / miss | miss / miss |
| [GHSA-h5g6-xmh4-hc37](https://github.com/advisories/GHSA-h5g6-xmh4-hc37) | CWE-601 | openrundev/openrun | `handler.go` | top-3 | miss / **#1** / miss | **#1** / miss / miss | **#1** / miss |
| [GHSA-8w27-c4vc-88q9](https://github.com/advisories/GHSA-8w27-c4vc-88q9) | CWE-601 | concourse/concourse | `skyserver.go` | ranked | **#1** / miss / **#1** | top-3 / miss / miss | **#1** / miss |
| [GHSA-xxhq-69mf-w8cr](https://github.com/advisories/GHSA-xxhq-69mf-w8cr) | CWE-601 | gogs/gogs | `urlx.go` | miss | miss / miss / miss | miss / miss / **#1** | miss / miss |
| [GHSA-89vx-jh4q-vg3w](https://github.com/advisories/GHSA-89vx-jh4q-vg3w) | CWE-862 | deepstreamIO/deepstream.io | `rules-map.ts` | none | miss / **#1** / miss | miss / miss / miss | miss / miss |
| [GHSA-w89x-c962-c44g](https://github.com/advisories/GHSA-w89x-c962-c44g) | CWE-862 | cloudreve/cloudreve | `router.go` | none | top-3 / top-3 / miss | **#1** / miss / miss | miss / miss |
| [GHSA-4h97-p9wq-chqj](https://github.com/advisories/GHSA-4h97-p9wq-chqj) | CWE-862 | Netflix/lemur | `views.py` | none | miss / miss / miss | miss / top-3 / miss | miss / miss |
| [GHSA-vq6g-g6c7-5f2j](https://github.com/advisories/GHSA-vq6g-g6c7-5f2j) | CWE-287 | python-social-auth/social-core | `saml.py` | none | **#1** / miss / miss | miss / miss / ranked | miss / miss |
| [GHSA-v667-gc2r-2xm7](https://github.com/advisories/GHSA-v667-gc2r-2xm7) | CWE-287 | whyour/qinglong | `express.ts` | none | ranked / miss / miss | miss / top-3 / miss | miss / miss |
| [GHSA-6765-c87h-8mrf](https://github.com/advisories/GHSA-6765-c87h-8mrf) | CWE-287 | traefik/traefik | `basic_auth.go` | none | **#1** / miss / none | **#1** / **#1** / miss | miss / miss |
| [GHSA-jx63-h26r-8cph](https://github.com/advisories/GHSA-jx63-h26r-8cph) | CWE-1333 | Sync-in/server | `sync-operations.dto.ts`, `functions.ts` | none | miss / miss / miss | miss / miss / miss | miss / miss |
| [GHSA-29g2-3rmr-qm68](https://github.com/advisories/GHSA-29g2-3rmr-qm68) | CWE-1333 | sveltejs/kit | `http.js` | none | miss / miss / miss | miss / miss / miss | miss / miss |
| [GHSA-8j4g-w8fx-2239](https://github.com/advisories/GHSA-8j4g-w8fx-2239) | CWE-1333 | honojs/hono | `index.ts` | none | miss / miss / miss | miss / miss / miss | miss / miss |
| [GHSA-8cw4-87c7-c6xx](https://github.com/advisories/GHSA-8cw4-87c7-c6xx) | CWE-1321 | adaltas/node-csv | `index.js` | none | **#1** / miss / top-3 | **#1** / **#1** / **#1** | **#1** / top-3 |
| [GHSA-vmg4-6gfg-83qx](https://github.com/advisories/GHSA-vmg4-6gfg-83qx) | CWE-1321 | apostrophecms/apostrophe | `index.js` | none | miss / **#1** / miss | miss / top-3 / miss | miss / **#1** |
| [GHSA-3rrr-jr9j-h3q3](https://github.com/advisories/GHSA-3rrr-jr9j-h3q3) | CWE-1321 | mermaid-js/mermaid | `architectureDb.ts`, `architectureRenderer.ts`, `architectureTypes.ts` | none | miss / miss / miss | miss / miss / miss | miss / miss |

**Hit@1** — a fixed file ranked first. **Hit@3** — in the top three (small numbers: 95% interval, bootstrap over cases). **File F1** — per-run harmonic mean of precision and recall, averaged (as on the model card). **Recall** — share of fixed files ranked anywhere. **Precision** — share of ranked files that were fixed (runs that ranked something). **No answer** — ran, ranked nothing. Per-case cells: **#1**, top-3, ranked (lower), miss (ranked only other files), none (ranked nothing).

### Limits

- Ground truth is what the fix changed; a fix can touch a file that is not where the flaw is, and a flaw can span files the fix left alone.
- 35 cases is a small sample: one case moves Hit@1 by ~3 points overall. Use the paired differences, not overlapping intervals, to compare arms, and expect one or two of the ~18 comparisons to look significant by chance.
- **Curation favours the rules.** Cases were chosen as the 3 newest advisories for 12 hand-picked CWEs, with 1–3 changed source files and 30–3000 files in the repository, in JavaScript/TypeScript, Python, Java and Go — the languages the rules engine reads. 8 of the 12 CWEs are ones the rules cover, so the "all cases" rows lean towards them.
- The derived rows reuse recorded runs: "merged afterwards" replays two Antares-alone runs through the `--samples 2` vote; it differs from the live `--samples 2` arm because live runs are separate draws. "Both lists side by side" counts the top 3 of either list (up to 6 files) and the recall of their union.
- "Context sent" counts for the hybrid arm are inferred from the rules run on the same case (older runs did not record them).
- Training-data overlap: see above (model data cutoff 2025-04-10; fix-commit dates in `cases.json`).
- Localization is not proof of exploitability. No exploit code is generated or run.
