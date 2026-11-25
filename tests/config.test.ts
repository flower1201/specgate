import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  defaultConfig,
  loadConfigFile,
  resolveConfig,
} from "../src/core/config.js";

const roots: string[] = [];

afterEach(() => {
  for (const r of roots.splice(0)) {
    rmSync(r, { recursive: true, force: true });
  }
});

describe("config", () => {
  it("applies zod defaults", () => {
    const cfg = defaultConfig({});
    expect(cfg.lang).toBe("both");
    expect(cfg.strict).toBe(false);
    expect(cfg.requireEvidenceForMust).toBe(true);
    expect(cfg.outDir).toBe(".specgate-out");
  });

  it("loads and validates .specgate.yml", () => {
    const root = join(tmpdir(), `specgate-cfg-${Date.now()}`);
    roots.push(root);
    mkdirSync(root, { recursive: true });
    writeFileSync(
      join(root, ".specgate.yml"),
      `strict: true\nlang: zh\nbase: HEAD~2\noutDir: reports\n`,
      "utf8",
    );

    const loaded = loadConfigFile(root);
    expect(loaded.strict).toBe(true);
    expect(loaded.lang).toBe("zh");

    const resolved = resolveConfig(root, { lang: "en" });
    expect(resolved.lang).toBe("en");
    expect(resolved.strict).toBe(true);
    expect(resolved.base).toBe("HEAD~2");
  });
});
