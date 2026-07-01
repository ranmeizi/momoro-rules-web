/**
 * 探索脚本：验证 Pyodide 能否在 Node 中跑用户规则代码
 * 运行: pnpm sandbox:test-pyodide
 */
import { loadPyodide } from "pyodide";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const QUERY_PROXY_PREAMBLE = `
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
`;

const SAMPLE_CODE = `
from datetime import datetime, timedelta

def run(query):
    now = datetime.utcnow()
    week_ago = (now - timedelta(days=7)).isoformat() + "Z"
    news = query.fetch_ingamenews({"from": week_ago, "to": now.isoformat() + "Z", "type": 1})
    player_counts = {}
    for row in news:
        name = row.get("subject")
        if not name:
            continue
        player_counts[name] = player_counts.get(name, 0) + 1
    suspicious = []
    for name, count in player_counts.items():
        if count >= 2:
            suspicious.append({
                "playerId": str(name),
                "playerName": str(name),
                "score": min(100, count * 10),
                "reasons": [f"7天内稀有掉落 {count} 次"],
            })
    return {
        "version": "1.0",
        "ruleId": "test-rule",
        "executedAt": now.isoformat() + "Z",
        "summary": f"发现 {len(suspicious)} 名可疑玩家",
        "totalScanned": len(news),
        "suspiciousPlayers": suspicious,
    }
`;

const mockNews = [
  { subject: "玩家A", type: 1, ts: Date.now() },
  { subject: "玩家A", type: 1, ts: Date.now() },
  { subject: "玩家A", type: 1, ts: Date.now() },
  { subject: "玩家B", type: 1, ts: Date.now() },
];

console.log("加载 Pyodide...");
const t0 = Date.now();
const pyodide = await loadPyodide({
  packageCacheDir: join(__dirname, "../.pyodide-cache"),
});
console.log(`Pyodide 加载完成: ${Date.now() - t0}ms`);

const queryBridge = {
  fetch_ingamenews() {
    return Promise.resolve(mockNews);
  },
  fetch_announcements() {
    return this.fetch_ingamenews();
  },
  execute() {
    return Promise.resolve(mockNews);
  },
};

pyodide.globals.set("_query_bridge", queryBridge);

const wrapped = `
${QUERY_PROXY_PREAMBLE}
${SAMPLE_CODE}

__result = run(QueryProxy(_query_bridge))
__result
`;

console.log("执行 Python...");
const t1 = Date.now();
try {
  const result = await pyodide.runPythonAsync(wrapped);
  console.log(`执行完成: ${Date.now() - t1}ms`);
  console.log(
    "结果:",
    result?.toJs?.({ dict_converter: Object.fromEntries, create_pyproxies: false }) ??
      result
  );
} catch (e) {
  console.error("执行失败:", e.message ?? e);
  process.exit(1);
}
