import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";
import { z } from "zod";
import type { LangMode, SpecgateConfig } from "../types.js";

const LangSchema = z.enum(["en", "zh", "both"]);

export const SpecgateConfigSchema = z.object({
  specFiles: z.array(z.string()).default([]),
  base: z.string().default("HEAD~1"),
  outDir: z.string().default(".specgate-out"),
  strict: z.boolean().default(false),
  lang: LangSchema.default("both"),
  requireEvidenceForMust: z.boolean().default(true),
  ignoreGlobs: z.array(z.string()).default([
    "node_modules/**",
    "dist/**",
    ".git/**",
    "coverage/**",
  ]),
  testCommands: z.array(z.string()).default([]),
  extraHints: z.record(z.array(z.string())).default({}),
});

export type RawSpecgateConfig = z.infer<typeof SpecgateConfigSchema>;

export const DEFAULT_SPEC_CANDIDATES = [
  "SPEC.md",
  "ACCEPTANCE.md",
  "AGENTS.md",
  "CONTRIBUTING.md",
  "docs/SPEC.md",
  "docs/ACCEPTANCE.md",
  ".specgate/SPEC.md",
] as const;

export const CONFIG_FILENAMES = [
  ".specgate.yml",
  ".specgate.yaml",
  "specgate.yml",
  "specgate.yaml",
] as const;

export function defaultConfig(
  overrides: Partial<SpecgateConfig> = {},
): SpecgateConfig {
  const parsed = SpecgateConfigSchema.parse(overrides);
  return {
    ...parsed,
    lang: parsed.lang as LangMode,
  };
}

export function findConfigPath(root: string): string | null {
  for (const name of CONFIG_FILENAMES) {
    const p = join(root, name);
    if (existsSync(p)) return p;
  }
  return null;
}

export function loadConfigFile(root: string): Partial<SpecgateConfig> {
  const path = findConfigPath(root);
  if (!path) return {};

  const raw = readFileSync(path, "utf8");
  const data = yaml.load(raw);
  if (data == null || typeof data !== "object") {
    throw new Error(`Invalid YAML config: ${path}`);
  }

  const result = SpecgateConfigSchema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Config validation failed (${path}): ${issues}`);
  }

  return result.data;
}

export function resolveConfig(
  root: string,
  cli: Partial<SpecgateConfig> = {},
): SpecgateConfig {
  const file = loadConfigFile(root);
  return defaultConfig({
    ...file,
    ...Object.fromEntries(
      Object.entries(cli).filter(([, v]) => v !== undefined),
    ),
  });
}

export function renderInitConfig(): string {
  return `# specgate — local acceptance / SPEC gate
# Docs: https://github.com/flower1201/specgate

# Additional / override SPEC sources (relative to project root)
specFiles: []

# Git base ref for diff evidence
base: HEAD~1

# Report output directory
outDir: .specgate-out

# Treat SHOULD failures as gate failures
strict: false

# Report language: en | zh | both
lang: both

# MUST items require matching evidence
requireEvidenceForMust: true

ignoreGlobs:
  - node_modules/**
  - dist/**
  - .git/**
  - coverage/**

# Optional: commands that indicate a test runner (informational)
testCommands: []

# Map item id / keyword → extra match hints
extraHints: {}
`;
}
