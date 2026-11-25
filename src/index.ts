/** Public library API for embedding specgate in other local tools. */

export { VERSION, buildProgram, main } from "./program.js";
export {
  DEFAULT_SPEC_CANDIDATES,
  SpecgateConfigSchema,
  defaultConfig,
  findConfigPath,
  loadConfigFile,
  renderInitConfig,
  resolveConfig,
} from "./core/config.js";
export { discover, listConfigCandidates } from "./core/discover.js";
export {
  collectEvidence,
  evidenceById,
  globMatch,
} from "./core/evidence.js";
export {
  EXIT_GATE_FAIL,
  EXIT_OK,
  EXIT_USAGE,
  assembleResult,
  evaluateGate,
  runGate,
} from "./core/gate.js";
export { matchItems } from "./core/match.js";
export {
  inferKindFromText,
  parseMany,
  parseSpecFile,
  parseSpecMarkdown,
} from "./core/parseSpec.js";
export { toHtmlReport } from "./reports/htmlReport.js";
export { toJsonReport } from "./reports/jsonReport.js";
export { toMarkdownReport } from "./reports/mdReport.js";
export { writeReports } from "./reports/writeReports.js";
export type * from "./types.js";
