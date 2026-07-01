import { createConnection } from "mysql2/promise";
import mysql from "mysql2";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { normalizeMysqlUrl, parseMysqlUrl } from "./db-url.mjs";

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

loadDotEnv();

const adminUrl = process.env.DATABASE_ADMIN_URL;
const appUrl = process.env.DATABASE_URL;

if (!adminUrl || !appUrl) {
  console.error("需要 DATABASE_ADMIN_URL 和 DATABASE_URL");
  process.exit(1);
}

const { user, password, database } = parseMysqlUrl(appUrl);
const escapedUser = mysql.escapeId(user).replace(/`/g, "");
const escapedPass = mysql.escape(password);

const conn = await createConnection(normalizeMysqlUrl(adminUrl));

try {
  await conn.query(
    `CREATE DATABASE IF NOT EXISTS ${mysql.escapeId(database)}`
  );
  await conn.query(
    `CREATE USER IF NOT EXISTS '${escapedUser}'@'%' IDENTIFIED BY ${escapedPass}`
  );
  await conn.query(
    `ALTER USER '${escapedUser}'@'%' IDENTIFIED BY ${escapedPass}`
  );
  await conn.query(
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ${mysql.escapeId(database)}.* TO '${escapedUser}'@'%'`
  );
  await conn.query("FLUSH PRIVILEGES");
  console.log(`✓ 已创建/更新应用账号 ${user}@${database}`);
} finally {
  await conn.end();
}

const verify = await createConnection(normalizeMysqlUrl(appUrl));
await verify.query("SELECT 1");
await verify.end();
console.log(`✓ ${user} 连接验证成功`);
