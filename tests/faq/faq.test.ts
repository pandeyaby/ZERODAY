import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  FAQ_ITEMS,
  FAQ_INTRO,
  faqQuestions,
  faqToMarkdown,
} from "../../src/faq/content.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("FAQ (Keyless Strength honesty)", () => {
  it("covers required skepticism questions", () => {
    const qs = faqQuestions().join("\n");
    assert.match(qs, /Does keyless mean a local AI agent/i);
    assert.match(qs, /How does keyless .+find/i);
    assert.match(qs, /useless without Antares/i);
    assert.match(qs, /verify that a CWE is present/i);
    assert.match(qs, /Fixture vs rules vs ingest vs recording vs live/i);
    assert.match(qs, /Desk do at \$0 without locate/i);
    assert.match(qs, /Ollama|Antares File F1/i);
    assert.match(qs, /localization exploitability/i);
    assert.match(qs, /Splunk|Security Hub/i);
    assert.match(qs, /partner product/i);
    assert.match(qs, /PoC/i);
    assert.match(qs, /Hugging Face|Antares weights/i);
    assert.match(qs, /stranger trust loop/i);
    assert.ok(FAQ_ITEMS.length >= 10, "expected expanded FAQ");
  });

  it("docs/faq.md matches shared src/faq/content.ts", () => {
    const disk = fs.readFileSync(path.join(root, "docs/faq.md"), "utf8");
    const generated = faqToMarkdown();
    assert.equal(
      disk,
      generated,
      "docs/faq.md drifted from src/faq/content.ts — regenerate with faqToMarkdown()",
    );
    assert.match(disk, /Keyless Strength/i);
    assert.match(disk, /Not a Cisco product/i);
    assert.equal(disk.includes(FAQ_INTRO), true);
  });

  it("rejects stale keyless=operate-only framing", () => {
    const disk = fs.readFileSync(path.join(root, "docs/faq.md"), "utf8");
    const blob = FAQ_ITEMS.map((i) => JSON.stringify(i)).join("\n");
    // Old FAQ said keyless = coding agent operate only
    assert.doesNotMatch(
      disk,
      /operate` uses the coding agent already running the tool\. No Antares HF token/i,
    );
    assert.match(disk, /one door, not the definition of keyless/i);
    assert.match(blob, /separate coding-agent path/i);
    assert.match(disk, /locate --rules/);
    assert.match(disk, /from-sarif/);
    assert.match(disk, /inventory/);
  });

  it("doors table names fixture, rules, ingest, recording, live", () => {
    const doors = FAQ_ITEMS.find((i) => i.id === "doors-table");
    assert.ok(doors);
    const table = doors!.answer.find((b) => b.type === "table");
    assert.ok(table && table.type === "table");
    if (table && table.type === "table") {
      const joined = table.rows.map((r) => r.join(" ")).join("\n");
      assert.match(joined, /Fixture/);
      assert.match(joined, /Rules/);
      assert.match(joined, /SARIF ingest|ingest/i);
      assert.match(joined, /recording/i);
      assert.match(joined, /Live/);
    }
  });

  it("play UI wires FaqPanel + FAQ tab", () => {
    const panel = fs.readFileSync(
      path.join(root, "src/components/operator/org-usage-panel.tsx"),
      "utf8",
    );
    const faq = fs.readFileSync(
      path.join(root, "src/components/operator/faq-panel.tsx"),
      "utf8",
    );
    assert.match(panel, /FaqPanel/);
    assert.match(panel, /"faq"/);
    assert.match(faq, /FAQ_ITEMS/);
    assert.match(faq, /data-testid="faq-panel"/);
  });

  it("README links FAQ near How it works / Honesty", () => {
    const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
    assert.match(readme, /docs\/faq\.md/);
    const howIdx = readme.indexOf("## How it works");
    const honestyIdx = readme.indexOf("## Honesty");
    const faqNearHow = readme.indexOf("docs/faq.md", howIdx);
    const faqNearHonesty = readme.lastIndexOf("docs/faq.md");
    assert.ok(howIdx >= 0 && honestyIdx > howIdx);
    assert.ok(faqNearHow > howIdx && faqNearHow < honestyIdx + 800);
    assert.ok(faqNearHonesty > honestyIdx);
    assert.match(readme, /npm run play.*FAQ|play UI.*FAQ/i);
  });
});
