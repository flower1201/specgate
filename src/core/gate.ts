import { isAbsolute, join } from "node:path";
import type {
  EvidenceBundle,
  GateResult,
  GateStatus,
  MatchResult,
  SpecDocument,
  SpecItem,
  SpecgateConfig,
} from "../types.js";
import { discover } from "./discover.js";
import { collectEvidence } from "./evidence.js";
import { matchItems } from "./match.js";
import { parseMany } from "./parseSpec.js";
import { resolveConfig } from "./config.js";

export interface RunGateOptions {
  root: string;
  specFiles?: string[];
  base?: string;
  outDir?: string;
  strict?: boolean;
  lang?: SpecgateConfig["lang"];
  configOverrides?: Partial<SpecgateConfig>;
}

export const EXIT_OK = 0;
export const EXIT_USAGE = 1;
export const EXIT_GATE_FAIL = 2;

/**
 * Full gate pipeline: discover → parse → evidence → match → decide.
 */
export function runGate(opts: RunGateOptions): GateResult {
  const config = resolveConfig(opts.root, {
    specFiles: opts.specFiles,
    base: opts.base,
    outDir: opts.outDir,
    strict: opts.strict,
    lang: opts.lang,
    ...opts.configOverrides,
  });

  const disc = discover(opts.root, config.specFiles);
  const configured =
    opts.specFiles && opts.specFiles.length > 0
      ? opts.specFiles
      : config.specFiles.length > 0
        ? config.specFiles
        : null;

  const absPaths = configured
    ? configured.map((p) => (isAbsolute(p) ? p : join(opts.root, p)))
    : disc.specFiles;

  const documents = absPaths.length > 0 ? parseMany(absPaths) : [];
  const items = dedupeItems(documents.flatMap((d) => d.items));
  const evidence = collectEvidence(opts.root, config);
  const matches = matchItems(items, evidence, config);

  return assembleResult({
    root: opts.root,
    strict: config.strict,
    documents,
    items,
    matches,
    evidence,
  });
}

export function assembleResult(input: {
  root: string;
  strict: boolean;
  documents: SpecDocument[];
  items: SpecItem[];
  matches: MatchResult[];
  evidence: EvidenceBundle;
}): GateResult {
  const byId = new Map(input.matches.map((m) => [m.itemId, m]));
  const paired = input.items.map((item) => {
    const match =
      byId.get(item.id) ??
      ({
        itemId: item.id,
        status: "fail" as GateStatus,
        score: 0,
        evidenceIds: [],
        rationale: "No match result.",
        rationaleZh: "无匹配结果。",
      } satisfies MatchResult);
    return { item, match };
  });

  let passed = 0;
  let failed = 0;
  let warned = 0;
  let skipped = 0;
  let required = 0;

  for (const { item, match } of paired) {
    if (item.required) required += 1;
    switch (match.status) {
      case "pass":
        passed += 1;
        break;
      case "fail":
        failed += 1;
        break;
      case "warn":
        warned += 1;
        break;
      case "skip":
        skipped += 1;
        break;
    }
  }

  const status: GateStatus =
    failed > 0 ? "fail" : warned > 0 && input.strict ? "fail" : passed > 0 || paired.length === 0 ? (warned > 0 ? "warn" : "pass") : "pass";

  // Empty SPEC set → warn/pass with exit 0 (nothing required)
  const exitCode =
    failed > 0 || (input.strict && warned > 0) ? EXIT_GATE_FAIL : EXIT_OK;

  // If no documents at all, treat as soft fail only when strict
  let finalStatus = status;
  let finalExit = exitCode;
  if (input.documents.length === 0) {
    finalStatus = input.strict ? "fail" : "warn";
    finalExit = input.strict ? EXIT_GATE_FAIL : EXIT_OK;
  }

  return {
    status: finalStatus,
    exitCode: finalExit,
    strict: input.strict,
    summary: {
      total: paired.length,
      required,
      passed,
      failed,
      warned,
      skipped,
    },
    items: paired,
    documents: input.documents,
    evidence: input.evidence,
    generatedAt: new Date().toISOString(),
    root: input.root,
  };
}

function dedupeItems(items: SpecItem[]): SpecItem[] {
  const seen = new Set<string>();
  const out: SpecItem[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

/** Evaluate already-parsed data — useful for tests. */
export function evaluateGate(
  documents: SpecDocument[],
  evidence: EvidenceBundle,
  config: SpecgateConfig,
): GateResult {
  const items = dedupeItems(documents.flatMap((d) => d.items));
  const matches = matchItems(items, evidence, config);
  return assembleResult({
    root: evidence.root,
    strict: config.strict,
    documents,
    items,
    matches,
    evidence,
  });
}
