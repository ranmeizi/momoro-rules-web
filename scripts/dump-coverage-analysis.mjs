/**
 * 按用户规则脚本 dump 活跃时间覆盖率明细（每人每日一个文件）
 *
 * 用法:
 *   pnpm sandbox:dump-coverage
 *   pnpm sandbox:dump-coverage -- --out debug/coverage-analysis --limit 0
 *
 * --limit 0 表示不 LIMIT，拉全库 type=1（与沙盒默认 10000 不同，便于对照）
 */
import { createConnection } from "mysql2/promise";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { normalizeMysqlUrl } from "./db-url.mjs";

const GAP_SEC = 7200;
const SOLO_SEC = 1200;
const DAY_SEC = 86400;

function loadDotEnv() {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

function parseArgs(argv) {
  const out = {
    outDir: "debug/coverage-analysis",
    limit: parseInt(process.env.SANDBOX_MAX_ROWS ?? "10000", 10),
    sandboxMode: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--out" && argv[i + 1]) out.outDir = argv[++i];
    else if (a === "--limit" && argv[i + 1]) {
      const n = argv[++i];
      out.limit = n === "0" ? 0 : parseInt(n, 10);
    } else if (a === "--sandbox") out.sandboxMode = true;
  }
  return out;
}

function fmtIso(ms) {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
}

function fmtLocal(ms) {
  return new Date(ms).toISOString().replace("T", " ").slice(0, 19);
}

/** 与规则 Python 脚本完全一致 */
function analyzeGrouped(grouped) {
  const results = [];
  for (const [key, tsList] of grouped.entries()) {
    const [subject, dateStr] = key.split("\0");
    const sorted = [...tsList].sort((a, b) => a - b);

    const segments = [];
    let current = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
      if ((sorted[i] - sorted[i - 1]) / 1000 <= GAP_SEC) {
        current.push(sorted[i]);
      } else {
        segments.push(current);
        current = [sorted[i]];
      }
    }
    segments.push(current);

    let totalSeconds = 0;
    const segmentDetails = [];
    for (const seg of segments) {
      let sec;
      if (seg.length === 1) {
        sec = SOLO_SEC;
      } else {
        sec = (seg.at(-1) - seg[0]) / 1000;
      }
      totalSeconds += sec;
      segmentDetails.push({
        recordCount: seg.length,
        from: fmtIso(seg[0]),
        to: fmtIso(seg.at(-1)),
        contributionSeconds: sec,
        contributionMinutes: Math.round((sec / 60) * 100) / 100,
        tsList: seg,
      });
    }

    const coverage = Math.min(1.0, totalSeconds / DAY_SEC);
    results.push({
      subject,
      date_str: dateStr,
      coverage,
      coveragePercent: Math.round(coverage * 10000) / 100,
      totalSeconds,
      totalMinutes: Math.round((totalSeconds / 60) * 100) / 100,
      dropCount: sorted.length,
      segmentCount: segments.length,
      segments: segmentDetails,
      ts_list: sorted,
      min_ts: sorted[0],
      max_ts: sorted.at(-1),
      from_time: fmtIso(sorted[0]),
      to_time: fmtIso(sorted.at(-1)),
    });
  }
  results.sort((a, b) => b.coverage - a.coverage);
  return results;
}

function safeDirName(name) {
  return String(name)
    .replace(/[/\\?%*:|"<>]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120) || "_empty";
}

loadDotEnv();
const args = parseArgs(process.argv.slice(2));
const url = process.env.MOMO_INGAME_DB_URL;
if (!url || url.includes("请填写")) {
  console.error("✗ MOMO_INGAME_DB_URL 未配置");
  process.exit(1);
}

const outRoot = resolve(process.cwd(), args.outDir);
mkdirSync(outRoot, { recursive: true });
mkdirSync(join(outRoot, "by-player"), { recursive: true });
mkdirSync(join(outRoot, "by-date"), { recursive: true });

console.log("输出目录:", outRoot);
console.log(
  "数据模式:",
  args.sandboxMode || args.limit > 0
    ? `沙盒同款 LIMIT ${args.limit} ORDER BY ts DESC`
    : "全库 type=1（无 LIMIT）"
);

const conn = await createConnection(normalizeMysqlUrl(url));

let sql = `
  SELECT subject, ts
  FROM momo_ingamenews
  WHERE type = 1 AND subject IS NOT NULL AND ts IS NOT NULL
  ORDER BY ts DESC
`;
if (args.sandboxMode || args.limit > 0) {
  sql += ` LIMIT ${args.limit}`;
}

const [rows] = await conn.query(sql);
await conn.end();

console.log("fetch 记录数:", rows.length);

const grouped = new Map();
const playersSet = new Set();
const datesSet = new Set();

for (const rec of rows) {
  const subject = rec.subject;
  const ts = Number(rec.ts);
  if (!subject || !Number.isFinite(ts)) continue;

  const d = new Date(ts);
  const dateStr = d.toISOString().slice(0, 10);
  const key = `${subject}\0${dateStr}`;

  if (!grouped.has(key)) grouped.set(key, []);
  grouped.get(key).push(ts);
  playersSet.add(subject);
  datesSet.add(dateStr);
}

const results = analyzeGrouped(grouped);
const top10 = results.slice(0, 10);

// 每人一个文件夹
for (const item of results) {
  const playerDir = join(outRoot, "by-player", safeDirName(item.subject));
  mkdirSync(playerDir, { recursive: true });
  const file = join(playerDir, `${item.date_str}.json`);
  writeFileSync(file, JSON.stringify(item, null, 2), "utf8");
}

// 每日一个文件夹
for (const item of results) {
  const dateDir = join(outRoot, "by-date", item.date_str);
  mkdirSync(dateDir, { recursive: true });
  const file = join(dateDir, `${safeDirName(item.subject)}.json`);
  writeFileSync(file, JSON.stringify(item, null, 2), "utf8");
}

const summary = {
  generatedAt: new Date().toISOString(),
  query: {
    type: 1,
    limit: args.sandboxMode || args.limit > 0 ? args.limit : null,
    orderBy: "ts DESC",
    note:
      args.limit > 0
        ? "与 query.fetch_ingamenews 沙盒行为一致（仅最新 N 条）"
        : "调试模式：全库扫描",
  },
  totals: {
    recordsFetched: rows.length,
    uniquePlayers: playersSet.size,
    uniqueDates: datesSet.size,
    playerDayKeys: results.length,
  },
  coverageStats: {
    max: results[0]?.coverage ?? null,
    min: results.at(-1)?.coverage ?? null,
    avg:
      results.length > 0
        ? results.reduce((s, r) => s + r.coverage, 0) / results.length
        : null,
  },
  top10: top10.map((r) => ({
    subject: r.subject,
    date_str: r.date_str,
    coveragePercent: r.coveragePercent,
    dropCount: r.dropCount,
    segmentCount: r.segmentCount,
    totalMinutes: r.totalMinutes,
  })),
};

writeFileSync(join(outRoot, "summary.json"), JSON.stringify(summary, null, 2));
writeFileSync(join(outRoot, "top10.json"), JSON.stringify(top10, null, 2));

// 全量排名表（轻量，方便 grep / 排序对照）
const rankLines = results.map(
  (r, i) =>
    `${i + 1}\t${r.coveragePercent}%\t${r.dropCount}\t${r.date_str}\t${r.subject}`
);
writeFileSync(
  join(outRoot, "all-rankings.tsv"),
  ["rank\tcoverage%\tdrops\tdate\tsubject", ...rankLines].join("\n"),
  "utf8"
);

console.log("\n=== 汇总 ===");
console.log("记录数:", summary.totals.recordsFetched);
console.log("玩家数:", summary.totals.uniquePlayers);
console.log("(玩家,日) 组合:", summary.totals.playerDayKeys);
console.log("by-player 文件:", results.length);
console.log("by-date  文件:", results.length);
console.log("\nTop 3:");
for (const r of top10.slice(0, 3)) {
  console.log(
    `  ${r.subject} @ ${r.date_str} → ${r.coveragePercent}% (${r.dropCount}  drops, ${r.segmentCount} 段)`
  );
}
console.log("\n已写入:", outRoot);
