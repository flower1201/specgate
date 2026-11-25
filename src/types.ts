/** Shared domain types for specgate. */

export type Severity = "MUST" | "SHOULD" | "MAY";
export type ItemKind = "checklist" | "rule" | "file" | "test" | "custom";
export type EvidenceKind =
  | "git-diff"
  | "file-presence"
  | "test-result"
  | "config"
  | "manual";
export type GateStatus = "pass" | "fail" | "warn" | "skip";
export type LangMode = "en" | "zh" | "both";

export interface SpecItem {
  id: string;
  text: string;
  textZh?: string;
  severity: Severity;
  kind: ItemKind;
  sourceFile: string;
  sourceLine: number;
  /** Optional hints used by the matcher (globs, keywords, test names). */
  hints: string[];
  required: boolean;
}

export interface SpecDocument {
  path: string;
  title: string;
  items: SpecItem[];
  rawLength: number;
}

export interface EvidenceItem {
  id: string;
  kind: EvidenceKind;
  summary: string;
  summaryZh?: string;
  path?: string;
  detail?: string;
  weight: number;
  relatedHints: string[];
}

export interface EvidenceBundle {
  root: string;
  collectedAt: string;
  git?: {
    available: boolean;
    base?: string;
    head?: string;
    changedFiles: string[];
    diffStat?: string;
  };
  files: string[];
  tests: {
    detected: boolean;
    runner?: string;
    passed?: boolean;
    summary?: string;
    files: string[];
  };
  items: EvidenceItem[];
}

export interface MatchResult {
  itemId: string;
  status: GateStatus;
  score: number;
  evidenceIds: string[];
  rationale: string;
  rationaleZh: string;
}

export interface GateResult {
  status: GateStatus;
  exitCode: number;
  strict: boolean;
  summary: {
    total: number;
    required: number;
    passed: number;
    failed: number;
    warned: number;
    skipped: number;
  };
  items: Array<{
    item: SpecItem;
    match: MatchResult;
  }>;
  documents: SpecDocument[];
  evidence: EvidenceBundle;
  generatedAt: string;
  root: string;
}

export interface SpecgateConfig {
  specFiles: string[];
  base: string;
  outDir: string;
  strict: boolean;
  lang: LangMode;
  requireEvidenceForMust: boolean;
  ignoreGlobs: string[];
  testCommands: string[];
  extraHints: Record<string, string[]>;
}
