import { describe, expect, it } from "vitest";
import { defaultConfig } from "../src/core/config.js";
import { evaluateGate } from "../src/core/gate.js";
import { parseSpecMarkdown } from "../src/core/parseSpec.js";
import { toHtmlReport } from "../src/reports/htmlReport.js";
import { toJsonReport } from "../src/reports/jsonReport.js";
import { toMarkdownReport } from "../src/reports/mdReport.js";
import type { EvidenceBundle } from "../src/types.js";

const evidence: EvidenceBundle = {
  root: "/proj",
  collectedAt: "2026-01-01T00:00:00.000Z",
  git: { available: false, changedFiles: [] },
  files: ["README.md"],
  tests: { detected: false, files: [] },
  items: [
    {
      id: "ev-1",
      kind: "file-presence",
      summary: "Present: README.md",
      summaryZh: "文件存在：README.md",
      path: "README.md",
      weight: 0.5,
      relatedHints: ["readme.md"],
    },
  ],
};

describe("reports", () => {
  it("emits bilingual JSON / Markdown / HTML", () => {
    const doc = parseSpecMarkdown(
      `# Spec\n## MUST\n- [ ] MUST provide a README.md\n`,
      "/proj/SPEC.md",
    );
    const gate = evaluateGate([doc], evidence, defaultConfig());

    const json = toJsonReport(gate, "both");
    expect(json).toContain('"tool": "specgate"');
    expect(json).toContain("rationaleZh");

    const md = toMarkdownReport(gate, "both");
    expect(md).toContain("SpecGate Report");
    expect(md).toContain("SpecGate 门禁报告");

    const html = toHtmlReport(gate, "both");
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("specgate@0.1.0-rc.1");
    expect(html).toContain("门禁");
  });
});
