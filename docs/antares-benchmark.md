# Antares localization benchmark (real advisories)

36 published GitHub-reviewed advisories across 12 CWEs, one project each, newest first (published 2026-06-23 … 2026-09-24). Each repository is checked out at the **parent of the fix commit** (no history), every arm is given **only the CWE**, and a run scores a hit when a file the fix changed (tests excluded) is ranked. Cases: [`bench/antares/cases.json`](../bench/antares/cases.json) · curation: [`bench/antares/curate.py`](../bench/antares/curate.py) · runner: `npm run bench:antares`.

Model: `fdtn-ai/antares-1b` via `cisco-antares-cli`.

## What this shows

- **Antares reaches weaknesses the rules cannot model.** On missing authorization, authentication, ReDoS and prototype pollution the rules find nothing; Antares-1B finds the fixed file in some of them (tables below).
- **Antares-1B varies from run to run**, so ZERODAY runs it twice and merges by vote (`--samples 2`, the default for `scan`). Run live on all 36 cases (1 pass each), it ranked the fixed file first in 36% (95% CI 19–53) of runs, against 25% (95% CI 15–36) for a single run. The intervals still overlap, so the gain is likely but not yet measured with confidence.
- **Rules and Antares complement each other** — the fixed file is more often in the top 3 of *either* list than of one. `scan` and `locate --live` show both, and mark where they agree.
- **Sending the rules findings to Antares as context did not help** (fewer hits and lower recall where context was sent), so it is off by default (`--context` opts in). Runs where the rules had nothing to send are identical to Antares alone; the gap on model-only CWEs is run-to-run variation, which shows how noisy single runs are.

## Training-data overlap

Antares-1B's training data ends **2025-04-10** ([model card](https://huggingface.co/fdtn-ai/antares-1b)). Every advisory was published after that (earliest **2026-06-23**), and 35 of 36 fixes were committed after it (earliest 2026-03-01; dates from `npm run bench:antares:fixdates`). One fix predates the cutoff despite a recent advisory — [GHSA-v8fg-2rw7-q452](https://github.com/advisories/GHSA-v8fg-2rw7-q452) (CWE-89, fixed 2024-10-02) — so the model may have seen it. The table below leaves it out; the other tables include it.

### Only fixes committed after 2025-04-10 (35 cases)

| Arm | Cases | Runs | Hit@1 <sub>95% CI</sub> | Hit@3 <sub>95% CI</sub> | File F1 | Recall | Precision | No answer | Incomplete / failed | Median time | Median tool calls |
|-----|------:|-----:|------:|------:|--------:|-------:|----------:|----------:|--------------------:|------------:|------------------:|
| ZERODAY rules | 35 | 35 | **14%** <sub>3–26</sub> | **20%** <sub>9–34</sub> | 0.125 | 20% | 23% | 17 | 0 | 1.9s | — |
| Antares-1B alone | 35 | 70 | **26%** <sub>16–36</sub> | **33%** <sub>20–44</sub> | 0.246 | 30% | 24% | 1 | 1 | 43.2s | 30 |
| Antares-1B `--samples 2` (live) | 35 | 35 | **34%** <sub>17–49</sub> | **40%** <sub>23–54</sub> | 0.227 | 36% | 20% | 0 | 0 | 58.4s | 55 |
| Antares-1B + ZERODAY context (context sent in 36 of 70 runs) | 35 | 70 | **19%** <sub>9–30</sub> | **21%** <sub>10–34</sub> | 0.155 | 17% | 17% | 0 | 0 | 44.4s | 30 |

The vulnerable code itself may predate the cutoff; the label saying where the flaw is does not.

## Compared with the model card

The model card reports **File F1 0.209** for Antares-1B on VLoc Bench (500 tasks, CWE description only, 15 terminal calls, mean of 3 runs). The File F1 column below is computed the same way per run (no answer scores 0) and averaged. The setups differ, so compare with care: this set is 36 recent advisories, the Antares CLI is given the CWE id, ZERODAY's default budget is 30 tool calls (not 15), and `--samples 2` merges two runs. Hit@1 / Hit@3 answer the question a reviewer asks — *is the file I read first the right one?* — and the 95% intervals are a bootstrap over cases.

## CWEs the rules engine covers (89, 79, 22, 78, 94, 502, 918, 601)

| Arm | Cases | Runs | Hit@1 <sub>95% CI</sub> | Hit@3 <sub>95% CI</sub> | File F1 | Recall | Precision | No answer | Incomplete / failed | Median time | Median tool calls |
|-----|------:|-----:|------:|------:|--------:|-------:|----------:|----------:|--------------------:|------------:|------------------:|
| ZERODAY rules | 24 | 24 | **21%** <sub>8–38</sub> | **29%** <sub>13–50</sub> | 0.182 | 28% | 22% | 5 | 0 | 6.3s | — |
| Antares-1B alone | 24 | 48 | **27%** <sub>15–44</sub> | **33%** <sub>19–52</sub> | 0.242 | 27% | 25% | 1 | 1 | 43.9s | 31 |
| Antares-1B `--samples 2` (live) | 24 | 24 | **42%** <sub>25–63</sub> | **50%** <sub>29–71</sub> | 0.262 | 42% | 24% | 0 | 0 | 60.2s | 55 |
| Antares-1B + ZERODAY context (context sent in 38 of 48 runs) | 24 | 48 | **25%** <sub>10–40</sub> | **27%** <sub>13–44</sub> | 0.193 | 19% | 23% | 0 | 0 | 42.7s | 30 |
| Antares-1B, 2 runs merged (`--samples 2`) | 24 | 48 | **25%** | **46%** | — | 36% | — | — | — | — | — |
| Rules + Antares-1B, both lists | 24 | 48 | — | **50%** (either) | — | 52% (either) | — | — | — | — | — |

## CWEs only a model can attempt (862 missing authorization, 287 authentication, 1333 ReDoS, 1321 prototype pollution)

| Arm | Cases | Runs | Hit@1 <sub>95% CI</sub> | Hit@3 <sub>95% CI</sub> | File F1 | Recall | Precision | No answer | Incomplete / failed | Median time | Median tool calls |
|-----|------:|-----:|------:|------:|--------:|-------:|----------:|----------:|--------------------:|------------:|------------------:|
| ZERODAY rules | 12 | 12 | **0%** <sub>0–0</sub> | **0%** <sub>0–0</sub> | 0.000 | 0% | — | 12 | 0 | 0.5s | — |
| Antares-1B alone | 12 | 24 | **21%** <sub>8–38</sub> | **29%** <sub>13–46</sub> | 0.234 | 33% | 21% | 0 | 0 | 42.3s | 30 |
| Antares-1B `--samples 2` (live) | 12 | 12 | **25%** <sub>0–50</sub> | **25%** <sub>0–50</sub> | 0.153 | 25% | 11% | 0 | 0 | 58.4s | 56 |
| Antares-1B + ZERODAY context (context sent in 0 of 24 runs) | 12 | 24 | **8%** <sub>0–21</sub> | **13%** <sub>0–29</sub> | 0.095 | 13% | 9% | 0 | 0 | 49.2s | 33 |
| Antares-1B, 2 runs merged (`--samples 2`) | 12 | 24 | **17%** | **50%** | — | 58% | — | — | — | — | — |
| Rules + Antares-1B, both lists | 12 | 24 | — | **29%** (either) | — | 33% (either) | — | — | — | — | — |

## All cases

| Arm | Cases | Runs | Hit@1 <sub>95% CI</sub> | Hit@3 <sub>95% CI</sub> | File F1 | Recall | Precision | No answer | Incomplete / failed | Median time | Median tool calls |
|-----|------:|-----:|------:|------:|--------:|-------:|----------:|----------:|--------------------:|------------:|------------------:|
| ZERODAY rules | 36 | 36 | **14%** <sub>6–25</sub> | **19%** <sub>8–33</sub> | 0.121 | 19% | 22% | 17 | 0 | 1.9s | — |
| Antares-1B alone | 36 | 72 | **25%** <sub>15–36</sub> | **32%** <sub>21–46</sub> | 0.239 | 29% | 23% | 1 | 1 | 43.2s | 30 |
| Antares-1B `--samples 2` (live) | 36 | 36 | **36%** <sub>19–53</sub> | **42%** <sub>25–58</sub> | 0.226 | 37% | 20% | 0 | 0 | 58.4s | 55 |
| Antares-1B + ZERODAY context (context sent in 38 of 72 runs) | 36 | 72 | **19%** <sub>10–31</sub> | **22%** <sub>11–36</sub> | 0.160 | 17% | 18% | 0 | 0 | 45.4s | 30 |
| Antares-1B, 2 runs merged (`--samples 2`) | 36 | 72 | **22%** | **47%** | — | 44% | — | — | — | — | — |
| Rules + Antares-1B, both lists | 36 | 72 | — | **43%** (either) | — | 46% (either) | — | — | — | — | — |

## Per case

| Case | CWE | Repository | Fixed file(s) | ZERODAY rules | Antares-1B alone | Antares-1B `--samples 2` (live) | Antares-1B + ZERODAY context |
|------|-----|------------|---------------|---|---|---|---|
| [GHSA-q2vg-7qgx-x5fc](https://github.com/advisories/GHSA-q2vg-7qgx-x5fc) | CWE-89 | siyuan-note/siyuan | `backlink.go` | miss | miss / miss | miss | miss / miss |
| [GHSA-p6gw-4frg-j7jw](https://github.com/advisories/GHSA-p6gw-4frg-j7jw) | CWE-89 | mar10/wsgidav | `mysql_dav_provider.py` | **#1** | **#1** / **#1** | **#1** | **#1** / **#1** |
| [GHSA-v8fg-2rw7-q452](https://github.com/advisories/GHSA-v8fg-2rw7-q452) | CWE-89 | sequelize/sequelize | `connection-manager.js`, `sql-string.js` | miss | miss / miss | **#1** | **#1** / miss |
| [GHSA-6rf4-v2fh-m6p4](https://github.com/advisories/GHSA-6rf4-v2fh-m6p4) | CWE-79 | JiHong88/suneditor | `core.js` | **#1** | miss / miss | **#1** | miss / miss |
| [GHSA-xpjq-3w4w-w5wr](https://github.com/advisories/GHSA-xpjq-3w4w-w5wr) | CWE-79 | HKUDS/LightRAG | `ChatMessage.tsx`, `markdownSanitizeSchema.ts` | **#1** | **#1** / top-3 | miss | miss / **#1** |
| [GHSA-3rm2-h79c-8qw6](https://github.com/advisories/GHSA-3rm2-h79c-8qw6) | CWE-79 | imzbf/md-editor-v3 | `useCopyCode.ts`, `useMarkdownIt.ts`, `index.ts` | top-3 | miss / miss | miss | miss / miss |
| [GHSA-g28h-2cmm-rj9x](https://github.com/advisories/GHSA-g28h-2cmm-rj9x) | CWE-22 | langchain-ai/langchain-nvidia | `_utils.py`, `chat_models.py`, `reranking.py` | none | miss / **#1** | **#1** | **#1** / **#1** |
| [GHSA-vr5f-w35q-98jp](https://github.com/advisories/GHSA-vr5f-w35q-98jp) | CWE-22 | perses/perses | `list.go` | miss | miss / miss | miss | miss / miss |
| [GHSA-cv3r-c5h8-f4g5](https://github.com/advisories/GHSA-cv3r-c5h8-f4g5) | CWE-22 | zereight/gitlab-mcp | `index.ts` | **#1** | miss / miss | **#1** | **#1** / miss |
| [GHSA-jpf4-98qj-qr67](https://github.com/advisories/GHSA-jpf4-98qj-qr67) | CWE-78 | projectdiscovery/nuclei | `loader.go` | miss | miss / miss | miss | miss / miss |
| [GHSA-q69g-4hcv-6jg4](https://github.com/advisories/GHSA-q69g-4hcv-6jg4) | CWE-78 | CycloneDX/cyclonedx-node-npm | `npmRunner.ts` | miss | **#1** / **#1** | **#1** | **#1** / **#1** |
| [GHSA-4x45-gxvp-6283](https://github.com/advisories/GHSA-4x45-gxvp-6283) | CWE-78 | argos-ci/argos-javascript | `git.ts` | **#1** | miss / **#1** | **#1** | miss / miss |
| [GHSA-756x-9hf6-q4h4](https://github.com/advisories/GHSA-756x-9hf6-q4h4) | CWE-94 | omnigent-ai/omnigent | `bundles.py` | none | miss / miss | miss | miss / miss |
| [GHSA-mw6r-2hvm-4rp2](https://github.com/advisories/GHSA-mw6r-2hvm-4rp2) | CWE-94 | QWED-AI/qwed-mcp | `math_engine.py`, `safe_parser.py` | none | miss / miss | miss | miss / miss |
| [GHSA-3496-9g83-7v6x](https://github.com/advisories/GHSA-3496-9g83-7v6x) | CWE-94 | andialbrecht/sqlparse | `output.py` | none | top-3 / top-3 | top-3 | miss / miss |
| [GHSA-2vh9-42vm-xmv2](https://github.com/advisories/GHSA-2vh9-42vm-xmv2) | CWE-502 | InternLM/lmdeploy | `engine_conn.py` | miss | miss / miss | miss | miss / miss |
| [GHSA-rhp5-r9x4-f5g2](https://github.com/advisories/GHSA-rhp5-r9x4-f5g2) | CWE-502 | nltk/nltk | `transitionparser.py`, `picklesec.py`, `punkt.py` | miss | **#1** / miss | **#1** | top-3 / **#1** |
| [GHSA-w6w4-rjh9-9r58](https://github.com/advisories/GHSA-w6w4-rjh9-9r58) | CWE-502 | swaldman/c3p0 | `C3P0BeanInfoGen.java` | none | miss / none | miss | miss / miss |
| [GHSA-h7vf-4x9w-h99v](https://github.com/advisories/GHSA-h7vf-4x9w-h99v) | CWE-918 | oras-project/oras-go | `utils.go` | miss | miss / miss | miss | miss / miss |
| [GHSA-p2w3-6x73-2f6x](https://github.com/advisories/GHSA-p2w3-6x73-2f6x) | CWE-918 | amir20/dozzle | `webhook.go` | miss | **#1** / **#1** | **#1** | miss / miss |
| [GHSA-998g-7v5w-cr7g](https://github.com/advisories/GHSA-998g-7v5w-cr7g) | CWE-918 | MagicMirrorOrg/MagicMirror | `ip_access_control.js`, `server.js` | miss | miss / **#1** | miss | miss / miss |
| [GHSA-h5g6-xmh4-hc37](https://github.com/advisories/GHSA-h5g6-xmh4-hc37) | CWE-601 | openrundev/openrun | `handler.go` | top-3 | miss / **#1** | **#1** | **#1** / miss |
| [GHSA-8w27-c4vc-88q9](https://github.com/advisories/GHSA-8w27-c4vc-88q9) | CWE-601 | concourse/concourse | `skyserver.go` | ranked | **#1** / miss | top-3 | **#1** / miss |
| [GHSA-xxhq-69mf-w8cr](https://github.com/advisories/GHSA-xxhq-69mf-w8cr) | CWE-601 | gogs/gogs | `urlx.go` | miss | miss / miss | miss | miss / miss |
| [GHSA-89vx-jh4q-vg3w](https://github.com/advisories/GHSA-89vx-jh4q-vg3w) | CWE-862 | deepstreamIO/deepstream.io | `rules-map.ts` | none | miss / **#1** | miss | miss / miss |
| [GHSA-w89x-c962-c44g](https://github.com/advisories/GHSA-w89x-c962-c44g) | CWE-862 | cloudreve/cloudreve | `router.go` | none | top-3 / top-3 | **#1** | miss / miss |
| [GHSA-4h97-p9wq-chqj](https://github.com/advisories/GHSA-4h97-p9wq-chqj) | CWE-862 | Netflix/lemur | `views.py` | none | miss / miss | miss | miss / miss |
| [GHSA-vq6g-g6c7-5f2j](https://github.com/advisories/GHSA-vq6g-g6c7-5f2j) | CWE-287 | python-social-auth/social-core | `saml.py` | none | **#1** / miss | miss | miss / miss |
| [GHSA-v667-gc2r-2xm7](https://github.com/advisories/GHSA-v667-gc2r-2xm7) | CWE-287 | whyour/qinglong | `express.ts` | none | ranked / miss | miss | miss / miss |
| [GHSA-6765-c87h-8mrf](https://github.com/advisories/GHSA-6765-c87h-8mrf) | CWE-287 | traefik/traefik | `basic_auth.go` | none | **#1** / miss | **#1** | miss / miss |
| [GHSA-jx63-h26r-8cph](https://github.com/advisories/GHSA-jx63-h26r-8cph) | CWE-1333 | Sync-in/server | `sync-operations.dto.ts`, `functions.ts` | none | miss / miss | miss | miss / miss |
| [GHSA-29g2-3rmr-qm68](https://github.com/advisories/GHSA-29g2-3rmr-qm68) | CWE-1333 | sveltejs/kit | `http.js` | none | miss / miss | miss | miss / miss |
| [GHSA-8j4g-w8fx-2239](https://github.com/advisories/GHSA-8j4g-w8fx-2239) | CWE-1333 | honojs/hono | `index.ts` | none | miss / miss | miss | miss / miss |
| [GHSA-8cw4-87c7-c6xx](https://github.com/advisories/GHSA-8cw4-87c7-c6xx) | CWE-1321 | adaltas/node-csv | `index.js` | none | **#1** / miss | **#1** | **#1** / top-3 |
| [GHSA-vmg4-6gfg-83qx](https://github.com/advisories/GHSA-vmg4-6gfg-83qx) | CWE-1321 | apostrophecms/apostrophe | `index.js` | none | miss / **#1** | miss | miss / **#1** |
| [GHSA-3rrr-jr9j-h3q3](https://github.com/advisories/GHSA-3rrr-jr9j-h3q3) | CWE-1321 | mermaid-js/mermaid | `architectureDb.ts`, `architectureRenderer.ts`, `architectureTypes.ts` | none | miss / miss | miss | miss / miss |

**Hit@1** — a fixed file ranked first. **Hit@3** — in the top three (small numbers: 95% interval, bootstrap over cases). **File F1** — per-run harmonic mean of precision and recall, averaged (as on the model card). **Recall** — share of fixed files ranked anywhere. **Precision** — share of ranked files that were fixed (runs that ranked something). **No answer** — ran, ranked nothing. Per-case cells: **#1**, top-3, ranked (lower), miss (ranked only other files), none (ranked nothing).

### Limits

- Ground truth is what the fix changed; a fix can touch a file that is not where the flaw is, and a flaw can span files the fix left alone.
- 36 cases is a small sample: one case moves Hit@1 by ~3 points overall. The 95% intervals show how wide that is; overlapping intervals are not a measured difference.
- The two derived rows reuse the recorded runs: "2 runs merged" is the two Antares-alone passes merged by vote (what `--samples 2` does); "both lists" counts a hit when either the rules or that Antares run ranks a fixed file.
- Training-data overlap: see above (model data cutoff 2025-04-10; fix-commit dates in `cases.json`).
- Localization is not proof of exploitability. No exploit code is generated or run.
