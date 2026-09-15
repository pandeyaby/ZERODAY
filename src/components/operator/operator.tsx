"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DocsPanel } from "@/components/docs/docs-panel";
import { DeskConsole } from "@/components/operator/desk-console";
import { FaqPanel } from "@/components/operator/faq-panel";
import { OrgUsagePanel } from "@/components/operator/org-usage-panel";
import { cn } from "@/lib/cn";
import {
  BookOpen,
  CircleHelp,
  LayoutDashboard,
  Package,
  Settings2,
  Shield,
  Waypoints,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type Tab = "desk" | "howto" | "faq" | "vendors" | "docs" | "settings";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "desk", label: "Desk Console", icon: <LayoutDashboard size={14} /> },
  { id: "howto", label: "How orgs use this", icon: <Waypoints size={14} /> },
  { id: "faq", label: "FAQ", icon: <CircleHelp size={14} /> },
  { id: "vendors", label: "Vendor packs", icon: <Package size={14} /> },
  { id: "docs", label: "Docs", icon: <BookOpen size={14} /> },
  { id: "settings", label: "Settings", icon: <Settings2 size={14} /> },
];

const VENDOR_PACKS = [
  {
    desk: "Cisco",
    file: "report.sarif (+ Foundry Detector-lane candidates)",
    ingest:
      "Upload SARIF to Code Scanning / Foundry Detector-lane review. Candidates only — human triage.",
  },
  {
    desk: "Splunk",
    file: "splunk-cim-vulnerabilities.json",
    ingest:
      "Customer TA maps sourcetype zeroday:antares:json → CIM Vulnerabilities. You own credentials.",
  },
  {
    desk: "Palo Alto",
    file: "xsoar-incidents.json",
    ingest:
      "Feed JSON array into a customer XSOAR mapper / webhook playbook. No live incident POST.",
  },
  {
    desk: "Fortinet",
    file: "fortisiem-custom.json",
    ingest:
      "Point a customer FortiSIEM parser / rawupload at the generic keys. No live /rawupload from ZERODAY.",
  },
  {
    desk: "CrowdStrike",
    file: "crowdstrike-hec-events.ndjson",
    ingest:
      "Ship NDJSON with a customer HEC token to LogScale. No live HEC from ZERODAY.",
  },
  {
    desk: "AWS Security",
    file: "asff-findings.json",
    ingest:
      "Replace AwsAccountId placeholders; your process calls BatchImportFindings. ZERODAY never calls AWS.",
  },
] as const;

export function Operator() {
  const [tab, setTab] = useState<Tab>("desk");
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null);
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    void fetch("/api/settings")
      .then((r) => r.json())
      .then((j) => setSettings(j));
    void fetch("/api/health")
      .then((r) => r.json())
      .then((j) => setHealth(j));
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[var(--line)] bg-[var(--bg-1)]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="mx-auto max-w-[1400px] px-4 py-3 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-3 min-w-0">
            <Shield className="text-[var(--accent)]" size={28} />
            <div className="min-w-0">
              <h1 className="font-display text-xl tracking-[0.2em] text-[var(--accent)] leading-none">
                ZERODAY
              </h1>
              <p className="text-[10px] uppercase tracking-[0.25em] text-[var(--muted)] mt-1">
                Desk Console · defensive localization
              </p>
            </div>
          </Link>
          <div className="flex-1" />
          <Link
            href="/play"
            className="text-xs uppercase tracking-wider text-[var(--muted)] hover:text-[var(--accent)]"
          >
            Desk /play →
          </Link>
          <Badge tone="ok">local</Badge>
          <Badge tone="muted">keyless default</Badge>
        </div>
        <nav className="mx-auto max-w-[1400px] px-4 pb-2 flex flex-wrap gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs uppercase tracking-wider transition",
                tab === t.id
                  ? "bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/40"
                  : "text-[var(--muted)] hover:text-[var(--fg)] border border-transparent",
              )}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="flex-1 mx-auto w-full max-w-[1400px] p-4">
        {tab === "desk" && <DeskConsole />}

        {tab === "howto" && <OrgUsagePanel initialView="person" />}

        {tab === "faq" && <FaqPanel />}

        {tab === "vendors" && (
          <div className="space-y-4 animate-fade-up">
            <div className="panel rounded-lg p-4">
              <h2 className="font-display text-xl tracking-wide">
                Vendor operator packs
              </h2>
              <p className="text-sm text-[var(--muted)] mt-1 max-w-3xl">
                Local files only. ZERODAY does not push, claims no partnership, and
                bundles no credentials. Your desk owns ingest.
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              {VENDOR_PACKS.map((v) => (
                <div
                  key={v.desk}
                  className="rounded-lg border border-[var(--line)] p-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Package size={14} className="text-[var(--accent)]" />
                    <span className="font-display text-sm tracking-wide">
                      {v.desk}
                    </span>
                  </div>
                  <p className="text-xs font-mono text-[var(--accent)] mb-2">
                    {v.file}
                  </p>
                  <p className="text-sm text-[var(--muted)]">{v.ingest}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-[var(--muted)]">
              Full notes:{" "}
              <code className="font-mono">docs/exporters.md</code> ·{" "}
              <code className="font-mono">docs/vendor-packs/README.md</code>
            </p>
          </div>
        )}

        {tab === "docs" && <DocsPanel />}

        {tab === "settings" && (
          <div className="panel rounded-lg p-4 space-y-3 animate-fade-up">
            <h2 className="font-display text-xl tracking-wide">Settings</h2>
            <p className="text-sm text-[var(--muted)]">
              Local workstation prefs. No cloud keys required for the default
              operate path.
            </p>
            <pre className="text-xs font-mono bg-[var(--bg-0)] border border-[var(--line)] rounded-md p-3 overflow-auto">
              {JSON.stringify({ health, settings }, null, 2)}
            </pre>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  void fetch("/api/health")
                    .then((r) => r.json())
                    .then(setHealth);
                }}
              >
                Refresh health
              </Button>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-[var(--line)] py-3 text-center text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">
        Defensive localization · evidence vault · no exploits · no auto-merge
      </footer>
    </div>
  );
}
