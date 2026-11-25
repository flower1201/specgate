import { describe, expect, it } from "vitest";
import { parseSpecMarkdown } from "../src/core/parseSpec.js";

describe("parseSpecMarkdown", () => {
  it("extracts checklist items with MUST/SHOULD severity", () => {
    const doc = parseSpecMarkdown(
      `# Spec

## MUST
- [ ] MUST ship a README.md
- [x] MUST keep tests in tests/

## SHOULD
- [ ] SHOULD publish bilingual docs

## MAY
- [ ] MAY add HTML report
`,
      "/tmp/SPEC.md",
    );

    expect(doc.title).toBe("Spec");
    expect(doc.items.length).toBeGreaterThanOrEqual(4);

    const must = doc.items.filter((i) => i.severity === "MUST");
    const should = doc.items.filter((i) => i.severity === "SHOULD");
    const may = doc.items.filter((i) => i.severity === "MAY");

    expect(must.length).toBeGreaterThanOrEqual(2);
    expect(should.length).toBeGreaterThanOrEqual(1);
    expect(may.length).toBeGreaterThanOrEqual(1);
    expect(must.every((i) => i.required)).toBe(true);
  });

  it("parses Chinese severity markers", () => {
    const doc = parseSpecMarkdown(
      `# 验收

## 必须
- 必须：提供 \`ACCEPTANCE.md\`
- 应当：包含单元测试
`,
      "/tmp/ACCEPTANCE.md",
    );

    expect(doc.items.length).toBeGreaterThanOrEqual(2);
    expect(doc.items.some((i) => i.severity === "MUST")).toBe(true);
    expect(doc.items.some((i) => i.hints.includes("ACCEPTANCE.md"))).toBe(true);
  });
});
