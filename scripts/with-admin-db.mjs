/**
 * DDL 操作：将 DATABASE_ADMIN_URL（自动 URL 编码密码）注入 DATABASE_URL
 */
import { execSync } from "node:child_process";
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

loadDotEnv();

const adminUrl = process.env.DATABASE_ADMIN_URL;
if (!adminUrl) {
  console.error(
    "缺少 DATABASE_ADMIN_URL：请配置有 CREATE/ALTER 权限的账号（仅 db:push 使用）"
  );
  process.exit(1);
}

// 覆盖 DATABASE_URL；Prisma 不会用 .env 覆盖已存在的环境变量
process.env.DATABASE_URL = normalizeMysqlUrl(adminUrl);

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("用法: node scripts/with-admin-db.mjs <command>");
  process.exit(1);
}

execSync(args.join(" "), { stdio: "inherit", env: process.env });
