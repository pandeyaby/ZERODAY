"use client";

import { Badge, SeverityBadge, loadoutTone, vendorImpactTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { StegoLab } from "@/components/stego/stego-lab";
import { PliniusPanel } from "@/components/plinius/plinius-panel";
import { DocsPanel } from "@/components/docs/docs-panel";
import { OrgUsagePanel } from "@/components/war-room/org-usage-panel";
import type {
  EvidenceRecord,
  Finding,
  Mission,
  OperatorEvent,
  OperatorState,
  RetestItem,
} from "@/lib/types";
import { cn } from "@/lib/cn";
import {
  Activity,
  Archive,
  BookOpen,
  Building2,
  Crosshair,
  FileText,
  FlaskConical,
  ListChecks,
  Radio,
  RefreshCw,
  Settings2,
  Boxes,
  Shield,
  Terminal,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type Tab =
  | "howto"
  | "missions"
  | "operators"
  | "evidence"
  | "findings"
  | "retest"
  | "reports"
  | "stego"
  | "plinius"
  | "docs"
  | "settings";

const TABS: { id: Tab; label: string; icon: React.ReactNode; shortcut: string }[] = [
  { id: "howto", label: "How to use", icon: <Building2 size={14} />, shortcut: "h" },
  { id: "missions", label: "Missions", icon: <Crosshair size={14} />, shortcut: "1" },
  { id: "operators", label: "Live Operators", icon: <Radio size={14} />, shortcut: "2" },
  { id: "evidence", label: "Evidence Vault", icon: <Archive size={14} />, shortcut: "3" },
  { id: "findings", label: "Findings Ledger", icon: <ListChecks size={14} />, shortcut: "4" },
  { id: "retest", label: "Retest Queue", icon: <RefreshCw size={14} />, shortcut: "5" },
  { id: "reports", label: "Reports", icon: <FileText size={14} />, shortcut: "6" },
  { id: "stego", label: "Stego & Mutation", icon: <FlaskConical size={14} />, shortcut: "7" },
  { id: "plinius", label: "Plinius", icon: <Boxes size={14} />, shortcut: "0" },
  { id: "docs", label: "Docs", icon: <BookOpen size={14} />, shortcut: "9" },
  { id: "settings", label: "Settings", icon: <Settings2 size={14} />, shortcut: "8" },
];

function initialTab(): Tab {
  if (typeof window === "undefined") return "missions";
  const q = new URLSearchParams(window.location.search).get("tab");
  if (q === "howto" || q === "play" || q === "org") return "howto";
  if (TABS.some((t) => t.id === q)) return q as Tab;
  if (window.location.pathname === "/play") return "howto";
  return "missions";
}

export function WarRoom({ defaultTab }: { defaultTab?: Tab } = {}) {
  const [tab, setTab] = useState<Tab>(defaultTab || "missions");
  const [missions, setMissions] = useState<Mission[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{
    mission?: Mission;
    operators: OperatorState[];
    events: OperatorEvent[];
    evidence: EvidenceRecord[];
    findings: Finding[];
    retests: RetestItem[];
  } | null>(null);
  const [brief, setBrief] = useState(
    "Perform full kill chain assessment on our Cisco DNA Center and Splunk deployment in staging environment"
  );
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null);
  const [authName, setAuthName] = useState("Red Team Lead");

  const selected = useMemo(
    () => missions.find((m) => m.id === selectedId) || detail?.mission,
    [missions, selectedId, detail]
  );

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  };

  const refreshMissions = useCallback(async () => {
    const res = await fetch("/api/missions");
    const json = await res.json();
    setMissions(json.missions || []);
    if (!selectedId && json.missions?.[0]) setSelectedId(json.missions[0].id);
  }, [selectedId]);

  const refreshDetail = useCallback(async (id: string) => {
    const res = await fetch(`/api/missions/${id}`);
    if (!res.ok) return;
    const json = await res.json();
    setDetail(json);
  }, []);

  useEffect(() => {
    if (!defaultTab) setTab(initialTab());
  }, [defaultTab]);

  useEffect(() => {
    void refreshMissions();
    void fetch("/api/settings")
      .then((r) => r.json())
      .then(setSettings);
    void fetch("/api/health");
  }, [refreshMissions]);

  useEffect(() => {
    if (!selectedId) return;
    void refreshDetail(selectedId);
    const t = setInterval(() => {
      void refreshDetail(selectedId);
      void refreshMissions();
    }, 1500);
    return () => clearInterval(t);
  }, [selectedId, refreshDetail, refreshMissions]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "/") {
        e.preventDefault();
        document.getElementById("mission-brief")?.focus();
        return;
      }
      const tabHit = TABS.find((t) => t.shortcut === e.key);
      if (tabHit) setTab(tabHit.id);
      if (e.key === "s" && selectedId) void startMission();
      if (e.key === "a" && selectedId) void authorize();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, authName]);

  async function createMission() {
    setBusy(true);
    try {
      const res = await fetch("/api/missions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief }),
      });
      const json = await res.json();
      await refreshMissions();
      setSelectedId(json.mission.id);
      setTab("missions");
      notify("Mission created — acknowledge authorization to run");
    } finally {
      setBusy(false);
    }
  }

  async function authorize() {
    if (!selectedId) return;
    setBusy(true);
    try {
      await fetch("/api/missions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "authorize",
          missionId: selectedId,
          authorizedBy: authName,
        }),
      });
      await refreshDetail(selectedId);
      await refreshMissions();
      notify("Authorization acknowledged");
    } finally {
      setBusy(false);
    }
  }

  async function startMission() {
    if (!selectedId) return;
    setBusy(true);
    try {
      const res = await fetch("/api/missions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", missionId: selectedId }),
      });
      const json = await res.json();
      if (!res.ok) notify(json.error || "Failed to start");
      else {
        notify("Mission run started");
        setTab("operators");
      }
      await refreshDetail(selectedId);
    } finally {
      setBusy(false);
    }
  }

  async function abortMission() {
    if (!selectedId) return;
    await fetch("/api/missions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "abort", missionId: selectedId }),
    });
    notify("Mission aborted");
    await refreshDetail(selectedId);
  }

  async function completeRetest(retestId: string, outcome: "passed" | "failed") {
    await fetch("/api/retest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "complete",
        retestId,
        outcome,
        notes: outcome === "passed" ? "Independent retest confirmed" : "Retest failed validation",
      }),
    });
    if (selectedId) await refreshDetail(selectedId);
    notify(`Retest ${outcome}`);
  }

  async function saveSettings(patch: Record<string, unknown>) {
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const json = await res.json();
    setSettings((s) => ({ ...s, settings: json.settings }));
    notify("Settings saved");
  }

  const mission = detail?.mission || selected;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="border-b border-[var(--line)] bg-[var(--bg-1)]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="mx-auto max-w-[1600px] px-4 py-3 flex items-center gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative">
              <Shield className="text-[var(--accent)] animate-pulse-glow" size={28} />
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-xl tracking-[0.2em] text-[var(--accent)] leading-none">
                ZERODAY
              </h1>
              <p className="text-[10px] uppercase tracking-[0.25em] text-[var(--muted)] mt-1">
                War Room · Plinian Doctrine
              </p>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-2 ml-4 text-[var(--muted)] text-xs">
            <Badge tone="cisco">Cisco</Badge>
            <Badge tone="splunk">Splunk</Badge>
            <Badge tone="paloalto">Palo</Badge>
            <Badge tone="fortinet">Fortinet</Badge>
            <Badge tone="crowdstrike">Falcon</Badge>
            <Badge tone="aws">AWS</Badge>
            <Badge tone="ok">Keyless</Badge>
          </div>

          <div className="flex-1" />

          <div className="hidden md:flex items-center gap-2 text-[var(--muted)] text-xs">
            <span className="kbd">h</span> how-to
            <span className="kbd">/</span> brief
            <span className="kbd">1-9</span> tabs
            <span className="kbd">a</span> auth
            <span className="kbd">s</span> start
          </div>

          <Link
            href="/play"
            className="hidden sm:inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-[var(--muted)] hover:text-[var(--accent)] border border-[var(--line)] hover:border-[var(--accent)]/40 rounded-md px-2.5 py-1.5 transition"
            title="Org usage + fixture playground"
          >
            <Building2 size={14} />
            How to use
          </Link>

          <Link
            href="/docs"
            className="hidden sm:inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-[var(--muted)] hover:text-[var(--accent)] border border-[var(--line)] hover:border-[var(--accent)]/40 rounded-md px-2.5 py-1.5 transition"
            title="Open documentation"
          >
            <BookOpen size={14} />
            Docs
          </Link>

          <div className="flex items-center gap-2">
            <span className="status-dot bg-[var(--accent)]" />
            <span className="text-xs text-[var(--muted)] font-mono">LOCAL</span>
          </div>
        </div>

        <nav className="mx-auto max-w-[1600px] px-2 flex gap-1 overflow-x-auto scrollbar-thin">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-2 px-3 py-2.5 text-xs uppercase tracking-wider border-b-2 transition",
                tab === t.id
                  ? "border-[var(--accent)] text-[var(--accent)]"
                  : "border-transparent text-[var(--muted)] hover:text-[var(--text)]"
              )}
            >
              {t.icon}
              {t.label}
              <span className="kbd opacity-60">{t.shortcut}</span>
            </button>
          ))}
        </nav>
      </header>

      <main className="flex-1 mx-auto w-full max-w-[1600px] p-4 grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-4">
        {/* Sidebar — mission list */}
        <aside className="panel rounded-lg overflow-hidden h-fit xl:sticky xl:top-[120px] animate-fade-up">
          <div className="panel-header">
            <span className="font-display text-sm tracking-wide">Mission Queue</span>
            <Activity size={14} className="text-[var(--muted)]" />
          </div>
          <div className="p-3 space-y-2 max-h-[50vh] overflow-y-auto scrollbar-thin">
            {missions.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelectedId(m.id)}
                className={cn(
                  "w-full text-left rounded-md border px-3 py-2.5 transition",
                  selectedId === m.id
                    ? "border-[var(--accent)]/50 bg-[var(--accent)]/5"
                    : "border-[var(--line)] hover:border-[var(--line-bright)]"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium truncate">{m.name}</span>
                  <StatusPill status={m.status} />
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {m.loadouts.map((l) => (
                    <Badge key={l} tone={loadoutTone(l)}>
                      {l}
                    </Badge>
                  ))}
                </div>
              </button>
            ))}
            {!missions.length && (
              <p className="text-xs text-[var(--muted)] p-2">No missions yet. Launch one below.</p>
            )}
          </div>

          <div className="border-t border-[var(--line)] p-3 space-y-2">
            <label className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
              Natural language brief
            </label>
            <Textarea
              id="mission-brief"
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="Describe the authorized engagement…"
              className="min-h-[88px] text-xs"
            />
            <Button className="w-full" disabled={busy || !brief.trim()} onClick={() => void createMission()}>
              <Terminal size={14} /> Launch Mission
            </Button>
          </div>
        </aside>

        {/* Main panel */}
        <section className="space-y-4 animate-fade-up" style={{ animationDelay: "60ms" }}>
          {tab === "howto" ? (
            <OrgUsagePanel />
          ) : tab === "stego" ? (
            <StegoLab />
          ) : tab === "plinius" ? (
            <PliniusPanel />
          ) : tab === "docs" ? (
            <DocsPanel />
          ) : tab === "settings" ? (
            <SettingsPanel settings={settings} onSave={saveSettings} />
          ) : !mission ? (
            <EmptyState />
          ) : (
            <>
              {/* Mission command bar */}
              <div className="panel rounded-lg p-4 scanline-overlay relative overflow-hidden">
                <div className="flex flex-col lg:flex-row lg:items-start gap-4 justify-between relative z-10">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <StatusPill status={mission.status} />
                      <span className="font-mono text-[10px] text-[var(--muted)]">{mission.id}</span>
                    </div>
                    <h2 className="font-display text-2xl tracking-wide truncate">{mission.name}</h2>
                    <p className="text-sm text-[var(--muted)] mt-1 max-w-3xl">{mission.objective}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {mission.targets.map((t) => (
                        <Badge key={t.id} tone="muted">
                          {t.hostname || t.cidr || t.url} · {t.environment}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 min-w-[220px]">
                    {!mission.authorization?.acknowledged ? (
                      <>
                        <Input
                          value={authName}
                          onChange={(e) => setAuthName(e.target.value)}
                          placeholder="Authorized by"
                          className="text-xs"
                        />
                        <Button variant="warn" disabled={busy} onClick={() => void authorize()}>
                          Acknowledge Authorization
                        </Button>
                      </>
                    ) : (
                      <div className="text-xs text-[var(--accent)] border border-[var(--accent)]/30 rounded-md p-2">
                        Auth: {mission.authorization.authorizedBy}
                        <div className="text-[var(--muted)] mt-1 truncate">
                          {mission.authorization.writtenApprovalRef || "RoE acknowledged"}
                        </div>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button
                        className="flex-1"
                        disabled={busy || !mission.authorization?.acknowledged || mission.status === "running"}
                        onClick={() => void startMission()}
                      >
                        Start
                      </Button>
                      <Button variant="danger" disabled={mission.status !== "running"} onClick={() => void abortMission()}>
                        Abort
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {tab === "missions" && <MissionsView mission={mission} />}
              {tab === "operators" && (
                <OperatorsView
                  operators={detail?.operators || []}
                  events={detail?.events || []}
                  phases={mission.phases}
                />
              )}
              {tab === "evidence" && <EvidenceView evidence={detail?.evidence || []} />}
              {tab === "findings" && <FindingsView findings={detail?.findings || []} />}
              {tab === "retest" && (
                <RetestView
                  retests={detail?.retests || []}
                  findings={detail?.findings || []}
                  onComplete={completeRetest}
                />
              )}
              {tab === "reports" && (
                <ReportsView
                  mission={mission}
                  findings={detail?.findings || []}
                  evidence={detail?.evidence || []}
                />
              )}
            </>
          )}
        </section>
      </main>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 panel rounded-md px-4 py-3 text-sm border-[var(--accent)]/40 shadow-lg animate-fade-up">
          {toast}
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "running"
      ? "ok"
      : status === "completed" || status === "promoted"
        ? "ok"
        : status === "failed" || status === "aborted"
          ? "danger"
          : status === "awaiting_authorization" || status === "awaiting_retest"
            ? "warn"
            : "muted";
  return <Badge tone={tone as "ok"}>{status.replace(/_/g, " ")}</Badge>;
}

function EmptyState() {
  return (
    <div className="panel rounded-lg p-12 text-center">
      <Shield className="mx-auto text-[var(--accent)] mb-4" size={40} />
      <h2 className="font-display text-2xl tracking-wide">Awaiting Mission</h2>
      <p className="text-[var(--muted)] mt-2 max-w-md mx-auto text-sm">
        Launch a natural-language brief or select an example mission from the queue.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-4">
        <Link
          href="/play"
          className="inline-flex items-center gap-2 text-sm text-[var(--accent)] hover:underline"
        >
          <Building2 size={16} />
          How to use + fixture playground
        </Link>
        <Link
          href="/docs/first-time-users"
          className="inline-flex items-center gap-2 text-sm text-[var(--accent)] hover:underline"
        >
          <BookOpen size={16} />
          First-time user guide
        </Link>
      </div>
    </div>
  );
}

function MissionsView({ mission }: { mission: Mission }) {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="panel rounded-lg">
        <div className="panel-header">
          <span className="text-sm font-display tracking-wide">Kill Chain Phases</span>
        </div>
        <ul className="p-3 space-y-2">
          {mission.phases.map((p, i) => (
            <li
              key={p.id}
              className="flex items-center gap-3 border border-[var(--line)] rounded-md px-3 py-2"
            >
              <span className="font-mono text-[var(--muted)] text-xs w-5">{String(i + 1).padStart(2, "0")}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">{p.name}</div>
                <div className="text-[10px] uppercase tracking-wider text-[var(--muted)]">{p.operatorRole}</div>
              </div>
              <StatusPill status={p.status} />
            </li>
          ))}
        </ul>
      </div>
      <div className="panel rounded-lg">
        <div className="panel-header">
          <span className="text-sm font-display tracking-wide">Authorization & Scope</span>
        </div>
        <div className="p-4 space-y-3 text-sm">
          <div>
            <div className="text-[10px] uppercase text-[var(--muted)] tracking-wider">RoE</div>
            <p className="text-[var(--text)]/90 mt-1 whitespace-pre-wrap">
              {mission.authorization?.rulesOfEngagement}
            </p>
          </div>
          <div>
            <div className="text-[10px] uppercase text-[var(--muted)] tracking-wider">Scope summary</div>
            <p className="mt-1">{mission.authorization?.scopeSummary || "—"}</p>
          </div>
          <div className="text-xs text-[var(--muted)] border-t border-[var(--line)] pt-3">
            Doctrine: Scope + Authorization + Evidence + Retest. Secrets redacted by default.
          </div>
        </div>
      </div>
    </div>
  );
}

function OperatorsView({
  operators,
  events,
  phases,
}: {
  operators: OperatorState[];
  events: OperatorEvent[];
  phases: Mission["phases"];
}) {
  return (
    <div className="grid lg:grid-cols-[1fr_1.2fr] gap-4">
      <div className="panel rounded-lg">
        <div className="panel-header">
          <span className="text-sm font-display tracking-wide">Operator Cell</span>
          <Badge tone="ok">{operators.filter((o) => o.status !== "idle" && o.status !== "done").length} live</Badge>
        </div>
        <div className="p-3 grid sm:grid-cols-2 gap-2">
          {operators.map((op) => (
            <div key={op.id} className="border border-[var(--line)] rounded-md p-3">
              <div className="flex items-center justify-between">
                <span className="font-display tracking-wide text-sm uppercase">{op.role}</span>
                <StatusPill status={op.status} />
              </div>
              <p className="text-xs text-[var(--muted)] mt-2 line-clamp-2 min-h-[2rem]">
                {op.currentThought || "Idle"}
              </p>
              <div className="mt-2 font-mono text-[10px] text-[var(--muted)]">
                tools: {op.toolCalls}
              </div>
            </div>
          ))}
          {!operators.length && (
            <p className="text-xs text-[var(--muted)] col-span-2 p-2">
              Operators spawn when the mission starts.
            </p>
          )}
        </div>
        <div className="border-t border-[var(--line)] p-3">
          <div className="text-[10px] uppercase tracking-wider text-[var(--muted)] mb-2">Phase progress</div>
          <div className="flex gap-1">
            {phases.map((p) => (
              <div
                key={p.id}
                title={p.name}
                className={cn(
                  "h-1.5 flex-1 rounded-full",
                  p.status === "completed"
                    ? "bg-[var(--accent)]"
                    : p.status === "running"
                      ? "bg-[var(--warn)] animate-pulse"
                      : p.status === "failed"
                        ? "bg-[var(--danger)]"
                        : "bg-[var(--line)]"
                )}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="panel rounded-lg flex flex-col max-h-[640px]">
        <div className="panel-header">
          <span className="text-sm font-display tracking-wide">Live Event Stream</span>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-2 font-mono text-xs">
          {events.map((e) => (
            <div key={e.id} className="border-l-2 border-[var(--line-bright)] pl-3 py-1">
              <div className="text-[var(--muted)]">
                {new Date(e.createdAt).toLocaleTimeString()} · {e.operatorRole} · {e.type}
              </div>
              <div className="text-[var(--text)]/90">{e.message}</div>
            </div>
          ))}
          {!events.length && <p className="text-[var(--muted)]">No events yet.</p>}
        </div>
      </div>
    </div>
  );
}

function EvidenceView({ evidence }: { evidence: EvidenceRecord[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="panel rounded-lg">
      <div className="panel-header">
        <span className="text-sm font-display tracking-wide">Evidence Vault</span>
        <Badge tone="muted">{evidence.length} records</Badge>
      </div>
      <div className="divide-y divide-[var(--line)] max-h-[70vh] overflow-y-auto scrollbar-thin">
        {evidence.map((e) => (
          <button
            key={e.id}
            onClick={() => setOpen(open === e.id ? null : e.id)}
            className="w-full text-left px-4 py-3 hover:bg-white/[0.02]"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm truncate">{e.title}</div>
                <div className="text-xs text-[var(--muted)] truncate">{e.summary}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {e.redacted && <Badge tone="ok">redacted</Badge>}
                <Badge tone="muted">{e.kind}</Badge>
              </div>
            </div>
            {open === e.id && (
              <div className="mt-3 rounded-md bg-[var(--bg-0)] border border-[var(--line)] p-3 font-mono text-[10px] overflow-x-auto">
                <div className="text-[var(--muted)] mb-2">sha256:{e.hash.slice(0, 16)}…</div>
                <pre className="whitespace-pre-wrap">{JSON.stringify(e.payload, null, 2)}</pre>
              </div>
            )}
          </button>
        ))}
        {!evidence.length && <p className="p-4 text-sm text-[var(--muted)]">Vault empty — run a mission.</p>}
      </div>
    </div>
  );
}

function FindingsView({ findings }: { findings: Finding[] }) {
  return (
    <div className="panel rounded-lg">
      <div className="panel-header">
        <span className="text-sm font-display tracking-wide">Findings Ledger</span>
        <Badge tone="danger">{findings.filter((f) => f.severity === "high" || f.severity === "critical").length} elevated</Badge>
      </div>
      <div className="divide-y divide-[var(--line)]">
        {findings.map((f) => (
          <div key={f.id} className="px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <SeverityBadge severity={f.severity} />
                  <span className="text-sm font-medium">{f.title}</span>
                </div>
                <p className="text-xs text-[var(--muted)] mt-1">{f.description}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {f.vendorImpact.map((v) => (
                    <Badge key={v} tone={vendorImpactTone(v)}>
                      {v}
                    </Badge>
                  ))}
                  <Badge tone="muted">{f.confidence}</Badge>
                  <Badge tone={f.status === "promoted" ? "ok" : f.status === "needs_retest" ? "warn" : "muted"}>
                    {f.status}
                  </Badge>
                </div>
                <p className="text-xs mt-2 text-[var(--accent)]/90">Fix: {f.recommendedFix}</p>
              </div>
              <span className="font-mono text-[10px] text-[var(--muted)]">{f.evidenceIds.length} ev</span>
            </div>
          </div>
        ))}
        {!findings.length && <p className="p-4 text-sm text-[var(--muted)]">No findings yet.</p>}
      </div>
    </div>
  );
}

function RetestView({
  retests,
  findings,
  onComplete,
}: {
  retests: RetestItem[];
  findings: Finding[];
  onComplete: (id: string, outcome: "passed" | "failed") => void;
}) {
  const byId = Object.fromEntries(findings.map((f) => [f.id, f]));
  return (
    <div className="panel rounded-lg">
      <div className="panel-header">
        <span className="text-sm font-display tracking-wide">Retest Queue</span>
      </div>
      <div className="divide-y divide-[var(--line)]">
        {retests.map((r) => (
          <div key={r.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <div>
              <div className="text-sm">{byId[r.findingId]?.title || r.findingId}</div>
              <div className="text-xs text-[var(--muted)] mt-1">{r.reason}</div>
              <StatusPill status={r.status} />
            </div>
            {r.status === "queued" && (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => onComplete(r.id, "passed")}>
                  Pass
                </Button>
                <Button size="sm" variant="danger" onClick={() => onComplete(r.id, "failed")}>
                  Fail
                </Button>
              </div>
            )}
          </div>
        ))}
        {!retests.length && (
          <p className="p-4 text-sm text-[var(--muted)]">
            High/critical findings auto-queue here before promotion.
          </p>
        )}
      </div>
    </div>
  );
}

function ReportsView({
  mission,
  findings,
  evidence,
}: {
  mission: Mission;
  findings: Finding[];
  evidence: EvidenceRecord[];
}) {
  const report = {
    mission: {
      id: mission.id,
      name: mission.name,
      status: mission.status,
      loadouts: mission.loadouts,
      targets: mission.targets,
    },
    summary: {
      evidence: evidence.length,
      findings: findings.length,
      promoted: findings.filter((f) => f.status === "promoted").length,
      needsRetest: findings.filter((f) => f.status === "needs_retest").length,
    },
    findings,
  };

  return (
    <div className="panel rounded-lg">
      <div className="panel-header">
        <span className="text-sm font-display tracking-wide">Engagement Report</span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            void navigator.clipboard.writeText(JSON.stringify(report, null, 2));
          }}
        >
          Copy JSON
        </Button>
      </div>
      <pre className="p-4 font-mono text-[11px] overflow-auto max-h-[70vh] scrollbar-thin text-[var(--muted)]">
        {JSON.stringify(report, null, 2)}
      </pre>
    </div>
  );
}

function SettingsPanel({
  settings,
  onSave,
}: {
  settings: Record<string, unknown> | null;
  onSave: (patch: Record<string, unknown>) => void;
}) {
  const s = (settings?.settings || {}) as Record<string, unknown>;
  const [provider, setProvider] = useState(String(s.llmProvider || "keyless"));
  const [model, setModel] = useState(String(s.llmModel || "user-agent"));
  const [baseUrl, setBaseUrl] = useState(String(s.llmBaseUrl || ""));

  useEffect(() => {
    setProvider(String(s.llmProvider || "keyless"));
    setModel(String(s.llmModel || "user-agent"));
    setBaseUrl(String(s.llmBaseUrl || ""));
  }, [s.llmProvider, s.llmModel, s.llmBaseUrl]);

  return (
    <div className="panel rounded-lg max-w-2xl">
      <div className="panel-header">
        <span className="text-sm font-display tracking-wide">Settings</span>
      </div>
      <div className="p-4 space-y-4">
        <p className="text-sm text-[var(--muted)]">
          Keyless by default — ZERODAY uses your existing AI agent. Optional providers via env vars
          (never stored in evidence).
        </p>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-[var(--muted)]">LLM Provider</label>
          <select
            className="mt-1 w-full rounded-md border border-[var(--line)] bg-[var(--bg-1)] px-3 py-2 text-sm"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
          >
            <option value="keyless">Keyless (user agent)</option>
            <option value="ollama">Ollama / local</option>
            <option value="openrouter">OpenRouter</option>
            <option value="anthropic">Anthropic</option>
            <option value="openai">OpenAI</option>
            <option value="custom">Custom OpenAI-compatible</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-[var(--muted)]">Model</label>
          <Input className="mt-1" value={model} onChange={(e) => setModel(e.target.value)} />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-[var(--muted)]">Base URL</label>
          <Input
            className="mt-1"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="http://127.0.0.1:11434/v1"
          />
        </div>
        <Button
          onClick={() =>
            onSave({
              llmProvider: provider,
              llmModel: model,
              llmBaseUrl: baseUrl || undefined,
            })
          }
        >
          Save
        </Button>
        <div className="text-xs font-mono text-[var(--muted)] border-t border-[var(--line)] pt-3">
          Env hints: {JSON.stringify(settings?.envHints || {}, null, 0)}
        </div>
      </div>
    </div>
  );
}
