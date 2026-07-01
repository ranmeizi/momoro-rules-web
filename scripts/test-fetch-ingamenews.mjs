/**
 * 探测 fetch_ingamenews({"type": 1}) 实际返回什么数据
 *
 * 用法:
 *   pnpm sandbox:test-ingamenews
 *   pnpm sandbox:test-ingamenews -- --type 0
 *   pnpm sandbox:test-ingamenews -- --limit 30 --samples 15
 */
import { createConnection } from "mysql2/promise";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { normalizeMysqlUrl } from "./db-url.mjs";

const TYPE_LABEL = {
  0: "MVP击杀",
  1: "稀有掉落",
  2: "稀有偷窃",
};

/** 可能像 Boss/MVP 击杀公告的关键词（在 origin 里搜） */
const BOSS_HINT_PATTERNS = [
  { label: "MVP", re: /MVP/i },
  { label: "击杀", re: /击杀/ },
  { label: "击败", re: /击败/ },
  { label: "打倒", re: /打倒/ },
  { label: "消灭", re: /消灭/ },
  { label: "Boss", re: /Boss/i },
  { label: "boss", re: /\bboss\b/i },
  { label: "获得了(无稀有)", re: /获得了(?!.*稀有)/ },
];

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
  const out = { type: 1, limit: 10000, samples: 12 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--type" && argv[i + 1]) out.type = Number(argv[++i]);
    else if (a === "--limit" && argv[i + 1]) out.limit = Number(argv[++i]);
    else if (a === "--samples" && argv[i + 1]) out.samples = Number(argv[++i]);
  }
  return out;
}

/** 与 src/lib/sandbox/query.ts fetchIngameFromMySQL 保持一致 */
async function fetchIngameFromMySQL(conn, filters, rowLimit) {
  const conditions = ["1=1"];
  const params = [];

  if (filters.from) {
    conditions.push("ts >= ?");
    params.push(
      typeof filters.from === "number"
        ? filters.from
        : new Date(String(filters.from)).getTime()
    );
  }
  if (filters.to) {
    conditions.push("ts <= ?");
    params.push(
      typeof filters.to === "number"
        ? filters.to
        : new Date(String(filters.to)).getTime()
    );
  }
  if (filters.type !== undefined) {
    conditions.push("type = ?");
    params.push(Number(filters.type));
  }
  if (filters.subject) {
    conditions.push("subject = ?");
    params.push(String(filters.subject));
  }
  if (filters.map) {
    conditions.push("map = ?");
    params.push(String(filters.map));
  }
  if (filters.object) {
    conditions.push("`object` = ?");
    params.push(String(filters.object));
  }

  const sql = `
    SELECT \`key\`, map, \`object\`, objectId, origin, subject, ts, type, create_at, update_at
    FROM momo_ingamenews
    WHERE ${conditions.join(" AND ")}
    ORDER BY ts DESC
    LIMIT ${rowLimit}
  `;

  const [rows] = await conn.execute(sql, params);
  return rows;
}

function fmtTs(ts) {
  if (ts == null) return "-";
  const n = Number(ts);
  return Number.isFinite(n)
    ? new Date(n).toISOString().replace("T", " ").slice(0, 19)
    : String(ts);
}

function countBy(rows, keyFn) {
  const m = new Map();
  for (const r of rows) {
    const k = keyFn(r);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function topN(mapEntries, n) {
  return mapEntries.slice(0, n);
}

loadDotEnv();
const args = parseArgs(process.argv.slice(2));
const url = process.env.MOMO_INGAME_DB_URL;

if (!url || url.includes("请填写")) {
  console.error("✗ MOMO_INGAME_DB_URL 未配置，无法连真实库");
  process.exit(1);
}

console.log("=".repeat(72));
console.log("fetch_ingamenews 真实数据探测");
console.log("=".repeat(72));
console.log(`filters: ${JSON.stringify({ type: args.type })}`);
console.log(`LIMIT: ${args.limit} (与 SANDBOX_MAX_ROWS 默认一致)\n`);

const conn = await createConnection(normalizeMysqlUrl(url));

try {
  // 1) 库内 type 分布（全表，不受 LIMIT）
  const [typeRows] = await conn.query(`
    SELECT type, COUNT(*) AS cnt
    FROM momo_ingamenews
    GROUP BY type
    ORDER BY type
  `);
  console.log("【1】库内 type 分布（全表）");
  for (const r of typeRows) {
    const label = TYPE_LABEL[r.type] ?? `未知(${r.type})`;
    console.log(`  type=${r.type} (${label}): ${r.cnt} 条`);
  }
  console.log();

  // 2) 与平台完全相同的 fetch 查询
  const filters = { type: args.type };
  const rows = await fetchIngameFromMySQL(conn, filters, args.limit);
  console.log(`【2】fetch_ingamenews(${JSON.stringify(filters)}) 返回 ${rows.length} 条`);

  // 3) 返回行里 type 是否一致（理论上应全是 args.type）
  const typeInResult = countBy(rows, (r) => String(r.type));
  console.log("【3】返回结果中的 type 分布（若有非预期 type 说明 SQL/数据有问题）");
  if (typeInResult.length === 0) {
    console.log("  (无数据)");
  } else {
    for (const [t, c] of typeInResult) {
      const label = TYPE_LABEL[t] ?? `未知(${t})`;
      console.log(`  type=${t} (${label}): ${c} 条`);
    }
  }
  console.log();

  // 4) origin 关键词：像 Boss 击杀的占多少
  console.log("【4】origin 文本关键词（在 type=" + args.type + " 结果里）");
  const hintHits = new Map();
  let anyBossHint = 0;
  for (const r of rows) {
    const origin = String(r.origin ?? "");
    let hit = false;
    for (const { label, re } of BOSS_HINT_PATTERNS) {
      if (re.test(origin)) {
        hintHits.set(label, (hintHits.get(label) ?? 0) + 1);
        hit = true;
      }
    }
    if (hit) anyBossHint++;
  }
  console.log(`  至少命中一条 Boss/MVP 关键词: ${anyBossHint} / ${rows.length}`);
  for (const [label, c] of [...hintHits.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    「${label}」: ${c} 条`);
  }
  console.log();

  // 5) object 字段 Top（type=1 时 object 应是物品名；若出现 MVP 名可能数据标错了）
  console.log("【5】object 字段 Top 15（主语：物品名 / MVP 名）");
  for (const [name, c] of topN(countBy(rows, (r) => r.object ?? "(空)"), 15)) {
    console.log(`  ${c.toString().padStart(5)} × ${name}`);
  }
  console.log();

  // 6) subject 玩家 Top 15
  console.log("【6】subject 玩家 Top 15（被统计最多的角色）");
  for (const [name, c] of topN(countBy(rows, (r) => r.subject ?? "(空)"), 15)) {
    console.log(`  ${c.toString().padStart(5)} × ${name}`);
  }
  console.log();

  // 7) 样例记录
  console.log(`【7】样例记录（最新 ${args.samples} 条，完整 origin）`);
  for (const r of rows.slice(0, args.samples)) {
    console.log("-".repeat(72));
    console.log(`  type=${r.type} (${TYPE_LABEL[r.type] ?? "?"})  ts=${fmtTs(r.ts)}`);
    console.log(`  subject=${r.subject}  map=${r.map ?? "-"}  object=${r.object ?? "-"}`);
    console.log(`  origin: ${r.origin}`);
  }
  console.log("-".repeat(72));

  // 8) 若查 type=1，额外抽几条「像 Boss」的 origin
  if (args.type === 1 && anyBossHint > 0) {
    console.log();
    console.log("【8】type=1 但 origin 像 Boss/MVP 的样例（最多 8 条）");
    let shown = 0;
    for (const r of rows) {
      const origin = String(r.origin ?? "");
      const matched = BOSS_HINT_PATTERNS.filter(({ re }) => re.test(origin)).map(
        (p) => p.label
      );
      if (matched.length === 0) continue;
      console.log("-".repeat(72));
      console.log(`  命中: ${matched.join(", ")}`);
      console.log(`  subject=${r.subject}  object=${r.object}`);
      console.log(`  origin: ${origin}`);
      if (++shown >= 8) break;
    }
  }

  // 9) 对比：同条件直接 COUNT
  const [countRow] = await conn.query(
    "SELECT COUNT(*) AS cnt FROM momo_ingamenews WHERE type = ?",
    [args.type]
  );
  const totalForType = countRow[0]?.cnt ?? countRow?.cnt;
  console.log();
  console.log("【9】对比");
  console.log(`  库内 type=${args.type} 总条数: ${totalForType}`);
  console.log(`  fetch 实际返回（受 LIMIT ${args.limit}）: ${rows.length}`);
  if (Number(totalForType) > args.limit) {
    console.log(
      `  ⚠ 全量超过 LIMIT，规则只扫最新 ${args.limit} 条，不是全表`
    );
  }
} finally {
  await conn.end();
}

console.log();
console.log("完成。也可对比: pnpm sandbox:test-ingamenews -- --type 0");
