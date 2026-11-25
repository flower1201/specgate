import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { discover } from "../src/core/discover.js";

const roots: string[] = [];

afterEach(() => {
  for (const r of roots.splice(0)) {
    rmSync(r, { recursive: true, force: true });
  }
});

describe("discover", () => {
  it("finds SPEC.md, ACCEPTANCE.md, and config", () => {
    const root = join(tmpdir(), `specgate-disc-${Date.now()}`);
    roots.push(root);
    mkdirSync(root, { recursive: true });
    writeFileSync(join(root, "SPEC.md"), "# Spec\n", "utf8");
    writeFileSync(join(root, "ACCEPTANCE.md"), "# Acc\n", "utf8");
    writeFileSync(join(root, ".specgate.yml"), "strict: false\n", "utf8");
    writeFileSync(join(root, "package.json"), "{}\n", "utf8");

    const d = discover(root);
    expect(d.configPath).toContain(".specgate.yml");
    expect(d.packageJson).toBe(true);
    expect(d.specFiles.some((f) => f.endsWith("SPEC.md"))).toBe(true);
    expect(d.specFiles.some((f) => f.endsWith("ACCEPTANCE.md"))).toBe(true);
  });
});
