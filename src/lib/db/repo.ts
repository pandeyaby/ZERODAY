/**
 * SQLite persistence for Evidence Vault, Missions, Findings, and events.
 * Falls back to in-memory if native module fails (build environments).
 */

import fs from "fs";
import path from "path";
import type {
  AppSettings,
  EvidenceRecord,
  Finding,
  Mission,
  OperatorEvent,
  OperatorState,
  RetestItem,
} from "@/lib/types";
import { nowIso, uid } from "@/lib/utils";

const DATA_DIR = process.env.ZERODAY_DATA_DIR || path.join(process.cwd(), "data");

type Store = {
  missions: Mission[];
  evidence: EvidenceRecord[];
  findings: Finding[];
  retests: RetestItem[];
  operators: OperatorState[];
  events: OperatorEvent[];
  settings: AppSettings;
};

const defaultSettings = (): AppSettings => ({
  llmProvider: "keyless",
  llmModel: "user-agent",
  hasApiKeyConfigured: Boolean(
    process.env.OPENROUTER_API_KEY ||
      process.env.ANTHROPIC_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.OLLAMA_HOST
  ),
  defaultToolMode: "safe_local",
  requireAuthorization: true,
  redactSecrets: true,
  theme: "warroom",
  pollingIntervalMs: 1500,
  llmBaseUrl: process.env.ZERODAY_LLM_BASE_URL,
  researchLibrariesEnabled: false,
  researchLibrariesAcknowledged: false,
  enabledResearchLibs: [],
  allowResearchContentReads: false,
  allowResearchExecution: false,
});

function emptyStore(): Store {
  return {
    missions: [],
    evidence: [],
    findings: [],
    retests: [],
    operators: [],
    events: [],
    settings: defaultSettings(),
  };
}

let memory: Store | null = null;
let db: import("better-sqlite3").Database | null = null;
let useSqlite = false;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function jsonPath() {
  return path.join(DATA_DIR, "zeroday-store.json");
}

function loadJson(): Store {
  ensureDataDir();
  const p = jsonPath();
  if (!fs.existsSync(p)) {
    const s = emptyStore();
    fs.writeFileSync(p, JSON.stringify(s, null, 2));
    return s;
  }
  try {
    return { ...emptyStore(), ...JSON.parse(fs.readFileSync(p, "utf8")) };
  } catch {
    return emptyStore();
  }
}

function saveJson(store: Store) {
  ensureDataDir();
  fs.writeFileSync(jsonPath(), JSON.stringify(store, null, 2));
}

function initSqlite(): boolean {
  try {
    // Dynamic require keeps Next edge builds from choking when optional.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require("better-sqlite3") as typeof import("better-sqlite3");
    ensureDataDir();
    const file = path.join(DATA_DIR, "zeroday.db");
    db = new Database(file);
    db.pragma("journal_mode = WAL");
    db.exec(`
      CREATE TABLE IF NOT EXISTS kv (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
    const row = db.prepare("SELECT value FROM kv WHERE key = ?").get("store") as
      | { value: string }
      | undefined;
    if (row?.value) {
      memory = { ...emptyStore(), ...JSON.parse(row.value) };
    } else {
      memory = emptyStore();
      persist();
    }
    useSqlite = true;
    return true;
  } catch {
    memory = loadJson();
    useSqlite = false;
    return false;
  }
}

function persist() {
  if (!memory) return;
  if (useSqlite && db) {
    db.prepare(
      "INSERT INTO kv(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    ).run("store", JSON.stringify(memory));
  } else {
    saveJson(memory);
  }
}

function store(): Store {
  if (!memory) initSqlite();
  return memory!;
}

/** Public repository API */
export const dbRepo = {
  ready(): { backend: "sqlite" | "json"; dataDir: string } {
    store();
    return { backend: useSqlite ? "sqlite" : "json", dataDir: DATA_DIR };
  },

  getSettings(): AppSettings {
    return { ...defaultSettings(), ...store().settings };
  },

  updateSettings(patch: Partial<AppSettings>): AppSettings {
    const s = store();
    const next: AppSettings = { ...defaultSettings(), ...s.settings, ...patch };
    // Harden research gates: enabling content/exec requires master enable + ack
    if (next.allowResearchContentReads || next.allowResearchExecution) {
      if (!next.researchLibrariesEnabled || !next.researchLibrariesAcknowledged) {
        next.allowResearchContentReads = false;
        next.allowResearchExecution = false;
      }
    }
    if (!Array.isArray(next.enabledResearchLibs)) next.enabledResearchLibs = [];
    next.enabledResearchLibs = next.enabledResearchLibs.filter((id) =>
      ["g0dm0d3", "cl4r1t4s", "l1b3rt4s", "obliteratus"].includes(id)
    );
    s.settings = next;
    persist();
    return { ...s.settings };
  },

  listMissions(): Mission[] {
    return [...store().missions].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  getMission(id: string): Mission | undefined {
    return store().missions.find((m) => m.id === id);
  },

  saveMission(mission: Mission): Mission {
    const s = store();
    const idx = s.missions.findIndex((m) => m.id === mission.id);
    if (idx >= 0) s.missions[idx] = mission;
    else s.missions.push(mission);
    persist();
    return mission;
  },

  deleteMission(id: string): boolean {
    const s = store();
    const before = s.missions.length;
    s.missions = s.missions.filter((m) => m.id !== id);
    s.evidence = s.evidence.filter((e) => e.missionId !== id);
    s.findings = s.findings.filter((f) => f.missionId !== id);
    s.operators = s.operators.filter((o) => o.missionId !== id);
    s.events = s.events.filter((e) => e.missionId !== id);
    s.retests = s.retests.filter((r) => r.missionId !== id);
    persist();
    return s.missions.length < before;
  },

  listEvidence(missionId?: string): EvidenceRecord[] {
    const all = store().evidence;
    return (missionId ? all.filter((e) => e.missionId === missionId) : all).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );
  },

  getEvidence(id: string): EvidenceRecord | undefined {
    return store().evidence.find((e) => e.id === id);
  },

  saveEvidence(rec: EvidenceRecord): EvidenceRecord {
    store().evidence.push(rec);
    persist();
    return rec;
  },

  listFindings(missionId?: string): Finding[] {
    const all = store().findings;
    return (missionId ? all.filter((f) => f.missionId === missionId) : all).sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt)
    );
  },

  getFinding(id: string): Finding | undefined {
    return store().findings.find((f) => f.id === id);
  },

  saveFinding(finding: Finding): Finding {
    const s = store();
    const idx = s.findings.findIndex((f) => f.id === finding.id);
    if (idx >= 0) s.findings[idx] = finding;
    else s.findings.push(finding);
    persist();
    return finding;
  },

  listRetests(missionId?: string): RetestItem[] {
    const all = store().retests;
    return (missionId ? all.filter((r) => r.missionId === missionId) : all).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );
  },

  saveRetest(item: RetestItem): RetestItem {
    const s = store();
    const idx = s.retests.findIndex((r) => r.id === item.id);
    if (idx >= 0) s.retests[idx] = item;
    else s.retests.push(item);
    persist();
    return item;
  },

  listOperators(missionId?: string): OperatorState[] {
    const all = store().operators;
    return missionId ? all.filter((o) => o.missionId === missionId) : all;
  },

  saveOperator(op: OperatorState): OperatorState {
    const s = store();
    const idx = s.operators.findIndex((o) => o.id === op.id);
    if (idx >= 0) s.operators[idx] = op;
    else s.operators.push(op);
    persist();
    return op;
  },

  appendEvent(event: Omit<OperatorEvent, "id" | "createdAt"> & { id?: string; createdAt?: string }): OperatorEvent {
    const full: OperatorEvent = {
      id: event.id || uid("evt"),
      createdAt: event.createdAt || nowIso(),
      missionId: event.missionId,
      operatorRole: event.operatorRole,
      type: event.type,
      message: event.message,
      meta: event.meta,
    };
    store().events.push(full);
    // Cap event log per process store
    if (store().events.length > 5000) {
      store().events = store().events.slice(-4000);
    }
    persist();
    return full;
  },

  listEvents(missionId?: string, limit = 200): OperatorEvent[] {
    const all = store().events;
    const filtered = missionId ? all.filter((e) => e.missionId === missionId) : all;
    return filtered.slice(-limit).reverse();
  },

  /** Seed helper for example missions — only if empty. */
  seedIfEmpty(missions: Mission[], evidence: EvidenceRecord[], findings: Finding[]) {
    const s = store();
    if (s.missions.length > 0) return false;
    s.missions.push(...missions);
    s.evidence.push(...evidence);
    s.findings.push(...findings);
    persist();
    return true;
  },
};
