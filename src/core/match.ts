import type {
  EvidenceBundle,
  EvidenceItem,
  GateStatus,
  MatchResult,
  SpecItem,
  SpecgateConfig,
} from "../types.js";
import { globMatch } from "./evidence.js";

/**
 * Score how well collected evidence covers each SPEC item.
 */
export function matchItems(
  items: SpecItem[],
  evidence: EvidenceBundle,
  config: SpecgateConfig,
): MatchResult[] {
  return items.map((item) => matchOne(item, evidence, config));
}

function matchOne(
  item: SpecItem,
  evidence: EvidenceBundle,
  config: SpecgateConfig,
): MatchResult {
  const extra = config.extraHints[item.id] ?? [];
  const hints = [...item.hints, ...extra, ...tokenize(item.text)];

  const scored: Array<{ ev: EvidenceItem; score: number }> = [];

  for (const ev of evidence.items) {
    const s = scorePair(item, hints, ev);
    if (s > 0) scored.push({ ev, score: s });
  }

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 5);
  const best = top[0]?.score ?? 0;
  const evidenceIds = top.filter((t) => t.score >= 0.25).map((t) => t.ev.id);

  // Direct path / glob hits from hints boost strongly
  const pathHit = hints.some((h) =>
    evidence.files.some(
      (f) => f === h || f.endsWith(`/${h}`) || globMatch(h, f),
    ),
  );
  const gitHit =
    evidence.git?.changedFiles.some((f) =>
      hints.some(
        (h) =>
          f.toLowerCase().includes(h.toLowerCase()) ||
          globMatch(h, f) ||
          f.endsWith(`/${h}`),
      ),
    ) ?? false;

  let score = best;
  if (pathHit) score = Math.max(score, 0.72);
  if (gitHit) score = Math.max(score, 0.8);

  // Keyword overlap with changed files / test files
  if (item.kind === "test" || /test|测试/i.test(item.text)) {
    if (evidence.tests.detected) score = Math.max(score, 0.65);
    if (evidence.tests.files.length > 0) score = Math.max(score, 0.75);
  }

  const status = decideStatus(item, score, config);
  const { rationale, rationaleZh } = buildRationale(
    item,
    status,
    score,
    evidenceIds,
    top,
  );

  return {
    itemId: item.id,
    status,
    score: round2(score),
    evidenceIds,
    rationale,
    rationaleZh,
  };
}

function scorePair(
  item: SpecItem,
  hints: string[],
  ev: EvidenceItem,
): number {
  let score = 0;
  const hay = [
    ev.summary,
    ev.summaryZh ?? "",
    ev.path ?? "",
    ...ev.relatedHints,
  ]
    .join(" ")
    .toLowerCase();

  for (const hint of hints) {
    const h = hint.toLowerCase();
    if (h.length < 2) continue;
    if (hay.includes(h)) {
      score = Math.max(score, Math.min(0.95, 0.35 + hint.length / 40));
    }
    if (ev.path && (globMatch(hint, ev.path) || ev.path.endsWith(hint))) {
      score = Math.max(score, 0.85);
    }
  }

  // Kind affinity
  if (item.kind === "test" && ev.kind === "test-result") {
    score = Math.max(score, 0.55);
  }
  if (item.kind === "file" && ev.kind === "file-presence") {
    score = Math.max(score, 0.4);
  }
  if (ev.kind === "git-diff") {
    score = Math.min(1, score * 1.15);
  }

  return Math.min(1, score * (0.7 + ev.weight * 0.3));
}

function decideStatus(
  item: SpecItem,
  score: number,
  config: SpecgateConfig,
): GateStatus {
  const need = config.requireEvidenceForMust && item.required ? 0.45 : 0.35;

  if (score >= need) return "pass";
  if (item.severity === "MAY") return score >= 0.2 ? "pass" : "skip";
  if (item.severity === "SHOULD" && !config.strict) {
    return score >= 0.2 ? "warn" : "warn";
  }
  if (item.required || item.severity === "MUST") return "fail";
  if (config.strict && item.severity === "SHOULD") return "fail";
  return "warn";
}

function buildRationale(
  item: SpecItem,
  status: GateStatus,
  score: number,
  evidenceIds: string[],
  top: Array<{ ev: EvidenceItem; score: number }>,
): { rationale: string; rationaleZh: string } {
  const topPaths = top
    .map((t) => t.ev.path || t.ev.summary)
    .slice(0, 3)
    .join(", ");

  if (status === "pass") {
    return {
      rationale: `Matched evidence (score ${round2(score)})${topPaths ? `: ${topPaths}` : ""}.`,
      rationaleZh: `已匹配证据（得分 ${round2(score)}）${topPaths ? `：${topPaths}` : ""}。`,
    };
  }
  if (status === "warn") {
    return {
      rationale: `Weak / partial evidence for SHOULD item (score ${round2(score)}).`,
      rationaleZh: `SHOULD 项证据偏弱（得分 ${round2(score)}）。`,
    };
  }
  if (status === "skip") {
    return {
      rationale: "Optional item without strong evidence; skipped.",
      rationaleZh: "可选条目缺少强证据，已跳过。",
    };
  }
  return {
    rationale: `Required ${item.severity} item lacks sufficient evidence (score ${round2(score)}; hits=${evidenceIds.length}).`,
    rationaleZh: `必需的 ${item.severity} 条目缺少充分证据（得分 ${round2(score)}；命中=${evidenceIds.length}）。`,
  };
}

function tokenize(text: string): string[] {
  return text
    .replace(/[`"'*_~]/g, " ")
    .split(/[\s,;:：、/\\|()[\]{}]+/)
    .map((w) => w.trim().toLowerCase())
    .filter((w) => w.length >= 3);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
