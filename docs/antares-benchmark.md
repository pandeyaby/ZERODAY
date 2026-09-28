# Antares localization benchmark (real advisories)

36 published GitHub-reviewed advisories across 12 CWEs, one project each, newest first (published 2026-06-23 … 2026-09-24). Each repository is checked out at the **parent of the fix commit** (no history), every arm is given **only the CWE**, and a run scores a hit when a file the fix changed (tests excluded) is ranked. Cases: [`bench/antares/cases.json`](../bench/antares/cases.json) · curation: [`bench/antares/curate.py`](../bench/antares/curate.py) · runner: `npm run bench:antares`.


## CWEs the rules engine covers (89, 79, 22, 78, 94, 502, 918, 601)

| Arm | Cases | Runs | Hit@1 | Hit@3 | Recall | Precision | No answer | Incomplete / failed | Median time | Median tool calls |
|-----|------:|-----:|------:|------:|-------:|----------:|----------:|--------------------:|------------:|------------------:|
| ZERODAY rules | 24 | 24 | **21%** | **29%** | 28% | 22% | 5 | 0 | 6.3s | — |

## CWEs only a model can attempt (862 missing authorization, 287 authentication, 1333 ReDoS, 1321 prototype pollution)

| Arm | Cases | Runs | Hit@1 | Hit@3 | Recall | Precision | No answer | Incomplete / failed | Median time | Median tool calls |
|-----|------:|-----:|------:|------:|-------:|----------:|----------:|--------------------:|------------:|------------------:|
| ZERODAY rules | 12 | 12 | **0%** | **0%** | 0% | — | 12 | 0 | 0.5s | — |

## All cases

| Arm | Cases | Runs | Hit@1 | Hit@3 | Recall | Precision | No answer | Incomplete / failed | Median time | Median tool calls |
|-----|------:|-----:|------:|------:|-------:|----------:|----------:|--------------------:|------------:|------------------:|
| ZERODAY rules | 36 | 36 | **14%** | **19%** | 19% | 22% | 17 | 0 | 1.9s | — |

## Per case

| Case | CWE | Repository | Fixed file(s) | ZERODAY rules |
|------|-----|------------|---------------|---|
| [GHSA-q2vg-7qgx-x5fc](https://github.com/advisories/GHSA-q2vg-7qgx-x5fc) | CWE-89 | siyuan-note/siyuan | `backlink.go` | miss |
| [GHSA-p6gw-4frg-j7jw](https://github.com/advisories/GHSA-p6gw-4frg-j7jw) | CWE-89 | mar10/wsgidav | `mysql_dav_provider.py` | **#1** |
| [GHSA-v8fg-2rw7-q452](https://github.com/advisories/GHSA-v8fg-2rw7-q452) | CWE-89 | sequelize/sequelize | `connection-manager.js`, `sql-string.js` | miss |
| [GHSA-6rf4-v2fh-m6p4](https://github.com/advisories/GHSA-6rf4-v2fh-m6p4) | CWE-79 | JiHong88/suneditor | `core.js` | **#1** |
| [GHSA-xpjq-3w4w-w5wr](https://github.com/advisories/GHSA-xpjq-3w4w-w5wr) | CWE-79 | HKUDS/LightRAG | `ChatMessage.tsx`, `markdownSanitizeSchema.ts` | **#1** |
| [GHSA-3rm2-h79c-8qw6](https://github.com/advisories/GHSA-3rm2-h79c-8qw6) | CWE-79 | imzbf/md-editor-v3 | `useCopyCode.ts`, `useMarkdownIt.ts`, `index.ts` | top-3 |
| [GHSA-g28h-2cmm-rj9x](https://github.com/advisories/GHSA-g28h-2cmm-rj9x) | CWE-22 | langchain-ai/langchain-nvidia | `_utils.py`, `chat_models.py`, `reranking.py` | none |
| [GHSA-vr5f-w35q-98jp](https://github.com/advisories/GHSA-vr5f-w35q-98jp) | CWE-22 | perses/perses | `list.go` | miss |
| [GHSA-cv3r-c5h8-f4g5](https://github.com/advisories/GHSA-cv3r-c5h8-f4g5) | CWE-22 | zereight/gitlab-mcp | `index.ts` | **#1** |
| [GHSA-jpf4-98qj-qr67](https://github.com/advisories/GHSA-jpf4-98qj-qr67) | CWE-78 | projectdiscovery/nuclei | `loader.go` | miss |
| [GHSA-q69g-4hcv-6jg4](https://github.com/advisories/GHSA-q69g-4hcv-6jg4) | CWE-78 | CycloneDX/cyclonedx-node-npm | `npmRunner.ts` | miss |
| [GHSA-4x45-gxvp-6283](https://github.com/advisories/GHSA-4x45-gxvp-6283) | CWE-78 | argos-ci/argos-javascript | `git.ts` | **#1** |
| [GHSA-756x-9hf6-q4h4](https://github.com/advisories/GHSA-756x-9hf6-q4h4) | CWE-94 | omnigent-ai/omnigent | `bundles.py` | none |
| [GHSA-mw6r-2hvm-4rp2](https://github.com/advisories/GHSA-mw6r-2hvm-4rp2) | CWE-94 | QWED-AI/qwed-mcp | `math_engine.py`, `safe_parser.py` | none |
| [GHSA-3496-9g83-7v6x](https://github.com/advisories/GHSA-3496-9g83-7v6x) | CWE-94 | andialbrecht/sqlparse | `output.py` | none |
| [GHSA-2vh9-42vm-xmv2](https://github.com/advisories/GHSA-2vh9-42vm-xmv2) | CWE-502 | InternLM/lmdeploy | `engine_conn.py` | miss |
| [GHSA-rhp5-r9x4-f5g2](https://github.com/advisories/GHSA-rhp5-r9x4-f5g2) | CWE-502 | nltk/nltk | `transitionparser.py`, `picklesec.py`, `punkt.py` | miss |
| [GHSA-w6w4-rjh9-9r58](https://github.com/advisories/GHSA-w6w4-rjh9-9r58) | CWE-502 | swaldman/c3p0 | `C3P0BeanInfoGen.java` | none |
| [GHSA-h7vf-4x9w-h99v](https://github.com/advisories/GHSA-h7vf-4x9w-h99v) | CWE-918 | oras-project/oras-go | `utils.go` | miss |
| [GHSA-p2w3-6x73-2f6x](https://github.com/advisories/GHSA-p2w3-6x73-2f6x) | CWE-918 | amir20/dozzle | `webhook.go` | miss |
| [GHSA-998g-7v5w-cr7g](https://github.com/advisories/GHSA-998g-7v5w-cr7g) | CWE-918 | MagicMirrorOrg/MagicMirror | `ip_access_control.js`, `server.js` | miss |
| [GHSA-h5g6-xmh4-hc37](https://github.com/advisories/GHSA-h5g6-xmh4-hc37) | CWE-601 | openrundev/openrun | `handler.go` | top-3 |
| [GHSA-8w27-c4vc-88q9](https://github.com/advisories/GHSA-8w27-c4vc-88q9) | CWE-601 | concourse/concourse | `skyserver.go` | ranked |
| [GHSA-xxhq-69mf-w8cr](https://github.com/advisories/GHSA-xxhq-69mf-w8cr) | CWE-601 | gogs/gogs | `urlx.go` | miss |
| [GHSA-89vx-jh4q-vg3w](https://github.com/advisories/GHSA-89vx-jh4q-vg3w) | CWE-862 | deepstreamIO/deepstream.io | `rules-map.ts` | none |
| [GHSA-w89x-c962-c44g](https://github.com/advisories/GHSA-w89x-c962-c44g) | CWE-862 | cloudreve/cloudreve | `router.go` | none |
| [GHSA-4h97-p9wq-chqj](https://github.com/advisories/GHSA-4h97-p9wq-chqj) | CWE-862 | Netflix/lemur | `views.py` | none |
| [GHSA-vq6g-g6c7-5f2j](https://github.com/advisories/GHSA-vq6g-g6c7-5f2j) | CWE-287 | python-social-auth/social-core | `saml.py` | none |
| [GHSA-v667-gc2r-2xm7](https://github.com/advisories/GHSA-v667-gc2r-2xm7) | CWE-287 | whyour/qinglong | `express.ts` | none |
| [GHSA-6765-c87h-8mrf](https://github.com/advisories/GHSA-6765-c87h-8mrf) | CWE-287 | traefik/traefik | `basic_auth.go` | none |
| [GHSA-jx63-h26r-8cph](https://github.com/advisories/GHSA-jx63-h26r-8cph) | CWE-1333 | Sync-in/server | `sync-operations.dto.ts`, `functions.ts` | none |
| [GHSA-29g2-3rmr-qm68](https://github.com/advisories/GHSA-29g2-3rmr-qm68) | CWE-1333 | sveltejs/kit | `http.js` | none |
| [GHSA-8j4g-w8fx-2239](https://github.com/advisories/GHSA-8j4g-w8fx-2239) | CWE-1333 | honojs/hono | `index.ts` | none |
| [GHSA-8cw4-87c7-c6xx](https://github.com/advisories/GHSA-8cw4-87c7-c6xx) | CWE-1321 | adaltas/node-csv | `index.js` | none |
| [GHSA-vmg4-6gfg-83qx](https://github.com/advisories/GHSA-vmg4-6gfg-83qx) | CWE-1321 | apostrophecms/apostrophe | `index.js` | none |
| [GHSA-3rrr-jr9j-h3q3](https://github.com/advisories/GHSA-3rrr-jr9j-h3q3) | CWE-1321 | mermaid-js/mermaid | `architectureDb.ts`, `architectureRenderer.ts`, `architectureTypes.ts` | none |

**Hit@1** — a fixed file ranked first. **Hit@3** — in the top three. **Recall** — share of fixed files ranked anywhere. **Precision** — share of ranked files that were fixed (runs that ranked something). **No answer** — ran, ranked nothing. Per-case cells: **#1**, top-3, ranked (lower), miss (ranked only other files), none (ranked nothing).

### Limits

- Ground truth is what the fix changed; a fix can touch a file that is not where the flaw is, and a flaw can span files the fix left alone.
- 36 cases is a small sample: one case moves Hit@1 by ~4 points per group. Read differences under ~10 points as noise.
- Advisories are recent to limit overlap with model training data; that overlap cannot be ruled out.
- Localization is not proof of exploitability. No exploit code is generated or run.
