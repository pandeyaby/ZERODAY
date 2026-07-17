"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { useCallback, useEffect, useState } from "react";

type LibStatus = {
  id: string;
  name: string;
  tier: "production" | "research";
  present: boolean;
  status: string;
  github: string;
  description: string;
  integration: string;
  spicy: boolean;
};

type GateSummary = {
  enabled: boolean;
  acknowledged: boolean;
  enabledLibs: string[];
  allowContentReads: boolean;
  allowExecution: boolean;
  ackStatement: string;
};

export function PliniusPanel() {
  const [status, setStatus] = useState<{
    libraries: LibStatus[];
    research: GateSummary;
    t3mp3st: Record<string, unknown>;
    st3gg: Record<string, unknown>;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [ackBy, setAckBy] = useState("Lab Operator");
  const [enabledLibs, setEnabledLibs] = useState<string[]>([]);
  const [st3ggOut, setSt3ggOut] = useState<string>("");

  const refresh = useCallback(async () => {
    const res = await fetch("/api/plinius?action=status");
    const json = await res.json();
    setStatus(json);
    setEnabledLibs(json.research?.enabledLibs || []);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function acknowledge() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/plinius", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "acknowledge_research", acknowledgedBy: ackBy }),
      });
      const json = await res.json();
      setMsg(json.ok ? "Research acknowledgment recorded" : json.error || "Failed");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function saveGates(patch: Record<string, unknown>) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/plinius", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_research_gates", ...patch }),
      });
      const json = await res.json();
      setMsg(json.ok ? "Research gates updated" : json.error || "Failed");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function runSt3gg(action: string) {
    setBusy(true);
    setSt3ggOut("");
    try {
      const res = await fetch("/api/plinius", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, useDemo: true }),
      });
      const json = await res.json();
      setSt3ggOut(JSON.stringify(json, null, 2));
    } finally {
      setBusy(false);
    }
  }

  const research = status?.research;

  return (
    <div className="space-y-4">
      <div className="panel rounded-lg">
        <div className="panel-header flex items-center justify-between">
          <span className="text-sm font-display tracking-wide">Plinius Bridge</span>
          <Button size="sm" variant="ghost" onClick={() => void refresh()} disabled={busy}>
            Refresh
          </Button>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-sm text-[var(--muted)]">
            Optional local Plinius clones under <code className="text-[11px]">vendor/plinius/</code>{" "}
            (not shipped in the ZERODAY git tree). T3MP3ST + ST3GG adapters activate when present.
            Research libs stay OFF until you acknowledge and enable them.
          </p>
          <div className="grid gap-2 md:grid-cols-2">
            {(status?.libraries || []).map((lib) => (
              <div
                key={lib.id}
                className={cn(
                  "rounded-md border border-[var(--line)] p-3 bg-[var(--bg-1)]",
                  !lib.present && "opacity-60"
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-display text-sm">{lib.name}</span>
                  <Badge tone={lib.tier === "production" ? "cisco" : "splunk"}>
                    {lib.tier}
                  </Badge>
                  <Badge tone={lib.present ? "ok" : "danger"}>
                    {lib.present ? "installed" : "missing"}
                  </Badge>
                  {lib.spicy ? <Badge tone="danger">spicy</Badge> : null}
                </div>
                <p className="text-xs text-[var(--muted)] mb-1">{lib.description}</p>
                <p className="text-[11px] text-[var(--muted)]">{lib.integration}</p>
                <a
                  className="text-[11px] text-[var(--accent)] underline mt-1 inline-block"
                  href={lib.github}
                  target="_blank"
                  rel="noreferrer"
                >
                  GitHub
                </a>
              </div>
            ))}
          </div>
          {msg ? <p className="text-xs text-[var(--accent)]">{msg}</p> : null}
        </div>
      </div>

      <div className="panel rounded-lg">
        <div className="panel-header">
          <span className="text-sm font-display tracking-wide">T3MP3ST · ST3GG (production)</span>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid gap-3 md:grid-cols-2 text-xs font-mono text-[var(--muted)]">
            <pre className="overflow-auto max-h-40 scrollbar-thin p-2 rounded border border-[var(--line)]">
              {JSON.stringify(status?.t3mp3st || {}, null, 2)}
            </pre>
            <pre className="overflow-auto max-h-40 scrollbar-thin p-2 rounded border border-[var(--line)]">
              {JSON.stringify(status?.st3gg || {}, null, 2)}
            </pre>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={busy} onClick={() => void runSt3gg("st3gg_analyze")}>
              Analyze demo banner
            </Button>
            <Button size="sm" disabled={busy} onClick={() => void runSt3gg("st3gg_detect")}>
              Detect demo
            </Button>
            <Button size="sm" disabled={busy} onClick={() => void runSt3gg("st3gg_capacity")}>
              Capacity demo
            </Button>
          </div>
          {st3ggOut ? (
            <pre className="text-[11px] font-mono overflow-auto max-h-56 scrollbar-thin p-2 rounded border border-[var(--line)] text-[var(--muted)]">
              {st3ggOut}
            </pre>
          ) : null}
          {status?.st3gg && !(status.st3gg as { ready?: boolean }).ready ? (
            <p className="text-xs text-[var(--warn)]">
              ST3GG needs Python deps:{" "}
              <code>python3 -m pip install -r vendor/plinius/st3gg/requirements.txt</code>
            </p>
          ) : null}
        </div>
      </div>

      <div className="panel rounded-lg border border-[var(--danger)]/40">
        <div className="panel-header">
          <span className="text-sm font-display tracking-wide">
            Research libraries (gated · default OFF)
          </span>
        </div>
        <div className="p-4 space-y-4">
          <pre className="text-[11px] whitespace-pre-wrap text-[var(--muted)] border border-[var(--line)] rounded p-3 max-h-40 overflow-auto scrollbar-thin">
            {research?.ackStatement || ""}
          </pre>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[180px]">
              <label className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
                Acknowledge as
              </label>
              <Input className="mt-1" value={ackBy} onChange={(e) => setAckBy(e.target.value)} />
            </div>
            <Button size="sm" disabled={busy || research?.acknowledged} onClick={() => void acknowledge()}>
              {research?.acknowledged ? "Acknowledged" : "Acknowledge authorized use"}
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <Button
              size="sm"
              disabled={busy || !research?.acknowledged}
              onClick={() =>
                void saveGates({ researchLibrariesEnabled: !research?.enabled })
              }
            >
              {research?.enabled ? "Disable research libs" : "Enable research libs"}
            </Button>
            <Badge tone={research?.enabled ? "danger" : "ok"}>
              master: {research?.enabled ? "ON" : "OFF"}
            </Badge>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
              Enable individual libraries
            </p>
            <div className="flex flex-wrap gap-2">
              {["g0dm0d3", "cl4r1t4s", "l1b3rt4s", "obliteratus"].map((id) => {
                const on = enabledLibs.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    disabled={busy || !research?.enabled}
                    className={cn(
                      "px-2 py-1 rounded text-xs border border-[var(--line)]",
                      on ? "bg-[var(--danger)]/20 text-[var(--danger)]" : "text-[var(--muted)]"
                    )}
                    onClick={() => {
                      const next = on
                        ? enabledLibs.filter((x) => x !== id)
                        : [...enabledLibs, id];
                      setEnabledLibs(next);
                      void saveGates({ enabledResearchLibs: next });
                    }}
                  >
                    {id}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="ghost"
              disabled={busy || !research?.enabled}
              onClick={() =>
                void saveGates({ allowResearchContentReads: !research?.allowContentReads })
              }
            >
              Content reads: {research?.allowContentReads ? "ON" : "OFF"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy || !research?.enabled}
              onClick={() =>
                void saveGates({ allowResearchExecution: !research?.allowExecution })
              }
            >
              Execution flag: {research?.allowExecution ? "ON" : "OFF"}
            </Button>
          </div>
          <p className="text-xs text-[var(--muted)]">
            Even with execution ON + receipt, ZERODAY refuses in-process jailbreak/abliteration
            runners and points you to an isolated lab VM. All browse/preview actions are audited to
            the Evidence Vault.
          </p>
        </div>
      </div>
    </div>
  );
}
