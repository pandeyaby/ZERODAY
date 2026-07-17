# FAQ & Troubleshooting

> Common questions and fixes.

[Open in app](http://localhost:3333/docs/faq)

## Port 3000 is busy

npm run dev binds to 3333 by design. Docker still exposes 3000 inside compose.

## Start is disabled

Acknowledge Authorization first. Missions cannot run without an acknowledged RoE.

## SCOPE DENIED

The tool target is outside mission targets. Edit scope or launch a brief that includes the right hosts/account IDs.

## RECEIPT REQUIRED

Spicy tools (SSH exec, RTR, config push, etc.) need approve_receipt via API before they run. Default kill-chain stays on safe_local.

## Where is data stored?

SQLite under data/ (or ZERODAY_DATA_DIR). JSON fallback if the native module is unavailable.
