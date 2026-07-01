-- 平台专用库 momoro_rules（与 boboan_net 游戏库完全隔离）
-- 用 DATABASE_ADMIN_URL 对应账号（如 root）执行本脚本

CREATE DATABASE IF NOT EXISTS momoro_rules
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- 运行时应用账号（仅 DML，无 DDL）
CREATE USER IF NOT EXISTS 'momoro_app'@'%' IDENTIFIED BY 'your_app_password';
GRANT SELECT, INSERT, UPDATE, DELETE ON momoro_rules.* TO 'momoro_app'@'%';
FLUSH PRIVILEGES;

-- .env 配置:
-- DATABASE_URL="mysql://momoro_app:your_app_password@HOST:3306/momoro_rules"
-- DATABASE_ADMIN_URL="mysql://root:...@HOST:3306/momoro_rules"  ← 仅 db:push 使用
