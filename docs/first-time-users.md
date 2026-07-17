# First-Time Users

> Easy walkthrough for your first mission — click, watch, review.

[Open in app](http://localhost:3333/docs/first-time-users)

This guide assumes you can open a browser and run a couple of terminal commands. No security expertise required to complete the demo path.

## Start the app

```bash
npm install
npm run dev
# Open http://localhost:3333
```

## Run the easiest demo (5 minutes)

1. On the left, click “Cisco DNA + Splunk Staging Kill Chain” (or any seeded mission).
2. Type your name in the authorization box.
3. Click Acknowledge Authorization — Start stays locked until you do.
4. Click Start (or press the s key).
5. Open the Live Operators tab — you should see roles light up and an event stream.
6. When the run finishes (status may say awaiting_retest), open Findings Ledger.
7. Open Retest Queue and click Pass or Fail on any queued item.

> **Nothing “real” is being attacked:** Default tools run in safe_local simulation mode. They produce realistic lab evidence without needing live Cisco/Splunk credentials.

## Try a sentence instead of a preset

In the Mission Queue brief box, paste:

```
Assess Palo Alto Panorama and Fortinet FortiGate staging edge policies and VPN
```

Click Launch Mission, acknowledge authorization, then Start. ZERODAY picks the matching vendor loadouts for you.

## Useful buttons & keys

| Action | How |
| --- | --- |
| Switch tabs | Click a tab or press 1–9 |
| Open Docs | Docs tab (9) or Docs in the header |
| Authorize | Button or press a |
| Start mission | Button or press s |
| Focus brief | Press / |

## If something feels stuck

- Start grayed out? Acknowledge Authorization first.
- Wrong port? Use http://localhost:3333 (not 3000 unless Docker).
- Confused by a finding? Click Evidence Vault and expand the linked record.

> **Want more depth later:** War Room Guide · Vendor Loadouts · FAQ & Troubleshooting.
