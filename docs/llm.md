# LLM Providers

> Keyless default plus optional local/cloud providers.

[Open in app](http://localhost:3333/docs/llm)

Default provider is keyless — the War Room uses a local heuristic planner so it works offline. Your Cursor/Claude session remains the primary intelligence when you drive the system.

## Optional providers (Settings or env)

- Ollama / LM Studio / vLLM (OpenAI-compatible)
- OpenRouter, Anthropic, OpenAI
- Custom base URL via ZERODAY_LLM_BASE_URL

```bash
# .env.local (never commit secrets)
OLLAMA_HOST=http://127.0.0.1:11434
ZERODAY_LOCAL_MODEL=llama3
# OPENROUTER_API_KEY=
# ANTHROPIC_API_KEY=
# OPENAI_API_KEY=
```

> **Evidence hygiene:** API keys are never written into the Evidence Vault. Copy .env.example → .env.local as needed.
