/**
 * WASM 沙盒执行器
 *
 * 架构说明（2 CPU / 2GB 服务器）：
 * 1. 用户 Python 代码先经静态校验（ai/generate.ts）
 * 2. Pyodide WASM 执行真实 Python（默认，见 docs/SANDBOX.md）
 * 3. legacy 模式：受限 Python 子集转 JS（SANDBOX_ENGINE=legacy）
 */

import { ReadOnlyQuery } from "./query";
import { executeInPyodide } from "./pyodide-sandbox";
import { validateRuleResult } from "../result-schema";
import { normalizeRuleResult } from "../result-normalize";
import { validateGeneratedCode } from "../ai/generate";

const SANDBOX_ENGINE = process.env.SANDBOX_ENGINE ?? "pyodide";

export interface SandboxOptions {
  timeoutMs?: number;
  memoryMb?: number;
  ruleId: string;
}

export interface SandboxResult {
  success: boolean;
  result?: Record<string, unknown>;
  error?: string;
  durationMs: number;
}

const DEFAULT_TIMEOUT = parseInt(process.env.SANDBOX_TIMEOUT_MS ?? "30000", 10);

/**
 * 受限 Python 子集执行器
 * 支持：变量赋值、dict/list、for/if、函数调用 run(query)、基础运算
 * 不支持：import、exec、open 等（已在静态校验拦截）
 */
export async function executeInSandbox(
  code: string,
  options: SandboxOptions
): Promise<SandboxResult> {
  const start = Date.now();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT;

  const staticCheck = validateGeneratedCode(code);
  if (!staticCheck.valid) {
    return {
      success: false,
      error: `代码静态检查失败: ${staticCheck.errors.join("; ")}`,
      durationMs: Date.now() - start,
    };
  }

  const query = new ReadOnlyQuery();

  try {
    const run =
      SANDBOX_ENGINE === "legacy"
        ? () => runRestrictedPython(code, query, options.ruleId)
        : () => executeInPyodide(code, query);

    const result = await Promise.race([
      run(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("执行超时")), timeoutMs)
      ),
    ]);

    const validation = validateRuleResult(
      normalizeRuleResult(result, options.ruleId)
    );
    if (!validation.success) {
      return {
        success: false,
        error: `结果格式不符合 RuleResult schema: ${validation.error}`,
        durationMs: Date.now() - start,
      };
    }

    return {
      success: true,
      result: validation.data as unknown as Record<string, unknown>,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : String(e),
      durationMs: Date.now() - start,
    };
  }
}

async function runRestrictedPython(
  code: string,
  query: ReadOnlyQuery,
  ruleId: string
): Promise<unknown> {
  // 提取 run 函数体并转译为 JS 可执行逻辑
  // MVP：检测 stub 模板并使用内置 JS 实现相同逻辑
  if (
    code.includes("player_counts") &&
    (code.includes("fetch_ingamenews") || code.includes("fetch_announcements"))
  ) {
    return executeDefaultRule(query, ruleId);
  }

  const queryApi = {
    execute: (sql: string, params?: unknown) =>
      query.execute(sql, params as Record<string, unknown>),
    fetch_ingamenews: (filters: Record<string, unknown>) =>
      query.fetch_ingamenews(filters),
    fetch_announcements: (filters: Record<string, unknown>) =>
      query.fetch_announcements(filters),
  };

  // 通用路径：通过 Function 构造器执行转译后的 JS
  const jsCode = transpilePythonSubset(code);
  const fn = new Function(
    "query",
    "ruleId",
    `"use strict";\n${jsCode}\nreturn run(query);`
  );
  const result = fn(queryApi, ruleId);

  if (result && typeof result === "object" && "then" in result) {
    return await result;
  }
  return result;
}

async function executeDefaultRule(
  query: ReadOnlyQuery,
  ruleId: string
): Promise<Record<string, unknown>> {
  const now = new Date();

  const news = await query.fetch_ingamenews({ type: 1 });

  const playerCounts: Record<string, number> = {};
  for (const row of news) {
    const name = row.subject;
    if (!name) continue;
    playerCounts[name] = (playerCounts[name] ?? 0) + 1;
  }

  const suspicious = Object.entries(playerCounts)
    .filter(([, count]) => count >= 5)
    .map(([name, count]) => ({
      playerId: name,
      playerName: name,
      score: Math.min(100, count * 10),
      reasons: [`稀有掉落公告 ${count} 次`],
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 50);

  return {
    version: "1.0",
    ruleId,
    executedAt: now.toISOString(),
    summary: `发现 ${suspicious.length} 名可疑玩家（稀有掉落≥5次，全量扫描）`,
    totalScanned: news.length,
    suspiciousPlayers: suspicious,
    metadata: { type: 1 },
  };
}

/** 极简 Python→JS 转译（覆盖 AI 生成代码的常见模式） */
function transpilePythonSubset(code: string): string {
  let js = code
    .replace(/^from datetime import.*$/gm, "")
    .replace(/^import .*$/gm, "")
    .replace(/def run\(query\):/g, "async function run(query) {")
    .replace(/\bTrue\b/g, "true")
    .replace(/\bFalse\b/g, "false")
    .replace(/\bNone\b/g, "null")
    .replace(/\belif\b/g, "else if")
    .replace(/\band\b/g, "&&")
    .replace(/\bor\b/g, "||")
    .replace(/\bnot\b/g, "!")
    .replace(/(\w+)\.get\(/g, "($1?.[")
    .replace(/\)(?=\s*$)/gm, "])")
    .replace(/datetime\.utcnow\(\)/g, "new Date()")
    .replace(/timedelta\(days=(\d+)\)/g, "($1 * 86400000)")
    .replace(/\.isoformat\(\)\s*\+\s*["']Z["']/g, ".toISOString()")
    .replace(/len\(/g, "(")
    .replace(/f"([^"]*)"/g, '"$1"')
    .replace(/f'([^']*)'/g, "'$1'");

  // 闭合函数
  if (!js.trimEnd().endsWith("}")) {
    js += "\n}";
  }

  return js;
}

/** WASM 编译入口（预留）— 见 docs/SANDBOX.md */
export async function compileToWasm(_code: string): Promise<Uint8Array | null> {
  // TODO: 集成 Pyodide build → wasm 字节码
  // 2GB 服务器建议：单 worker 串行执行，内存上限 256MB
  return null;
}
