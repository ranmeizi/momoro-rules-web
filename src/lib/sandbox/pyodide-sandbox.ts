/**
 * Pyodide WASM 沙盒 — 在 Node 主线程运行真实 Python
 *
 * - 单例 Pyodide 运行时（首次加载 ~5–8s）
 * - 串行执行队列（2GB 服务器避免并发 OOM）
 * - QueryProxy + run_sync 桥接异步 ReadOnlyQuery
 */

import { join } from "node:path";
import type { PyodideInterface } from "pyodide";
import type { ReadOnlyQuery } from "./query";

/** 注入到用户代码前：将 async JS query API 同步化 */
export const QUERY_PROXY_PREAMBLE = `
from pyodide.ffi import run_sync

def _rows_to_dicts(rows):
    out = []
    for row in rows:
        if hasattr(row, "to_py"):
            out.append(row.to_py())
        elif isinstance(row, dict):
            out.append(row)
        else:
            out.append(dict(row))
    return out

class QueryProxy:
    def __init__(self, bridge):
        self._bridge = bridge

    def fetch_ingamenews(self, filters):
        return _rows_to_dicts(run_sync(self._bridge.fetch_ingamenews(filters)))

    def fetch_announcements(self, filters):
        return _rows_to_dicts(run_sync(self._bridge.fetch_announcements(filters)))

    def execute(self, sql, params=None):
        return _rows_to_dicts(run_sync(self._bridge.execute(sql, params)))
`.trim();

function wrapUserCode(code: string): string {
  return `${QUERY_PROXY_PREAMBLE}

${code}

__result = run(QueryProxy(_query_bridge))
__result
`;
}

let pyodidePromise: Promise<PyodideInterface> | null = null;

async function getPyodide(): Promise<PyodideInterface> {
  if (!pyodidePromise) {
    pyodidePromise = (async () => {
      const { loadPyodide } = await import("pyodide");
      return loadPyodide({
        packageCacheDir: join(process.cwd(), ".pyodide-cache"),
      });
    })();
  }
  return pyodidePromise;
}

/** 串行队列：同一时刻只跑一个规则 */
let queueTail: Promise<void> = Promise.resolve();

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queueTail.then(task, task);
  queueTail = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function isPyProxy(
  arg: unknown
): arg is { toJs: (opts?: object) => Record<string, unknown> } {
  return (
    arg !== null &&
    typeof arg === "object" &&
    "toJs" in arg &&
    typeof (arg as { toJs: unknown }).toJs === "function"
  );
}

function normalizePyArg(arg: Record<string, unknown>): Record<string, unknown> {
  if (isPyProxy(arg)) {
    return arg.toJs({
      dict_converter: Object.fromEntries,
      create_pyproxies: false,
    });
  }
  return arg;
}

function createQueryBridge(query: ReadOnlyQuery) {
  return {
    fetch_ingamenews: (filters: Record<string, unknown>) =>
      query.fetch_ingamenews(normalizePyArg(filters)),
    fetch_announcements: (filters: Record<string, unknown>) =>
      query.fetch_announcements(normalizePyArg(filters)),
    execute: (sql: string, params?: Record<string, unknown>) =>
      query.execute(sql, params ? normalizePyArg(params) : params),
  };
}

function pyResultToJs(result: unknown): unknown {
  if (
    result &&
    typeof result === "object" &&
    "toJs" in result &&
    typeof (result as { toJs: unknown }).toJs === "function"
  ) {
    return (result as { toJs: (opts?: object) => unknown }).toJs({
      dict_converter: Object.fromEntries,
      create_pyproxies: false,
    });
  }
  return result;
}

function formatPyodideError(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) {
    const msg = String((e as { message: unknown }).message);
    const lines = msg.split("\n").filter(Boolean);
    const traceback = lines.slice(-4).join("\n");
    return traceback || msg;
  }
  return String(e);
}

export async function executeInPyodide(
  code: string,
  query: ReadOnlyQuery
): Promise<unknown> {
  return enqueue(async () => {
    const pyodide = await getPyodide();
    const bridge = createQueryBridge(query);

    pyodide.globals.set("_query_bridge", bridge);

    try {
      const result = await pyodide.runPythonAsync(wrapUserCode(code));
      return pyResultToJs(result);
    } catch (e) {
      throw new Error(formatPyodideError(e));
    } finally {
      pyodide.globals.delete("_query_bridge");
    }
  });
}

/** 预热 Pyodide（可选，首次执行前调用可缩短用户等待） */
export async function warmupPyodide(): Promise<void> {
  await getPyodide();
}
