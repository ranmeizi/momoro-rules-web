# Momoro Rules Web

稀有掉落公告分析平台 — 专业玩家用自然语言定义规则，AI 生成代码，沙盒执行并排名可疑玩家。

## 技术栈

- **Next.js 15** — React 前端 + API Routes 后端
- **Prisma + MySQL** — 平台库 `momoro_rules`（`DATABASE_URL`）
- **MySQL 只读** — 游戏库 `boboan_net`（`MOMO_INGAME_DB_URL`）
- **JWT** — 会话认证
- **OpenAI** — 自然语言 → Python 规则代码

## 快速开始

```bash
# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env：填 momoro_rules 和 boboan_net 两个库的连接

# 初始化平台库（MySQL 上先执行 init SQL）
mysql -h YOUR_HOST -u root -p < prisma/init-platform.sql

# 同步表结构 & 种子数据
npm run db:push
npm run db:seed

# 开发
npm run dev
```

访问 http://localhost:3000 ，使用演示账号登录：

- 用户名：`demo`
- 密码：`demo123456`

## 功能流程

1. **登录** — 账号由管理员手动发放
2. **创建规则** — 自然语言描述 → AI 生成 Python 代码（每日 1 次）
3. **审核** — 管理员通过 API 审核规则
4. **执行** — 沙盒运行已通过规则（每日 1 次）
5. **查看结果** — 归一化数据展示 + 可疑玩家排行榜

## 管理员操作

```bash
# 查看待审核规则
curl -H "x-admin-key: YOUR_KEY" http://localhost:3000/api/admin/review

# 审核通过
curl -X POST -H "x-admin-key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"ruleId":"RULE_ID","action":"approve"}' \
  http://localhost:3000/api/admin/review
```

## 文档

- [环境配置清单](docs/ENV_SETUP.md) — **需你补齐的信息**
- [沙盒设计](docs/SANDBOX.md) — WASM + SQL 权限
- [设计文档](design/main.md) — 原始需求

## 项目结构

```
src/
├── app/                  # 页面 + API Routes
│   ├── api/auth/         # 登录/JWT
│   ├── api/rules/        # 规则 CRUD + 执行
│   ├── api/results/      # 结果与排行榜
│   └── api/admin/        # 审核接口
├── lib/
│   ├── ai/               # AI 代码生成 + 校验规则
│   ├── sandbox/          # 沙盒执行 + 只读 SQL
│   ├── result-schema.ts  # 归一化结果标准
│   └── auth.ts           # JWT 工具
prisma/
└── schema.prisma         # 数据模型
```

## 生产部署建议（2 CPU / 2GB）

- `DATABASE_URL` → `momoro_rules` 平台专用库
- `MOMO_INGAME_DB_URL` → `boboan_net` 游戏库只读
- 设置 `LLM_API_KEY` 启用百炼 AI 代码生成
- 沙盒串行执行，避免内存溢出
- 使用 `npm run build && npm start`
