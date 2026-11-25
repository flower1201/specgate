import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import {
  CONFIG_FILENAMES,
  DEFAULT_SPEC_CANDIDATES,
  findConfigPath,
} from "./config.js";

export interface DiscoverResult {
  root: string;
  configPath: string | null;
  specFiles: string[];
  contributingSections: string[];
  packageJson: boolean;
  git: boolean;
  notes: string[];
}

const CONTRIBUTING_SECTION_MARKERS = [
  /##\s+acceptance/i,
  /##\s+验收/i,
  /##\s+checklist/i,
  /##\s+definition of done/i,
  /##\s+DoD/i,
  /##\s+requirements?/i,
  /##\s+必须/i,
];

/**
 * Discover acceptance / SPEC documents and related project signals.
 */
export function discover(
  root: string,
  extraSpecFiles: string[] = [],
): DiscoverResult {
  const notes: string[] = [];
  const configPath = findConfigPath(root);
  if (configPath) notes.push(`Found config: ${relative(root, configPath)}`);

  const found = new Set<string>();

  for (const name of DEFAULT_SPEC_CANDIDATES) {
    const p = join(root, name);
    if (existsSync(p) && statSync(p).isFile()) {
      found.add(p);
    }
  }

  for (const extra of extraSpecFiles) {
    const p = join(root, extra);
    if (existsSync(p) && statSync(p).isFile()) {
      found.add(p);
    } else {
      notes.push(`Configured spec file missing: ${extra}`);
    }
  }

  // Scan shallow for *SPEC* / *ACCEPTANCE* markdown
  for (const entry of safeList(root)) {
    const lower = entry.toLowerCase();
    if (
      (lower.includes("spec") || lower.includes("acceptance")) &&
      (lower.endsWith(".md") || lower.endsWith(".markdown"))
    ) {
      const p = join(root, entry);
      if (statSync(p).isFile()) found.add(p);
    }
  }

  const contributing = join(root, "CONTRIBUTING.md");
  const contributingSections: string[] = [];
  if (existsSync(contributing)) {
    found.add(contributing);
    contributingSections.push(...detectContributingSections(contributing));
  }

  const specFiles = [...found].sort();
  if (specFiles.length === 0) {
    notes.push("No SPEC / ACCEPTANCE documents discovered.");
  }

  return {
    root,
    configPath,
    specFiles,
    contributingSections,
    packageJson: existsSync(join(root, "package.json")),
    git: existsSync(join(root, ".git")),
    notes,
  };
}

function safeList(dir: string): string[] {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

function detectContributingSections(path: string): string[] {
  const text = readFileSync(path, "utf8");
  const lines = text.split(/\r?\n/);
  const hits: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (CONTRIBUTING_SECTION_MARKERS.some((re) => re.test(line))) {
      hits.push(`L${i + 1}: ${line.trim()}`);
    }
  }
  return hits;
}

export function listConfigCandidates(): readonly string[] {
  return CONFIG_FILENAMES;
}
