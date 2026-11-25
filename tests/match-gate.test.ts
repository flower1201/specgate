import { describe, expect, it } from "vitest";
import { defaultConfig } from "../src/core/config.js";
import { evaluateGate } from "../src/core/gate.js";
import { matchItems } from "../src/core/match.js";
import { parseSpecMarkdown } from "../src/core/parseSpec.js";
import type { EvidenceBundle } from "../src/types.js";

function fakeEvidence(root: string): EvidenceBundle {
  return {
    root,
    collectedAt: new Date().toISOString(),
    git: {
      available: true,
      base: "HEAD~1",
      head: "main",
      changedFiles: ["README.md", "src/cli.ts", "tests/parseSpec.test.ts"],
    },
    files: [
      "README.md",
      "ACCEPTANCE.md",
      ".specgate.yml",
      "tests/parseSpec.test.ts",
      "src/cli.ts",
    ],
    tests: {
      detected: true,
      runner: "vitest",
      summary: "Found 1 test file(s) via vitest",
      files: ["tests/parseSpec.test.ts"],
    },
    items: [
      {
        id: "ev-1",
        kind: "file-presence",
        summary: "Present: README.md",
        path: "README.md",
        weight: 0.5,
        relatedHints: ["readme.md", "readme"],
      },
      {
        id: "ev-2",
        kind: "test-result",
        summary: "Test file: tests/parseSpec.test.ts",
        path: "tests/parseSpec.test.ts",
        weight: 0.8,
        relatedHints: ["tests", "test", "parsespec"],
      },
      {
        id: "ev-3",
        kind: "git-diff",
        summary: "Changed file: README.md",
        path: "README.md",
        weight: 0.7,
        relatedHints: ["readme.md"],
      },
      {
        id: "ev-4",
        kind: "config",
        summary: "Config/doc present: .specgate.yml",
        path: ".specgate.yml",
        weight: 0.4,
        relatedHints: [".specgate.yml", "specgate"],
      },
    ],
  };
}

describe("match + gate", () => {
  it("passes when evidence covers MUST items", () => {
    const doc = parseSpecMarkdown(
      `# A
## MUST
- [ ] MUST provide a README.md
- [ ] MUST include tests under tests/
- [ ] MUST keep .specgate.yml
`,
      "/demo/ACCEPTANCE.md",
    );
    const evidence = fakeEvidence("/demo");
    const cfg = defaultConfig({ strict: false });
    const matches = matchItems(doc.items, evidence, cfg);
    expect(matches.every((m) => m.status === "pass")).toBe(true);

    const gate = evaluateGate([doc], evidence, cfg);
    expect(gate.status).toBe("pass");
    expect(gate.exitCode).toBe(0);
  });

  it("exits 2 when required items lack evidence", () => {
    const doc = parseSpecMarkdown(
      `# A
## MUST
- [ ] MUST deploy to kubernetes-cluster-xyz-production
- [ ] MUST rotate HSM keys nightly
`,
      "/demo/ACCEPTANCE.md",
    );
    const evidence = fakeEvidence("/demo");
    const cfg = defaultConfig({ strict: true });
    const gate = evaluateGate([doc], evidence, cfg);
    expect(gate.summary.failed).toBeGreaterThanOrEqual(1);
    expect(gate.exitCode).toBe(2);
    expect(gate.status).toBe("fail");
  });
});
