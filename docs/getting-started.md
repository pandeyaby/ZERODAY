# Getting Started

> Install, open the War Room, run your first mission in five minutes.

[Open in app](http://localhost:3333/docs/getting-started)

## 1. Install & run

```bash
npm install
npm run dev
# War Room → http://localhost:3333
```

## 2. First mission (UI)

1. Open http://localhost:3333 — example missions are seeded automatically.
2. Pick “Cisco DNA + Splunk Staging Kill Chain” (or Palo/Fortinet / Falcon+AWS).
3. Enter your name and click Acknowledge Authorization (required).
4. Click Start (or press s).
5. Watch Live Operators, then open Evidence Vault → Findings → Retest Queue.

## 3. Natural-language launch

In the left Mission Queue, paste a brief such as:

```
Assess Palo Alto Panorama and Fortinet FortiGate staging edge policies and VPN
```

ZERODAY detects loadouts from the brief, invents scoped lab targets, and waits for authorization before any tools run.

## Docker

```bash
docker compose up --build
# → http://localhost:3000
```

> **Keyless by default:** No API key required to explore. Optional Ollama / OpenRouter / Anthropic / OpenAI can be set under Settings.
