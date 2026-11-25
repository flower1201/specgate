#!/usr/bin/env node
/**
 * End-to-end demo: build (if needed) → check demo-repo → print exit semantics.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cli = join(root, "dist", "cli.js");
const demo = join(root, "examples", "demo-repo");
const nodeBin = process.execPath;

function run(args, opts = {}) {
  const printable = [nodeBin, ...args]
    .map((a) => (/\s/.test(a) ? `"${a}"` : a))
    .join(" ");
  console.log(`\n$ ${printable}`);
  const r = spawnSync(nodeBin, args, {
    cwd: opts.cwd || root,
    encoding: "utf8",
    stdio: "inherit",
    // Do NOT use shell:true — Windows breaks on spaces in Program Files.
    shell: false,
  });
  return r.status ?? 1;
}

if (!existsSync(cli)) {
  console.log("$ npm run build");
  const build = spawnSync(
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["run", "build"],
    { cwd: root, stdio: "inherit", shell: true },
  );
  if ((build.status ?? 1) !== 0) process.exit(build.status ?? 1);
}

console.log("=== specgate doctor (demo-repo) ===");
run([cli, "doctor", demo]);

console.log("\n=== specgate extract (demo-repo) ===");
run([cli, "extract", demo]);

console.log("\n=== specgate check (demo-repo) ===");
const checkCode = run([
  cli,
  "check",
  demo,
  "--out",
  ".specgate-out",
  "--lang",
  "both",
]);

console.log("\n=== intentional fail (missing HSM requirement) ===");
const failDir = mkdtempSync(join(tmpdir(), "specgate-fail-"));
const failSpec = join(failDir, "FAIL_ACCEPTANCE.md");
writeFileSync(
  failSpec,
  `# Fail Fixture

## MUST
- [ ] MUST rotate HSM-prod-keys-nightly-xyz
- [ ] MUST deploy to nonexistent-cluster-42
`,
  "utf8",
);

const failCode = run([
  cli,
  "check",
  demo,
  "--spec",
  failSpec,
  "--out",
  ".specgate-out-fail",
  "--lang",
  "en",
]);

console.log(`\nDemo summary:`);
console.log(`  check(demo-repo) exit = ${checkCode}`);
console.log(`  check(fail fixture) exit = ${failCode} (expect 2)`);

if (checkCode !== 0) {
  console.error("Expected demo-repo check to exit 0.");
  process.exit(1);
}
if (failCode !== 2) {
  console.error("Expected exit code 2 for failed required items.");
  process.exit(1);
}

console.log("demo OK");
process.exit(0);
