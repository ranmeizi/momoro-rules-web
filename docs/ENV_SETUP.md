# 环境配置清单

## 三库 / 双连接架构

| 环境变量 | 库 | 用途 |
|----------|-----|------|
| `DATABASE_URL` | `momoro_rules` | 运行时（`momoro_app`，仅 DML） |
| `DATABASE_ADMIN_URL` | `momoro_rules` | 开发迁移（`db:push`，需 CREATE/ALTER） |
| `BOBOAN_NET_DB_URL` | `boboan_net` | 登录 user 表 |
| `MOMO_INGAME_DB_URL` | `boboan_net` | 沙盒只读 momo_ingamenews |

`BOBOAN_NET` 与 `MOMO_INGAME` 同库不同账号，平台库 `momoro_rules` 完全独立。

---

## 登录

对接 `boboan_net.user` 表，密码算法与 boboan-nest 一致：

- PBKDF2-SHA512，1000 轮，32 字节
- 盐存 `user.salt`，哈希存 `user.password`
- 支持用户名或邮箱登录
- 仅 `status = active` 可登录

登录账号需：

```sql
GRANT SELECT ON boboan_net.user TO 'your_login_user'@'%';
```

表结构变更后同步 Prisma：

```bash
npm run db:pull:boboan
npm run db:generate
```

---

## 平台库初始化

```bash
mysql -h YOUR_HOST -u root -p < prisma/init-platform.sql
# .env 填 DATABASE_ADMIN_URL（root）和 DATABASE_URL（momoro_app）
pnpm db:push    # 使用 DATABASE_ADMIN_URL
```

`boboan.prisma` 映射已有表，**不要**对 boboan 执行 `db push`。

---

## user 表字段

| 字段 | 说明 |
|------|------|
| id | UUID 主键 |
| username | 用户名 |
| password + salt | PBKDF2 密码 |
| email | 邮箱（可作登录名） |
| nickname | 昵称 |
| status | active / inactive / locked |
| picture | 头像 |

## momo_ingamenews 表

见 `prisma/boboan.prisma` 中 `MomoIngameNews` 模型。
