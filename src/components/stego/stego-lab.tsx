"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { Copy, FlaskConical } from "lucide-react";
import { useEffect, useState } from "react";

type TransformMeta = { id: string; name: string; category: string; reversible: boolean };

export function StegoLab() {
  const [transforms, setTransforms] = useState<TransformMeta[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState<string>("all");
  const [transformId, setTransformId] = useState("base64");
  const [text, setText] = useState("authorized staging canary — cisco/splunk purple team");
  const [output, setOutput] = useState("");
  const [tab, setTab] = useState<
    "transform" | "emoji" | "invisible" | "mutate" | "decode" | "promptcraft" | "tokenade" | "tokenizer"
  >("transform");
  const [carrier, setCarrier] = useState("🐍");
  const [cases, setCases] = useState<Array<{ id: number; strategy: string; output: string }>>([]);
  const [tokens, setTokens] = useState<Array<{ index: number; text: string; id: number }>>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetch("/api/stego")
      .then((r) => r.json())
      .then((j) => {
        setTransforms(j.transforms || []);
        setCategories(j.categories || []);
      });
  }, []);

  const filtered =
    category === "all" ? transforms : transforms.filter((t) => t.category === category);

  async function run(action: string, body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch("/api/stego", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...body }),
      });
      const json = await res.json();
      if (!res.ok) {
        setOutput(json.error || "Error");
        return json;
      }
      if (json.output !== undefined) setOutput(String(json.output));
      if (json.cases) setCases(json.cases);
      if (json.variants) {
        setOutput(json.variants.join("\n\n---\n\n"));
        setCases(json.variants.map((v: string, i: number) => ({ id: i + 1, strategy: "promptcraft", output: v })));
      }
      if (json.primary) {
        setOutput(json.primary.text);
        setCases([
          { id: 0, strategy: json.primary.method, output: json.primary.text },
          ...(json.alternatives || []).map(
            (a: { method: string; text: string }, i: number) => ({
              id: i + 1,
              strategy: a.method,
              output: a.text,
            })
          ),
        ]);
      }
      if (json.tokens) setTokens(json.tokens);
      return json;
    } finally {
      setBusy(false);
    }
  }

  async function copy(val: string) {
    await navigator.clipboard.writeText(val);
  }

  const tabs = [
    "transform",
    "emoji",
    "invisible",
    "mutate",
    "decode",
    "promptcraft",
    "tokenade",
    "tokenizer",
  ] as const;

  return (
    <div className="panel rounded-lg overflow-hidden animate-fade-up">
      <div className="panel-header">
        <div className="flex items-center gap-2">
          <FlaskConical size={16} className="text-[var(--accent)]" />
          <span className="font-display text-sm tracking-wide">Stego & Mutation Lab</span>
          <Badge tone="ok">P4RS3LT0NGV3</Badge>
        </div>
        <span className="text-[10px] text-[var(--muted)] uppercase tracking-wider">
          {transforms.length}+ transforms
        </span>
      </div>

      <div className="flex flex-wrap gap-1 px-3 pt-3 border-b border-[var(--line)]">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-3 py-2 text-[11px] uppercase tracking-wider border-b-2 -mb-px",
              tab === t
                ? "border-[var(--accent)] text-[var(--accent)]"
                : "border-transparent text-[var(--muted)]"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4 p-4">
        <div className="space-y-3">
          <label className="text-[10px] uppercase tracking-wider text-[var(--muted)]">Input</label>
          <Textarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-[140px]" />

          {tab === "transform" && (
            <>
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={() => setCategory("all")}
                  className={cn(
                    "text-[10px] uppercase px-2 py-1 rounded border",
                    category === "all" ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--line)] text-[var(--muted)]"
                  )}
                >
                  All
                </button>
                {categories.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCategory(c)}
                    className={cn(
                      "text-[10px] uppercase px-2 py-1 rounded border",
                      category === c ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--line)] text-[var(--muted)]"
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <select
                className="w-full rounded-md border border-[var(--line)] bg-[var(--bg-1)] px-3 py-2 text-sm"
                value={transformId}
                onChange={(e) => setTransformId(e.target.value)}
              >
                {filtered.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.category})
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <Button
                  disabled={busy}
                  onClick={() => void run("transform", { transformId, text, direction: "encode" })}
                >
                  Encode
                </Button>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => void run("transform", { transformId, text, direction: "decode" })}
                >
                  Decode
                </Button>
              </div>
            </>
          )}

          {tab === "emoji" && (
            <>
              <Input value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="Carrier emoji" />
              <div className="flex gap-2">
                <Button disabled={busy} onClick={() => void run("emoji", { text, carrier, direction: "encode" })}>
                  Encode
                </Button>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => void run("emoji", { text, direction: "decode" })}
                >
                  Decode
                </Button>
              </div>
            </>
          )}

          {tab === "invisible" && (
            <div className="flex gap-2">
              <Button
                disabled={busy}
                onClick={() => void run("invisible", { text, carrier: "Authorized note", direction: "encode" })}
              >
                Encode ZW
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void run("invisible", { text, direction: "decode" })}
              >
                Decode ZW
              </Button>
            </div>
          )}

          {tab === "mutate" && (
            <Button disabled={busy} onClick={() => void run("mutate", { text, count: 10 })}>
              Generate Mutations
            </Button>
          )}

          {tab === "decode" && (
            <Button disabled={busy} onClick={() => void run("decode", { text })}>
              Smart Decode
            </Button>
          )}

          {tab === "promptcraft" && (
            <div className="flex flex-wrap gap-2">
              {["paraphrase", "obfuscate", "roleplay", "technical"].map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void run("promptcraft", { prompt: text, strategy: s })}
                >
                  {s}
                </Button>
              ))}
            </div>
          )}

          {tab === "tokenade" && (
            <div className="space-y-2">
              <p className="text-xs text-[var(--warn)]">
                Lab stress tool only — can freeze UIs. Feather weight capped for safety.
              </p>
              <Button disabled={busy} onClick={() => void run("tokenade", { weight: "feather", carrier })}>
                Generate Tokenade
              </Button>
            </div>
          )}

          {tab === "tokenizer" && (
            <div className="flex gap-2">
              <Button disabled={busy} onClick={() => void run("tokenize", { text, engine: "words" })}>
                Words
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void run("tokenize", { text, engine: "cl100k_approx" })}
              >
                Approx BPE
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void run("tokenize", { text, engine: "utf8" })}
              >
                UTF-8
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-[10px] uppercase tracking-wider text-[var(--muted)]">Output</label>
            <Button size="sm" variant="ghost" onClick={() => void copy(output)} disabled={!output}>
              <Copy size={12} /> Copy
            </Button>
          </div>
          <Textarea value={output} readOnly className="min-h-[140px] font-mono text-xs" />

          {!!cases.length && (
            <div className="max-h-56 overflow-y-auto scrollbar-thin space-y-2">
              {cases.map((c) => (
                <div key={c.id} className="border border-[var(--line)] rounded-md p-2 text-xs">
                  <div className="text-[var(--muted)] mb-1">
                    #{c.id} · {c.strategy}
                  </div>
                  <div className="font-mono break-all line-clamp-3">{c.output}</div>
                </div>
              ))}
            </div>
          )}

          {tab === "tokenizer" && !!tokens.length && (
            <div className="flex flex-wrap gap-1 max-h-56 overflow-y-auto scrollbar-thin">
              {tokens.map((t) => (
                <span
                  key={`${t.index}-${t.id}`}
                  className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-[var(--line)] bg-[var(--bg-2)]"
                  title={`id ${t.id}`}
                >
                  {t.text === " " ? "␣" : t.text === "\n" ? "↵" : t.text}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
