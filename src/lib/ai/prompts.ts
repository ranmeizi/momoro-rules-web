/**
 * AI 代码生成约束与系统提示词
 * 详见 docs/ENV_SETUP.md 中需补齐的环境描述
 */

export const CODE_GENERATION_RULES = `
## 代码生成硬性规则

1. 语言：仅输出 Python 3.11+ 代码，不要 markdown 代码块包裹
2. 入口：必须定义 \`def run(query) -> dict\` 函数，接收唯一参数 query
3. query 对象仅允许调用以下方法（只读 SQL）：
   - query.execute(sql: str, params: dict | list | None = None) -> list[dict]
     仅允许 SELECT momo_ingamenews 表
   - query.fetch_ingamenews(filters: dict) -> list[dict]  # 推荐，高层抽象
   - query.fetch_announcements(filters: dict)  # 同 fetch_ingamenews，兼容别名
4. 禁止：import os/sys/subprocess/socket/requests/urllib/open/eval/exec/__import__
5. 禁止：任何写操作 SQL（INSERT/UPDATE/DELETE/DROP/CREATE/ALTER/TRUNCATE/GRANT）
6. 禁止：文件 I/O、网络请求、多线程
7. 返回：必须符合 RuleResult v1.0 schema（见下方）
8. SQL 必须使用参数化查询，禁止字符串拼接用户输入
9. 单次 query.execute 返回行数不得超过 SANDBOX_MAX_ROWS
10. 时间范围：仅当用户在规则描述中**明确提到**时才加 from/to；未提及则 **不传 from/to**，查全量历史（最多 SANDBOX_MAX_ROWS 条）。**禁止**默认今天、7 天、30 天，禁止用 utcnow/today/timedelta 自行造窗口
11. 公告类型：默认 **type=1**（稀有物品掉落）。用户说「打怪/挂机/刷怪/掉落」均指 type=1，**不是** type=0 MVP 击杀。仅用户明确说 MVP/Boss 击杀时才用 type=0
12. 返回字段名必须精确：executedAt（不是 executAt）；score 必须在 0-100 之间，超出用 min(100, ...) 限制
`.trim();

export const RULE_RESULT_SCHEMA_DOC = `
## RuleResult v1.0 返回格式

{
  "version": "1.0",
  "ruleId": "<由运行时注入>",
  "executedAt": "<ISO8601，如 2026-07-01T12:00:00Z>",
  "summary": "简要说明本规则发现了什么",
  "totalScanned": 1234,
  "suspiciousPlayers": [
    {
      "playerId": "玩家ID",
      "playerName": "昵称(可选)",
      "score": 85,
      "reasons": ["原因1", "原因2"],
      "evidence": [{"type": "announcement", "summary": "6月15日异常掉落", "data": {"date": "2026-06-15"}}],
      "suspiciousTimes": [{"label": "6月15日异常时段", "from": "2026-06-15T02:00:00Z", "to": "2026-06-15T08:00:00Z"}],
      "timeRange": {"from": "...", "to": "..."}
    }
  ],
  "metadata": {"timeWindowDays": null}
}
`.trim();

export const TIME_RANGE_POLICY = `
## 时间范围策略（重要）

- 用户描述中**有**时间范围（如「过去7天」「30天内」「本周」）→ 换算为 from/to 传入 fetch_ingamenews
- 用户描述中**没有**时间范围 → **不要**自行默认今天/7天/30天；**不要**用 datetime.utcnow()、today、timedelta、strftime 造 from/to
- 未指定时间时 fetch_ingamenews 只传 \`{"type": 1}\`（及 subject 等），**不传 from/to** → 查全量历史
- metadata.timeWindowDays：有明确窗口时填写天数；查全部时填 null 或省略
`.trim();

export const ANNOUNCEMENT_TYPE_POLICY = `
## 公告 type 策略（重要）

| type | 含义 | 何时使用 |
|------|------|----------|
| 0 | MVP/Boss **击杀**公告 | 仅用户明确说 MVP/击杀 Boss |
| 1 | **稀有物品掉落** | **默认**。打怪、挂机、刷怪、farm、高强度打怪 → 都是 type=1 |
| 2 | 稀有物品偷窃 | 仅用户明确说偷窃 |

示例（用户未指定时间，分析打怪掉落）：
\`\`\`python
records = query.fetch_ingamenews({"type": 1})  # 全量 type=1，不要 from/to，不要 type=0
\`\`\`
`.trim();

/** 游戏公告库环境描述 — 来自 momo_ingamenews 表 */
export const DATABASE_ENV_DESCRIPTION = `
## 数据库环境

### 连接信息
- 数据库类型: MySQL 8.0
- 库名: boboan_net
- 环境变量: MOMO_INGAME_DB_URL（与平台用户库 DATABASE_URL 完全隔离）
- 只读账号: rules_readonly（仅 SELECT momo_ingamenews）

### 表结构: momo_ingamenews（游戏内公告）

| 字段 | 类型 | 说明 |
|------|------|------|
| key | varchar(100) | 主键，唯一 key 及 redis key |
| map | varchar(100) | MVP 地图 |
| object | varchar(100) | 主语（物品名 / MVP 名） |
| objectId | varchar(100) | 主语 ID |
| origin | text | 原始消息全文 |
| subject | varchar(100) | 角色名（玩家标识，用于 suspiciousPlayers.playerId） |
| ts | bigint | 时间戳（毫秒） |
| type | int | 0=MVP击杀, 1=稀有物品掉落, 2=稀有物品偷窃 |
| create_at | datetime(6) | 创建时间 |
| update_at | datetime(6) | 更新时间 |

### type 枚举（默认用 1）
- 0: MVP/Boss **击杀** — 不是「打怪掉落」，勿与挂机分析混淆
- 1: **稀有物品掉落** — 打怪/挂机/刷怪分析 **必须用此 type**
- 2: 稀有物品偷窃 — 极少使用

### 可用 Tool 抽象
- query.fetch_ingamenews({ from?, to?, type?, subject?, map?, object? })
  - **默认调用**: \`query.fetch_ingamenews({"type": 1})\` 全量稀有掉落
  - from/to: 仅用户指定时间时才传；**不传则查全部**
  - type: 默认 **1**；0 仅 MVP 击杀专项规则
  - subject: 角色名精确匹配
  - map: 地图名
  - object: 物品/MVP 名

### 编写规则建议
- 玩家标识使用 subject（角色名）
- **默认** \`fetch_ingamenews({"type": 1})\` 查全量稀有掉落
- 用户说打怪/挂机/刷怪 = 统计 type=1 掉落频率，不是 type=0 杀 Boss
- 仅用户指定时间范围时才传 from/to
- 可疑行为示例：短时间高频掉落、固定间隔掉落、跨地图异常移动后掉落

### 业务上下文
- 游戏: RO 私服（梦罗克/RO 类）
- 数据来源: 游戏内系统公告频道
- 分析目标: 通过公告时间和主体识别可疑挂机/脚本玩家
`.trim();

import {
  userMentionedTimeRange,
} from "./code-query-rules";

export function buildSystemPrompt(): string {
  return [
    "你是 Momoro Rules 平台的规则代码生成助手。",
    "用户是专业玩家而非程序员，请将其自然语言规则翻译为安全、高效的 Python 代码。",
    "",
    CODE_GENERATION_RULES,
    "",
    RULE_RESULT_SCHEMA_DOC,
    "",
    TIME_RANGE_POLICY,
    "",
    ANNOUNCEMENT_TYPE_POLICY,
    "",
    DATABASE_ENV_DESCRIPTION,
  ].join("\n");
}

export function buildUserPrompt(description: string, ruleId: string): string {
  const hasTime = userMentionedTimeRange(description);
  const timeHint = hasTime
    ? "用户提到了时间范围，请换算为 from/to 传入 fetch_ingamenews。"
    : "用户**未**提到时间范围：fetch_ingamenews 只传 {\"type\": 1}，**禁止**传 from/to，**禁止** timedelta/today/utcnow 造窗口，查全量历史。";

  return [
    `规则 ID: ${ruleId}`,
    "",
    "用户规则描述:",
    description,
    "",
    "请只输出 Python 代码，包含 run(query) 函数。",
    "硬性要求：fetch_ingamenews 必须 type=1（稀有掉落）；打怪/挂机≠MVP击杀(type=0)。",
    timeHint,
    "返回 dict：ruleId、executedAt（非 executAt）、score 0-100、suspiciousTimes、evidence.data.date。",
  ].join("\n");
}
