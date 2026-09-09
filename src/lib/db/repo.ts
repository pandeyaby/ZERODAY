/**
 * Lightweight local settings store for the War Room UI.
 * File-based evidence vault lives under zeroday-reports/<run>/evidence/.
 */

import fs from "fs";
import path from "path";
import type { AppSettings } from "@/lib/types";

const DATA_DIR = process.env.ZERODAY_DATA_DIR || path.join(process.cwd(), "data");

const defaultSettings = (): AppSettings => ({
  llmProvider: "keyless",
  llmModel: "agent-operator",
  hasApiKeyConfigured: false,
  redactSecrets: true,
  theme: "warroom",
  pollingIntervalMs: 1500,
  llmBaseUrl: process.env.ANTARES_ENDPOINT,
});

type Store = { settings: AppSettings };

let memory: Store | null = null;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function jsonPath() {
  return path.join(DATA_DIR, "zeroday-settings.json");
}

function load(): Store {
  ensureDataDir();
  const p = jsonPath();
  if (!fs.existsSync(p)) {
    const s = { settings: defaultSettings() };
    fs.writeFileSync(p, JSON.stringify(s, null, 2));
    return s;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(p, "utf8")) as Partial<Store>;
    return { settings: { ...defaultSettings(), ...(raw.settings || {}) } };
  } catch {
    return { settings: defaultSettings() };
  }
}

function persist() {
  if (!memory) return;
  ensureDataDir();
  fs.writeFileSync(jsonPath(), JSON.stringify(memory, null, 2));
}

function store(): Store {
  if (!memory) memory = load();
  return memory;
}

export const dbRepo = {
  ready(): { backend: "json"; dataDir: string } {
    store();
    return { backend: "json", dataDir: DATA_DIR };
  },

  getSettings(): AppSettings {
    return { ...defaultSettings(), ...store().settings };
  },

  updateSettings(patch: Partial<AppSettings>): AppSettings {
    const s = store();
    s.settings = { ...defaultSettings(), ...s.settings, ...patch };
    persist();
    return { ...s.settings };
  },
};
