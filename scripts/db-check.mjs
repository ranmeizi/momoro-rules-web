import { createConnection } from "mysql2/promise";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { normalizeMysqlUrl } from "./db-url.mjs";

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

async function test(name, url) {
  if (!url) {
    console.log(`✗ ${name}: 未配置`);
    return false;
  }
  try {
    const conn = await createConnection(normalizeMysqlUrl(url));
    await conn.query("SELECT 1");
    await conn.end();
    console.log(`✓ ${name}: 连接成功`);
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`✗ ${name}: ${msg}`);
    return false;
  }
}

loadDotEnv();

console.log("检测数据库连接...\n");
const results = await Promise.all([
  test("DATABASE_URL (运行时)", process.env.DATABASE_URL),
  test("DATABASE_ADMIN_URL (db:push)", process.env.DATABASE_ADMIN_URL),
  test("BOBOAN_NET_DB_URL (登录)", process.env.BOBOAN_NET_DB_URL),
  test("MOMO_INGAME_DB_URL (沙盒)", process.env.MOMO_INGAME_DB_URL),
]);

process.exit(results.every(Boolean) ? 0 : 1);
