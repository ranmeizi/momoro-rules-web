# WASM 沙盒设计

## 目标

在 2 CPU / 2GB 内存服务器上，安全运行用户提交的 Python 规则代码。

## 安全层级

```
用户自然语言 → AI 生成 Python
       ↓
[1] 静态代码校验（禁止 import/SQL 写操作/eval）
       ↓
[2] 人工/AI 审核（APPROVED 后才可执行）
       ↓
[3] Pyodide WASM 沙盒执行（隔离内存与 syscall）
       ↓
[4] 只读 SQL 账号（数据库层最后防线）
       ↓
RuleResult 归一化输出
```

## 当前实现（Pyodide）

`src/lib/sandbox/pyodide-sandbox.ts` + `executor.ts`：

| 组件 | 说明 |
|------|------|
| **Pyodide 0.29** | npm 包，Node 主线程加载 WASM Python 3.13 |
| **QueryProxy** | `run_sync()` 将 async `ReadOnlyQuery` 桥接为 sync Python API |
| **串行队列** | 同一时刻只执行 1 条规则，避免 2GB OOM |
| **单例运行时** | 首次加载 ~5–8s，后续执行 ~100–500ms |

### 环境变量

```env
SANDBOX_ENGINE=pyodide   # 默认；legacy 回退到 JS 转译
SANDBOX_TIMEOUT_MS=30000
SANDBOX_MAX_ROWS=10000
```

### 本地验证

```bash
pnpm sandbox:test-pyodide
```

### 关键发现（探索结论）

1. **可以在 WASM 沙盒跑** — Pyodide 在 Node 主线程稳定运行用户 `def run(query)` 代码
2. **`js._query_bridge` 不可用** — 应通过 `pyodide.globals.set("_query_bridge", ...)` 注入，Python 侧直接用 `_query_bridge`
3. **async JS → sync Python** — `query.fetch_ingamenews()` 返回 Promise，需 `QueryProxy` + `pyodide.ffi.run_sync` 包装
4. **不建议 worker_threads** — Pyodide 在 worker 内有 fd/I/O 问题；主进程 + 串行队列更稳
5. **Next.js** — `serverExternalPackages: ["pyodide"]`，缓存目录 `.pyodide-cache/`

### 架构图

```
executeInSandbox()
       ↓
validateGeneratedCode()
       ↓
executeInPyodide()  ──→  串行队列
       ↓
loadPyodide() 单例
       ↓
globals.set("_query_bridge", ReadOnlyQuery)
       ↓
QueryProxy + run_sync  ← 用户 Python run(query)
       ↓
toJs() → RuleResult 校验
```

## legacy 模式（回退）

`SANDBOX_ENGINE=legacy` 时使用 `executor.ts` 内受限 Python→JS 转译，无需 Pyodide，语义不完整。

## SQL 权限

双重保障：

1. **代码生成阶段**：`validateGeneratedCode()` 检查 SQL 字符串
2. **运行时**：`ReadOnlyQuery.validateSql()` 拒绝非 SELECT
3. **数据库**：`rules_readonly` 账号仅 GRANT SELECT

## 资源建议（2GB 服务器）

- 同时只运行 1 个沙盒实例（已实现串行队列）
- 首次执行含 Pyodide 冷启动，可考虑服务启动时 `warmupPyodide()`
- 内存峰值约 150–300MB（含 Python 运行时）

## 后续优化

1. 服务启动时预热 Pyodide，缩短首条规则等待
2. 执行队列持久化（BullMQ）应对高并发提交
3. 资源监控（内存峰值、执行耗时 metrics）
