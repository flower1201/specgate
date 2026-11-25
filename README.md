# specgate

**[English](#english)** · **[中文](./README.zh-CN.md)**

<a id="english"></a>

# specgate

**Agents ship code. Specs stay unread. Make acceptance criteria machine-checkable — locally.**

`specgate` is a local-first acceptance / SPEC gate for AI coding workflows. It extracts checklists and MUST/SHOULD rules from your docs, gathers evidence from git + tests + files, and emits bilingual JSON / Markdown / offline HTML reports. No network. No LLM API.

[![License: MIT](https://img.shields.io/badge/License-MIT-0f6b5c.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%5E22.12%20%7C%7C%20%5E24-1c1b19.svg)](./package.json)
[![Version](https://img.shields.io/badge/version-0.1.0--rc.1-b45309.svg)](./package.json)
[![npm](https://img.shields.io/badge/npm-not%20published-6b6560.svg)](#pre-release-install)

> **Public beta [`v0.1.0-rc.1`](https://github.com/flower1201/specgate/releases/tag/v0.1.0-rc.1)** — npm Registry HOLD. Install from GitHub Pre-release tarball.

[中文文档](./README.zh-CN.md) · [MIT License](./LICENSE) · [flower1201/specgate](https://github.com/flower1201/specgate)

---

## Why

AI coding agents optimize for “tests green” and “diff looks plausible.” They rarely prove that **acceptance criteria** in `SPEC.md`, `ACCEPTANCE.md`, `AGENTS.md`, or `CONTRIBUTING` were actually met.

**specgate** turns those documents into a gate:

1. **Discover** acceptance docs + `.specgate.yml`
2. **Extract** checklist items and MUST / SHOULD / MAY rules
3. **Gather evidence** from git diff, file presence, and local test signals
4. **Match** items → evidence with transparent scores
5. **Emit** bilingual reports: JSON + Markdown + rich offline HTML
6. **Exit non-zero** (`2`) when required items lack evidence

No network. No LLM API. Runs entirely on your machine.

---

## Quick start

```bash
git clone https://github.com/flower1201/specgate.git
cd specgate
npm install
npm run build
npm test
npm run demo
```

Against your own repo:

```bash
# scaffold config + ACCEPTANCE.md
npx specgate init

# diagnose discovery / node / git
npx specgate doctor

# extract checklist items
npx specgate extract

# run the gate
npx specgate check --out .specgate-out --lang both
```

Open `.specgate-out/specgate-report.html` in any browser (fully offline).

Node engines: `^22.12.0 || ^24.0.0`.

---

## Pre-release install

npm Registry is **not** published. Install from the GitHub Release asset:

```bash
curl -L -o specgate.tgz \
  https://github.com/flower1201/specgate/releases/download/v0.1.0-rc.1/specgate-0.1.0-rc.1.tgz

npm install ./specgate.tgz
npx specgate --version   # 0.1.0-rc.1
```

> `prepublishOnly` blocks accidental `npm publish` for this RC.

---

## CLI

```
specgate check [dir]
  --spec <file...>   # override / add SPEC files
  --base <ref>       # git base for diff evidence (default HEAD~1)
  --out <dir>        # report directory (default .specgate-out)
  --strict           # treat SHOULD gaps as failures
  --lang en|zh|both  # report language (default both)

specgate extract [dir] [--spec <file...>] [--json]
specgate init [dir] [--force]
specgate doctor [dir]
specgate --version
```

### Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Gate passed (or only soft warnings) |
| `1` | Usage / environment / config error |
| `2` | Required acceptance items failed |

---

## What it reads

| Source | Role |
| --- | --- |
| `SPEC.md` / `ACCEPTANCE.md` | Primary checklists & RFC-style rules |
| `AGENTS.md` | Agent-facing acceptance notes |
| `CONTRIBUTING.md` | Acceptance / DoD sections |
| `.specgate.yml` | Zod-validated local config |

Checklist forms it understands:

```markdown
- [ ] MUST keep tests under `tests/`
- SHOULD publish bilingual docs
必须：提供 `README.md`
```

---

## Evidence model

| Signal | How it's used |
| --- | --- |
| **Git diff** | Changed paths vs `--base` (or working tree) |
| **File presence** | Project tree walk (respects ignore globs) |
| **Tests** | Detects vitest/jest/mocha + `*.test.*` / `tests/` |
| **Config** | Soft signals like `.specgate.yml`, `LICENSE` |

Matching is keyword / path / kind affinity — transparent scores in the report. No cloud ranking.

---

## Reports

Every `check` writes three artifacts:

```
.specgate-out/
  specgate-report.json   # machine-readable gate result
  specgate-report.md     # bilingual markdown
  specgate-report.html   # rich offline HTML (no CDN)
```

---

## Config (`.specgate.yml`)

```yaml
specFiles: []
base: HEAD~1
outDir: .specgate-out
strict: false
lang: both
requireEvidenceForMust: true
ignoreGlobs:
  - node_modules/**
  - dist/**
extraHints: {}
```

---

## Library API

```ts
import { runGate, writeReports } from "specgate";

const result = runGate({ root: process.cwd(), strict: true });
writeReports(result, ".specgate-out", "both");
process.exitCode = result.exitCode; // 2 when required items fail
```

---

## Demo

```bash
npm run demo
```

Runs doctor → extract → check on `examples/demo-repo/`, then a deliberate failing SPEC that must exit `2`.

---

## Design principles

- **Local-first** — zero network calls at runtime
- **Deterministic** — same tree + same SPEC → same gate
- **Bilingual by default** — EN + 中文 in one report
- **Agent-useful** — JSON for machines, HTML for humans
- **Honest RC** — not on npm until you're ready

---

## Development

```bash
npm install
npm run build
npm test
npm run typecheck
```

---

## 中文

AI 代理常在未核对验收标准的情况下交付代码。**specgate** 在本地读取 `SPEC.md` / `ACCEPTANCE.md` 等文档，抽取 MUST/SHOULD 清单，结合 git diff、文件存在性与测试信号生成证据，并输出双语 JSON / Markdown / 离线 HTML 门禁报告；必需项缺证据时以退出码 `2` 失败。

完整中文说明见 [README.zh-CN.md](./README.zh-CN.md)。

**当前版本 `0.1.0-rc.1` 未发布到 npm（Registry HOLD）。**

---

## License

[MIT](./LICENSE) © flower1201
