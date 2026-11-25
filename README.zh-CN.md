# specgate

**面向 AI 编程代理的本地优先验收 / SPEC 门禁。**

代理会交付代码，却经常不读验收文档。`specgate` 把缺口关上——离线、可复现、中英双语。

> **状态：** `v0.1.0-rc.1` — **npm Registry HOLD**（未发布）。请从源码安装。

[English README](./README.md) · [MIT License](./LICENSE) · [flower1201/specgate](https://github.com/flower1201/specgate)

---

## 为什么需要它

AI 代理往往只关心「测试绿了」「diff 看起来合理」，很少证明 `SPEC.md`、`ACCEPTANCE.md`、`AGENTS.md` 或 `CONTRIBUTING` 里的**验收标准**真正被满足。

**specgate** 把这些文档变成门禁：

1. **发现**验收文档与 `.specgate.yml`
2. **抽取**清单项与 MUST / SHOULD / MAY 规则
3. **收集证据**：git diff、文件存在性、本地测试信号
4. **匹配**条目 → 证据，并给出可解释得分
5. **输出**双语报告：JSON + Markdown + 精美离线 HTML
6. **必需项缺证据时非零退出**（退出码 `2`）

无网络。无 LLM API。完全在本地运行。

---

## 安装（源码）

```bash
git clone https://github.com/flower1201/specgate.git
cd specgate
npm install
npm run build
node dist/cli.js --version
# → 0.1.0-rc.1
```

Node 引擎：`^22.12.0 || ^24.0.0`

> 本 RC 故意阻止 `npm publish`（`prepublishOnly` + Registry HOLD）。

---

## 快速开始

```bash
npx specgate init
npx specgate doctor
npx specgate extract
npx specgate check --out .specgate-out --lang both
```

用浏览器打开 `.specgate-out/specgate-report.html`（完全离线）。

---

## 命令行

```
specgate check [dir]
  --spec <file...>   # 指定 / 追加 SPEC 文件
  --base <ref>       # git 对比基准（默认 HEAD~1）
  --out <dir>        # 报告目录（默认 .specgate-out）
  --strict           # SHOULD 缺口也视为失败
  --lang en|zh|both  # 报告语言（默认 both）

specgate extract [dir] [--spec <file...>] [--json]
specgate init [dir] [--force]
specgate doctor [dir]
specgate --version
```

### 退出码

| 码 | 含义 |
| --- | --- |
| `0` | 门禁通过（或仅有软警告） |
| `1` | 用法 / 环境 / 配置错误 |
| `2` | 必需验收项失败 |

---

## 读取哪些材料

| 来源 | 作用 |
| --- | --- |
| `SPEC.md` / `ACCEPTANCE.md` | 主清单与 RFC 风格规则 |
| `AGENTS.md` | 面向代理的验收说明 |
| `CONTRIBUTING.md` | 验收 / DoD 小节 |
| `.specgate.yml` | Zod 校验的本地配置 |

可识别的写法示例：

```markdown
- [ ] MUST keep tests under `tests/`
- SHOULD publish bilingual docs
必须：提供 `README.md`
```

---

## 证据模型

| 信号 | 用途 |
| --- | --- |
| **Git diff** | 相对 `--base`（或工作区）的变更路径 |
| **文件存在** | 项目树遍历（尊重 ignore） |
| **测试** | 识别 vitest/jest/mocha 与 `*.test.*` / `tests/` |
| **配置** | `.specgate.yml`、`LICENSE` 等软信号 |

匹配基于关键词 / 路径 / 类型亲和度，报告中分数透明。无云端排序。

---

## 报告产物

每次 `check` 写出三份文件：

```
.specgate-out/
  specgate-report.json
  specgate-report.md
  specgate-report.html
```

---

## 配置（`.specgate.yml`）

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

## 库 API

```ts
import { runGate, writeReports } from "specgate";

const result = runGate({ root: process.cwd(), strict: true });
writeReports(result, ".specgate-out", "both");
process.exitCode = result.exitCode; // 必需项失败时为 2
```

---

## 演示

```bash
npm run demo
```

对 `examples/demo-repo/` 执行 doctor → extract → check，再跑一份故意失败的 SPEC，断言退出码为 `2`。

---

## 设计原则

- **本地优先** — 运行时零网络
- **可复现** — 相同树 + 相同 SPEC → 相同门禁
- **默认双语** — 一份报告同时含 EN + 中文
- **对代理友好** — JSON 给机器，HTML 给人
- **诚实的 RC** — 未就绪前不上 npm

---

## 开发

```bash
npm install
npm run build
npm test
npm run typecheck
```

---

## License

[MIT](./LICENSE) © flower1201
