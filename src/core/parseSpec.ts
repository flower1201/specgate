import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import type { ItemKind, Severity, SpecDocument, SpecItem } from "../types.js";

const CHECKLIST_RE =
  /^\s*(?:[-*+]|\d+[.)])\s+\[([ xX])\]\s+(.+?)\s*$/;
const BULLET_RE = /^\s*(?:[-*+]|\d+[.)])\s+(?!\[[ xX]\])(.+?)\s*$/;
const MUST_INLINE_RE =
  /\b(MUST(?:\s+NOT)?|SHOULD(?:\s+NOT)?|MAY|REQUIRED|RECOMMENDED|OPTIONAL)\b/i;
const ZH_SEVERITY_RE = /(必须|禁止|应当|不应|建议|可选)/;
const RULE_LINE_RE =
  /^\s*(?:[-*+]|\d+[.)]|#{1,6})?\s*(?:(?<sev>MUST(?:\s+NOT)?|SHOULD(?:\s+NOT)?|MAY|REQUIRED|RECOMMENDED|OPTIONAL)|(?<zsev>必须|禁止|应当|不应|建议|可选))\s*[:：]?\s*(?<body>.+?)\s*$/i;

const HINT_TOKEN_RE =
  /`([^`]+)`|"([^"]+)"|'([^']+)'|([A-Za-z0-9_./*-]+\.(?:ts|tsx|js|jsx|mjs|cjs|py|go|rs|md|yml|yaml|json))/g;

/**
 * Parse a single markdown acceptance / SPEC document into structured items.
 */
export function parseSpecFile(path: string): SpecDocument {
  const raw = readFileSync(path, "utf8");
  return parseSpecMarkdown(raw, path);
}

export function parseSpecMarkdown(raw: string, path: string): SpecDocument {
  const lines = raw.split(/\r?\n/);
  const title = extractTitle(lines) || basename(path);
  const items: SpecItem[] = [];
  const seen = new Set<string>();

  let inAcceptanceSection = false;
  let sectionBoost: Severity | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const lineNo = i + 1;

    const heading = line.match(/^#{1,6}\s+(.+)/);
    if (heading) {
      const h = heading[1]!.trim();
      inAcceptanceSection = /acceptance|checklist|definition of done|dod|验收|检查|必须|requirements?/i.test(
        h,
      );
      if (/must|必须|required/i.test(h)) sectionBoost = "MUST";
      else if (/should|应当|建议/i.test(h)) sectionBoost = "SHOULD";
      else if (/may|可选|optional/i.test(h)) sectionBoost = "MAY";
      else sectionBoost = null;
      continue;
    }

    const checklist = line.match(CHECKLIST_RE);
    if (checklist) {
      const checked = checklist[1]!.toLowerCase() === "x";
      const text = checklist[2]!.trim();
      const item = buildItem({
        text,
        path,
        lineNo,
        kind: "checklist",
        severity: inferSeverity(text, sectionBoost),
        hints: extractHints(text),
        requiredOverride: inferSeverity(text, sectionBoost) === "MUST",
        checked,
      });
      pushUnique(items, seen, item);
      continue;
    }

    const rule = line.match(RULE_LINE_RE);
    if (rule?.groups) {
      const sevRaw = rule.groups.sev || rule.groups.zsev || "";
      const body = (rule.groups.body || "").trim();
      if (body.length >= 3) {
        const severity = normalizeSeverity(sevRaw, sectionBoost);
        const item = buildItem({
          text: body,
          path,
          lineNo,
          kind: "rule",
          severity,
          hints: extractHints(body),
          requiredOverride: severity === "MUST",
        });
        pushUnique(items, seen, item);
        continue;
      }
    }

    // Bullets inside acceptance sections without explicit severity
    if (inAcceptanceSection) {
      const bullet = line.match(BULLET_RE);
      if (bullet) {
        const text = bullet[1]!.trim();
        if (text.length < 4) continue;
        if (/^#{1,6}/.test(text)) continue;
        const severity = inferSeverity(text, sectionBoost ?? "SHOULD");
        const item = buildItem({
          text,
          path,
          lineNo,
          kind: "checklist",
          severity,
          hints: extractHints(text),
          requiredOverride: severity === "MUST",
        });
        pushUnique(items, seen, item);
      }
    }
  }

  return {
    path,
    title,
    items,
    rawLength: raw.length,
  };
}

export function parseMany(paths: string[]): SpecDocument[] {
  return paths.map(parseSpecFile);
}

function extractTitle(lines: string[]): string | null {
  for (const line of lines.slice(0, 40)) {
    const m = line.match(/^#\s+(.+)/);
    if (m) return m[1]!.trim();
  }
  return null;
}

function inferSeverity(text: string, boost: Severity | null): Severity {
  const m = text.match(MUST_INLINE_RE) || text.match(ZH_SEVERITY_RE);
  if (m) return normalizeSeverity(m[1] || m[0]!, boost);
  if (boost) return boost;
  if (/required|必须|禁止/i.test(text)) return "MUST";
  if (/recommend|建议|应当/i.test(text)) return "SHOULD";
  return "SHOULD";
}

function normalizeSeverity(raw: string, boost: Severity | null): Severity {
  const s = raw.trim().toUpperCase();
  if (
    s === "MUST" ||
    s === "MUST NOT" ||
    s === "REQUIRED" ||
    raw === "必须" ||
    raw === "禁止"
  ) {
    return "MUST";
  }
  if (
    s === "SHOULD" ||
    s === "SHOULD NOT" ||
    s === "RECOMMENDED" ||
    raw === "应当" ||
    raw === "不应" ||
    raw === "建议"
  ) {
    return "SHOULD";
  }
  if (s === "MAY" || s === "OPTIONAL" || raw === "可选") return "MAY";
  return boost ?? "SHOULD";
}

function extractHints(text: string): string[] {
  const hints = new Set<string>();
  for (const match of text.matchAll(HINT_TOKEN_RE)) {
    const token = match[1] || match[2] || match[3] || match[4];
    if (token && token.length >= 2) hints.add(token);
  }
  // Keyword stems for matching
  const keywords = text
    .replace(/[`"'*_~]/g, " ")
    .split(/[\s,;:：、/\\|()[\]{}]+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 4 && /[A-Za-z\u4e00-\u9fff]/.test(w))
    .slice(0, 8);
  for (const k of keywords) hints.add(k.toLowerCase());
  return [...hints];
}

function shortId(path: string, line: number, text: string): string {
  const h = createHash("sha1")
    .update(`${path}:${line}:${text}`)
    .digest("hex")
    .slice(0, 8);
  return `sg-${h}`;
}

function buildItem(opts: {
  text: string;
  path: string;
  lineNo: number;
  kind: ItemKind;
  severity: Severity;
  hints: string[];
  requiredOverride: boolean;
  checked?: boolean;
}): SpecItem {
  const { text, path, lineNo, kind, severity, hints, requiredOverride } = opts;
  return {
    id: shortId(path, lineNo, text),
    text,
    severity,
    kind,
    sourceFile: path,
    sourceLine: lineNo,
    hints,
    required: requiredOverride || severity === "MUST",
  };
}

function pushUnique(
  items: SpecItem[],
  seen: Set<string>,
  item: SpecItem,
): void {
  const key = `${item.text.toLowerCase()}::${item.severity}`;
  if (seen.has(key)) return;
  seen.add(key);
  items.push(item);
}

export function inferKindFromText(text: string): ItemKind {
  if (/\btest(s|ing)?\b|单元测试|集成测试|e2e/i.test(text)) return "test";
  if (/\bfile\b|路径|存在|presence|\.md\b|\.ts\b|\.yml\b/i.test(text))
    return "file";
  if (/\bMUST\b|\bSHOULD\b|必须|应当/i.test(text)) return "rule";
  return "checklist";
}
