import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import type { EvidenceBundle, EvidenceItem, SpecgateConfig } from "../types.js";

/**
 * Collect local evidence: git diff, file presence, and test signals.
 * Fully offline — never calls network services.
 */
export function collectEvidence(
  root: string,
  config: SpecgateConfig,
): EvidenceBundle {
  const collectedAt = new Date().toISOString();
  const files = walkFiles(root, config.ignoreGlobs);
  const git = collectGit(root, config.base);
  const tests = collectTests(root, files);

  const items: EvidenceItem[] = [];
  let seq = 0;

  if (git.available) {
    for (const f of git.changedFiles) {
      seq += 1;
      items.push({
        id: `ev-git-${seq}`,
        kind: "git-diff",
        summary: `Changed file: ${f}`,
        summaryZh: `变更文件：${f}`,
        path: f,
        detail: git.diffStat,
        weight: 0.7,
        relatedHints: hintifyPath(f),
      });
    }
  }

  for (const f of files) {
    const rel = relative(root, f).split(sep).join("/");
    // Prefer meaningful project files
    if (!isMeaningfulFile(rel)) continue;
    seq += 1;
    items.push({
      id: `ev-file-${seq}`,
      kind: "file-presence",
      summary: `Present: ${rel}`,
      summaryZh: `文件存在：${rel}`,
      path: rel,
      weight: 0.45,
      relatedHints: hintifyPath(rel),
    });
  }

  if (tests.detected) {
    seq += 1;
    items.push({
      id: `ev-test-${seq}`,
      kind: "test-result",
      summary: tests.summary || `Test runner detected: ${tests.runner}`,
      summaryZh: tests.summary
        ? `测试信号：${tests.summary}`
        : `检测到测试运行器：${tests.runner}`,
      weight: tests.passed === false ? 0.2 : 0.85,
      relatedHints: ["test", "tests", "vitest", "jest", "测试", ...tests.files],
    });
    for (const tf of tests.files) {
      seq += 1;
      items.push({
        id: `ev-testfile-${seq}`,
        kind: "test-result",
        summary: `Test file: ${tf}`,
        summaryZh: `测试文件：${tf}`,
        path: tf,
        weight: 0.6,
        relatedHints: hintifyPath(tf),
      });
    }
  }

  // Config presence as soft evidence
  for (const name of [".specgate.yml", "package.json", "LICENSE", "README.md"]) {
    if (existsSync(join(root, name))) {
      seq += 1;
      items.push({
        id: `ev-cfg-${seq}`,
        kind: "config",
        summary: `Config/doc present: ${name}`,
        summaryZh: `配置/文档存在：${name}`,
        path: name,
        weight: 0.35,
        relatedHints: hintifyPath(name),
      });
    }
  }

  // Lightweight content sniff for key docs (offline keyword evidence)
  for (const name of ["README.md", "README.zh-CN.md", "ACCEPTANCE.md", "SPEC.md", "AGENTS.md"]) {
    const p = join(root, name);
    if (!existsSync(p)) continue;
    try {
      const text = readFileSync(p, "utf8").slice(0, 8000).toLowerCase();
      const keywords = [
        "bilingual",
        "中文",
        "offline",
        "html",
        "acceptance",
        "specgate",
        "test",
        "license",
        "mit",
      ].filter((k) => text.includes(k.toLowerCase()));
      if (keywords.length === 0) continue;
      seq += 1;
      items.push({
        id: `ev-doc-${seq}`,
        kind: "manual",
        summary: `Doc keywords in ${name}: ${keywords.join(", ")}`,
        summaryZh: `文档关键词（${name}）：${keywords.join(", ")}`,
        path: name,
        weight: 0.55,
        relatedHints: [...hintifyPath(name), ...keywords],
      });
    } catch {
      /* ignore */
    }
  }

  return {
    root,
    collectedAt,
    git,
    files: files.map((f) => relative(root, f).split(sep).join("/")),
    tests,
    items,
  };
}

function collectGit(
  root: string,
  base: string,
): NonNullable<EvidenceBundle["git"]> {
  if (!existsSync(join(root, ".git"))) {
    return { available: false, changedFiles: [] };
  }

  try {
    const head = runGit(root, ["rev-parse", "--abbrev-ref", "HEAD"]).trim();
    let changedFiles: string[] = [];
    let diffStat: string | undefined;

    // Prefer base...HEAD; fall back to working tree status
    try {
      const out = runGit(root, [
        "diff",
        "--name-only",
        `${base}...HEAD`,
      ]);
      changedFiles = out
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);
      diffStat = runGit(root, ["diff", "--stat", `${base}...HEAD`]).trim();
    } catch {
      const status = runGit(root, ["status", "--porcelain"]);
      changedFiles = status
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => l.replace(/^\S+\s+/, "").replace(/^.* -> /, ""));
      diffStat = status.trim() || undefined;
    }

    // Also include unstaged/staged if empty range
    if (changedFiles.length === 0) {
      const status = runGit(root, ["status", "--porcelain"]);
      const more = status
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => l.replace(/^\S+\s+/, "").replace(/^.* -> /, ""));
      changedFiles = [...new Set([...changedFiles, ...more])];
    }

    return {
      available: true,
      base,
      head,
      changedFiles,
      diffStat,
    };
  } catch {
    return { available: false, changedFiles: [] };
  }
}

function runGit(root: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 15_000,
  });
}

function collectTests(
  root: string,
  files: string[],
): EvidenceBundle["tests"] {
  const rels = files.map((f) => relative(root, f).split(sep).join("/"));
  const testFiles = rels.filter(
    (f) =>
      /(^|\/)(tests?|__tests__)(\/|$)/i.test(f) ||
      /\.(test|spec)\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(f),
  );

  let runner: string | undefined;
  let detected = testFiles.length > 0;

  const pkgPath = join(root, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
        scripts?: Record<string, string>;
        devDependencies?: Record<string, string>;
        dependencies?: Record<string, string>;
      };
      const deps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
      };
      if (deps.vitest) runner = "vitest";
      else if (deps.jest) runner = "jest";
      else if (deps.mocha) runner = "mocha";
      else if (pkg.scripts?.test) runner = "npm-test";

      if (runner) detected = true;
    } catch {
      /* ignore */
    }
  }

  return {
    detected,
    runner,
    passed: detected ? undefined : undefined,
    summary: detected
      ? `Found ${testFiles.length} test file(s)${runner ? ` via ${runner}` : ""}`
      : undefined,
    files: testFiles,
  };
}

function walkFiles(root: string, ignoreGlobs: string[]): string[] {
  const out: string[] = [];

  function walk(dir: string): void {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      if (name === ".git" || name === "node_modules" || name === "dist") continue;
      const full = join(dir, name);
      const rel = relative(root, full).split(sep).join("/");
      if (matchesIgnore(rel, ignoreGlobs)) continue;
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) walk(full);
      else if (st.isFile()) out.push(full);
    }
  }

  walk(root);
  return out;
}

function matchesIgnore(rel: string, globs: string[]): boolean {
  for (const g of globs) {
    if (globMatch(g, rel) || globMatch(g, rel.replace(/^\.\//, ""))) return true;
  }
  return false;
}

/** Minimal glob: ** / * and suffix patterns. */
export function globMatch(pattern: string, value: string): boolean {
  const esc = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "§§")
    .replace(/\*/g, "[^/]*")
    .replace(/§§/g, ".*");
  return new RegExp(`^${esc}$`, "i").test(value);
}

function hintifyPath(p: string): string[] {
  const parts = p.split(/[\\/]/).filter(Boolean);
  const base = parts[parts.length - 1] || p;
  const stem = base.replace(/\.[^.]+$/, "");
  return [
    p.toLowerCase(),
    base.toLowerCase(),
    stem.toLowerCase(),
    ...parts.map((x) => x.toLowerCase()),
  ];
}

function isMeaningfulFile(rel: string): boolean {
  if (rel.startsWith(".")) {
    return (
      rel === ".specgate.yml" ||
      rel === ".specgate.yaml" ||
      rel.startsWith(".github/")
    );
  }
  return /\.(md|ts|tsx|js|jsx|mjs|cjs|json|yml|yaml|toml)$/i.test(rel);
}

export function evidenceById(
  bundle: EvidenceBundle,
): Map<string, EvidenceItem> {
  return new Map(bundle.items.map((i) => [i.id, i]));
}
