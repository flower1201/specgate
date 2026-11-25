import { Command } from "commander";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderInitConfig, resolveConfig } from "./core/config.js";
import { discover } from "./core/discover.js";
import { EXIT_OK, EXIT_USAGE, runGate } from "./core/gate.js";
import { parseMany } from "./core/parseSpec.js";
import { writeReports } from "./reports/writeReports.js";
import type { LangMode } from "./types.js";

export const VERSION = "0.1.0-rc.1";

function resolveDir(dir?: string): string {
  return resolve(dir || process.cwd());
}

function parseLang(raw?: string): LangMode {
  if (!raw || raw === "both") return "both";
  if (raw === "en" || raw === "zh") return raw;
  throw new Error(`Invalid --lang: ${raw} (expected en|zh|both)`);
}

function satisfiesEngine(version: string): boolean {
  const [majS, minS] = version.split(".");
  const maj = Number(majS);
  const min = Number(minS);
  if (maj === 22 && min >= 12) return true;
  if (maj >= 24) return true;
  return false;
}

const STARTER_ACCEPTANCE = `# Acceptance Criteria

Local checklist consumed by **specgate**. Mark MUST rules clearly so agents cannot ship without evidence.

## MUST

- [ ] MUST provide a \`README.md\` documenting how to run the project
- [ ] MUST include automated tests under \`tests/\` or \`*.test.ts\`
- [ ] MUST keep a machine-readable gate config in \`.specgate.yml\`

## SHOULD

- [ ] SHOULD emit bilingual (EN+ZH) documentation for contributors
- [ ] SHOULD fail CI when required acceptance items lack evidence

## MAY

- [ ] MAY include an offline HTML gate report for humans
`;

export function buildProgram(): Command {
  const program = new Command();

  program
    .name("specgate")
    .description(
      "Local-first acceptance / SPEC gate for AI coding agents. Offline. No LLM.",
    )
    .version(VERSION, "-V, --version", "Print version");

  program
    .command("check")
    .description("Run the acceptance gate and emit bilingual reports")
    .argument("[dir]", "Project directory", ".")
    .option("--spec <file...>", "SPEC / ACCEPTANCE files (repeatable)")
    .option("--base <ref>", "Git base ref for diff evidence")
    .option("--out <dir>", "Report output directory")
    .option("--strict", "Treat SHOULD gaps as failures", false)
    .option("--lang <mode>", "Report language: en | zh | both", "both")
    .action(
      (
        dir: string,
        opts: {
          spec?: string[];
          base?: string;
          out?: string;
          strict?: boolean;
          lang?: string;
        },
      ) => {
        try {
          const root = resolveDir(dir);
          const lang = parseLang(opts.lang);
          const config = resolveConfig(root, {
            specFiles: opts.spec,
            base: opts.base,
            outDir: opts.out,
            strict: opts.strict,
            lang,
          });

          const result = runGate({
            root,
            specFiles: opts.spec,
            base: config.base,
            outDir: config.outDir,
            strict: config.strict,
            lang: config.lang,
          });

          const outDir = resolve(root, config.outDir);
          const written = writeReports(result, outDir, config.lang);

          const icon =
            result.status === "pass"
              ? "✓"
              : result.status === "fail"
                ? "✗"
                : "!";
          console.log(
            `${icon} specgate ${result.status.toUpperCase()}  exit=${result.exitCode}`,
          );
          console.log(
            `  items=${result.summary.total} required=${result.summary.required} pass=${result.summary.passed} fail=${result.summary.failed} warn=${result.summary.warned}`,
          );
          console.log(`  json  ${written.jsonPath}`);
          console.log(`  md    ${written.mdPath}`);
          console.log(`  html  ${written.htmlPath}`);

          process.exitCode = result.exitCode;
        } catch (err) {
          console.error(`specgate check failed: ${(err as Error).message}`);
          process.exitCode = EXIT_USAGE;
        }
      },
    );

  program
    .command("extract")
    .description("Extract checklist / MUST-SHOULD items without gating")
    .argument("[dir]", "Project directory", ".")
    .option("--spec <file...>", "SPEC / ACCEPTANCE files")
    .option("--json", "Print JSON only", false)
    .action((dir: string, opts: { spec?: string[]; json?: boolean }) => {
      try {
        const root = resolveDir(dir);
        const config = resolveConfig(root, { specFiles: opts.spec });
        const disc = discover(root, config.specFiles);
        const paths =
          opts.spec && opts.spec.length > 0
            ? opts.spec.map((p) => resolve(root, p))
            : disc.specFiles;
        const docs = paths.length > 0 ? parseMany(paths) : [];
        const items = docs.flatMap((d) =>
          d.items.map((item) => ({
            ...item,
            document: d.title,
            documentPath: d.path,
          })),
        );

        if (opts.json) {
          console.log(
            JSON.stringify({ root, documents: docs.length, items }, null, 2),
          );
        } else {
          console.log(
            `specgate extract — ${items.length} item(s) from ${docs.length} document(s)`,
          );
          for (const item of items) {
            console.log(
              `  [${item.severity}] ${item.id}  ${item.text.slice(0, 100)}`,
            );
            console.log(
              `           ${item.sourceFile}:${item.sourceLine}  hints=${item.hints.slice(0, 4).join("|")}`,
            );
          }
        }
        process.exitCode = EXIT_OK;
      } catch (err) {
        console.error(`specgate extract failed: ${(err as Error).message}`);
        process.exitCode = EXIT_USAGE;
      }
    });

  program
    .command("init")
    .description("Scaffold .specgate.yml and a starter ACCEPTANCE.md")
    .argument("[dir]", "Project directory", ".")
    .option("--force", "Overwrite existing files", false)
    .action((dir: string, opts: { force?: boolean }) => {
      try {
        const root = resolveDir(dir);
        mkdirSync(root, { recursive: true });
        const cfgPath = resolve(root, ".specgate.yml");
        const accPath = resolve(root, "ACCEPTANCE.md");

        if (existsSync(cfgPath) && !opts.force) {
          console.log(`skip ${cfgPath} (exists; use --force)`);
        } else {
          writeFileSync(cfgPath, renderInitConfig(), "utf8");
          console.log(`wrote ${cfgPath}`);
        }

        if (existsSync(accPath) && !opts.force) {
          console.log(`skip ${accPath} (exists; use --force)`);
        } else {
          writeFileSync(accPath, STARTER_ACCEPTANCE, "utf8");
          console.log(`wrote ${accPath}`);
        }

        console.log("Next: edit ACCEPTANCE.md, then run `specgate check`.");
        process.exitCode = EXIT_OK;
      } catch (err) {
        console.error(`specgate init failed: ${(err as Error).message}`);
        process.exitCode = EXIT_USAGE;
      }
    });

  program
    .command("doctor")
    .description("Diagnose discovery, config, git, and Node environment")
    .argument("[dir]", "Project directory", ".")
    .action((dir: string) => {
      try {
        const root = resolveDir(dir);
        const disc = discover(root);
        let configOk = true;
        let configMsg = "no config file (using defaults)";
        try {
          const cfg = resolveConfig(root);
          configMsg = `ok (lang=${cfg.lang}, strict=${cfg.strict}, base=${cfg.base})`;
        } catch (e) {
          configOk = false;
          configMsg = (e as Error).message;
        }

        const node = process.versions.node;
        const engineOk = satisfiesEngine(node);

        console.log("specgate doctor");
        console.log(`  root         ${root}`);
        console.log(`  version      ${VERSION}`);
        console.log(
          `  node         ${node} ${engineOk ? "✓" : "✗ (need ^22.12.0 || ^24.0.0)"}`,
        );
        console.log(
          `  config       ${disc.configPath || "(none)"} — ${configMsg}`,
        );
        console.log(`  package.json ${disc.packageJson ? "yes" : "no"}`);
        console.log(`  git          ${disc.git ? "yes" : "no"}`);
        console.log(`  spec files   ${disc.specFiles.length}`);
        for (const f of disc.specFiles) console.log(`    - ${f}`);
        for (const n of disc.notes) console.log(`  note         ${n}`);
        if (disc.contributingSections.length) {
          console.log("  contributing sections:");
          for (const s of disc.contributingSections)
            console.log(`    - ${s}`);
        }

        const healthy = engineOk && configOk;
        process.exitCode = healthy ? EXIT_OK : EXIT_USAGE;
        console.log(healthy ? "doctor: OK" : "doctor: issues detected");
      } catch (err) {
        console.error(`specgate doctor failed: ${(err as Error).message}`);
        process.exitCode = EXIT_USAGE;
      }
    });

  return program;
}

export async function main(argv = process.argv): Promise<void> {
  const program = buildProgram();
  await program.parseAsync(argv);
}
