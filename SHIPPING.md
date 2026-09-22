# SHIPPING.md — ZeroDay factory contract

Adapted from Lauren (@poteto) / Cursor Compile shipping model for this repo.
Goal: trustworthy high-volume shipping, not chatty code dumps.

## Roles

| Role | Who | Job |
|------|-----|-----|
| Outer loop | GRAX + ZeroDay desk agent | Farm context, pick work, launch small verifiable tasks, demand evidence |
| Inner loop | Cursor cloud agents / repo workers | Implement → verify → open tight PR |
| Gardener | Abhinav | Product owner; yes/no on merges; keeps the paved path honest |

## Four pillars

1. **Trust** — Prefer runtime evidence over “it compiled.”
2. **Cheap trust** — Verification, skills, agent-friendly layout.
3. **Repo as memory** — Durable knowledge lives in the tree (tests, lints, `SKILL.md`, feature maps), not in prompts.
4. **Close the loop** — Intake → reproduce → patch → verify → PR → harden environment on repeat mistakes.

## Correction ladder (strongest → weakest)

When an agent repeats a mistake, change the environment — do not only re-prompt:

1. Architecture / directory / import boundaries
2. Static analysis, typecheck, CI
3. Rules / BugBot / agentic review
4. Skills / `SKILL.md`
5. Extra prompt text (last resort; drifts)

## Outer-loop contract (every task)

1. Collect a bug, complaint, idea, or metric.
2. Restate the goal and success criteria in one short block.
3. Check existing tests, skills, and paved paths first.
4. Launch one small, verifiable, mergeable inner-loop task.
5. Demand evidence: tests, CLI/runtime traces, screenshots, blast-radius notes.
6. After a repeated correction, add a test, lint, or skill in the same PR series.
7. Prefer a tight PR over a large prose answer.

## Explicit do-not

- Do not add comments so agents can skip thinking.
- Do not leave humans as the only verifier.
- Do not leave bad patterns assuming “the agent will remember.”
- Do not confuse PR count with product quality.
- Do not invent accuracy / AUROC / public claims — measured only.
- Do not merge without Abhinav’s explicit yes (GRAX steers; holds drafts until then).

## ZeroDay-specific paved path

- Defensive only: local vuln localization, SARIF, CI gate, human review.
- Prefer small stacked PRs over giant feature dumps.
- CI green (or explicitly deferred with reason) before merge ask.
- Desk / prove-doors / evidence-pack changes must keep stranger-path honesty.
- HF Antares weights stay gated; no silent GPU claims without measured evidence.

## Inner-loop checklist (PR body)

- [ ] Goal + success criteria restated
- [ ] Tests or runtime evidence attached / cited
- [ ] Blast radius noted (what else could break)
- [ ] Repeat mistakes turned into test/lint/skill when applicable
- [ ] No unverified public accuracy claims

## Factory intake sources (when wired)

Slack / X / Sentry / Datadog / Desk findings → goal for cloud agent → reproduce → patch → verify → PR.

Volume works only after verification is real.
