# FAQ

## Is the default path keyless?

Yes. `zeroday operate` uses the coding agent already running the tool. No Antares HF token, no vendor API keys, no cloud inference of customer source.

## Do I need Antares weights?

Only for optional `zeroday locate --live --endpoint …` on an operator workstation that already hosts `fdtn-ai/antares-1b` via completions. CI never downloads `model.safetensors`.

## Is localization exploitability?

No. Findings are detector-lane **candidates**. Human review required. No auto-merge.

## Does ZERODAY push to Splunk / XSOAR / Security Hub?

No. Local files only. Your team owns ingest and credentials.

## Are you a Cisco / Splunk partner product?

No. Sister tools: Antares, Foundry Security Spec, Project CodeGuard — compose, don’t replace.

## Can I get a PoC?

No. If asked for fix + PoC: patch draft only (with `--i-asked-for-a-fix`), refuse PoC in one sentence.
