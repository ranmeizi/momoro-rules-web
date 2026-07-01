/**
 * 只读 SQL 查询层 — 连接游戏公告库 momo_ingamenews（MySQL）
 * 与平台应用库 DATABASE_URL 完全隔离，使用 MOMO_INGAME_DB_URL
 */

const FORBIDDEN_SQL = [
  /\bINSERT\b/i,
  /\bUPDATE\b/i,
  /\bDELETE\b/i,
  /\bDROP\b/i,
  /\bCREATE\b/i,
  /\bALTER\b/i,
  /\bTRUNCATE\b/i,
  /\bGRANT\b/i,
  /\bREVOKE\b/i,
  /\bREPLACE\b/i,
  /\bLOAD\b/i,
  /\bINTO\b/i,
];

const MAX_ROWS = parseInt(process.env.SANDBOX_MAX_ROWS ?? "10000", 10);

/** momo_ingamenews 表行结构 */
export interface MomoIngameNewsRow {
  key: string;
  map: string | null;
  object: string;
  objectId: string | null;
  origin: string;
  subject: string;
  ts: number;
  type: number;
  create_at: string;
  update_at: string;
}

/** type 枚举：0=MVP击杀 1=稀有物品掉落 2=稀有物品偷窃 */
export const NEWS_TYPE = {
  MVP_KILL: 0,
  RARE_DROP: 1,
  RARE_STEAL: 2,
} as const;

const MOCK_NEWS: MomoIngameNewsRow[] = generateMockData();

function generateMockData(): MomoIngameNewsRow[] {
  const players = ["剑心无痕", "夜雨听风", "挂机小王子", "欧皇附体", "脚本猎人"];
  const items = ["龙纹神剑", "凤凰之羽", "玄铁重甲", "九转金丹"];
  const maps = ["梦罗克", "斐扬", "吉芬", "普隆德拉"];
  const rows: MomoIngameNewsRow[] = [];
  const now = Date.now();

  for (let i = 0; i < 200; i++) {
    const subject = players[i % players.length];
    const bias = subject === "挂机小王子" || subject === "脚本猎人" ? 3 : 1;
    if (Math.random() > 0.5 / bias) continue;

    const ts = now - Math.floor(Math.random() * 7 * 86400000);
    rows.push({
      key: `mock_${i}`,
      map: maps[i % maps.length],
      object: items[i % items.length],
      objectId: `item_${i}`,
      origin: `[系统] ${subject} 获得了 ${items[i % items.length]}`,
      subject,
      ts,
      type: i % 5 === 0 ? NEWS_TYPE.MVP_KILL : NEWS_TYPE.RARE_DROP,
      create_at: new Date(ts).toISOString(),
      update_at: new Date(ts).toISOString(),
    });
  }
  return rows.sort((a, b) => b.ts - a.ts);
}

function hasIngameDb(): boolean {
  const url = process.env.MOMO_INGAME_DB_URL;
  return Boolean(url && !url.includes("请填写"));
}

function toTimestamp(value: unknown): number {
  if (typeof value === "number") return value;
  return new Date(String(value)).getTime();
}

export class ReadOnlyQuery {
  private rowLimit = MAX_ROWS;

  validateSql(sql: string): void {
    const trimmed = sql.trim();
    if (!/^\s*SELECT\b/i.test(trimmed)) {
      throw new Error("仅允许 SELECT 查询");
    }
    for (const pattern of FORBIDDEN_SQL) {
      if (pattern.test(trimmed)) {
        throw new Error(`SQL 包含禁止操作: ${pattern.source}`);
      }
    }
    if (trimmed.includes(";") && trimmed.indexOf(";") < trimmed.length - 1) {
      throw new Error("禁止多语句 SQL");
    }
    // 仅允许查询 momo_ingamenews 表
    if (!/\bmomo_ingamenews\b/i.test(trimmed)) {
      throw new Error("仅允许查询 momo_ingamenews 表");
    }
  }

  async execute(
    sql: string,
    params?: Record<string, unknown> | unknown[]
  ): Promise<Record<string, unknown>[]> {
    this.validateSql(sql);

    if (hasIngameDb()) {
      return this.executeMySQL(sql, params);
    }

    return MOCK_NEWS.slice(0, this.rowLimit) as unknown as Record<
      string,
      unknown
    >[];
  }

  private async executeMySQL(
    sql: string,
    params?: Record<string, unknown> | unknown[]
  ): Promise<Record<string, unknown>[]> {
    try {
      const mysql = await import("mysql2/promise");
      const conn = await mysql.createConnection(
        process.env.MOMO_INGAME_DB_URL!
      );
      try {
        const paramList = Array.isArray(params)
          ? params
          : params
            ? Object.values(params)
            : [];
        const [rows] = await conn.execute(
          `SELECT * FROM (${sql}) AS _q LIMIT ${this.rowLimit}`,
          paramList as (string | number | null)[]
        );
        return rows as Record<string, unknown>[];
      } finally {
        await conn.end();
      }
    } catch (e) {
      throw new Error(
        `MySQL 查询失败: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }

  /** 高层 API：查询 momo_ingamenews */
  async fetch_ingamenews(
    filters: Record<string, unknown>
  ): Promise<MomoIngameNewsRow[]> {
    if (hasIngameDb()) {
      return this.fetchIngameFromMySQL(filters);
    }
    return this.filterMockNews(filters);
  }

  /** 兼容旧 API 名称 */
  async fetch_announcements(
    filters: Record<string, unknown>
  ): Promise<MomoIngameNewsRow[]> {
    return this.fetch_ingamenews(filters);
  }

  private async fetchIngameFromMySQL(
    filters: Record<string, unknown>
  ): Promise<MomoIngameNewsRow[]> {
    const conditions: string[] = ["1=1"];
    const params: unknown[] = [];

    if (filters.from) {
      conditions.push("ts >= ?");
      params.push(toTimestamp(filters.from));
    }
    if (filters.to) {
      conditions.push("ts <= ?");
      params.push(toTimestamp(filters.to));
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
      LIMIT ${this.rowLimit}
    `;

    const rows = await this.executeMySQL(sql, params);
    return rows as unknown as MomoIngameNewsRow[];
  }

  private filterMockNews(
    filters: Record<string, unknown>
  ): MomoIngameNewsRow[] {
    let rows = [...MOCK_NEWS];

    if (filters.from) {
      const from = toTimestamp(filters.from);
      rows = rows.filter((r) => r.ts >= from);
    }
    if (filters.to) {
      const to = toTimestamp(filters.to);
      rows = rows.filter((r) => r.ts <= to);
    }
    if (filters.type !== undefined) {
      rows = rows.filter((r) => r.type === Number(filters.type));
    }
    if (filters.subject) {
      rows = rows.filter((r) => r.subject === filters.subject);
    }
    if (filters.map) {
      rows = rows.filter((r) => r.map === filters.map);
    }
    if (filters.object) {
      rows = rows.filter((r) => r.object === filters.object);
    }

    return rows.slice(0, this.rowLimit);
  }
}

/** MySQL 只读账号创建脚本（在 boboan_net 库执行） */
export const READONLY_USER_SQL = `
-- 在 MySQL 上创建只读账号（仅允许 SELECT momo_ingamenews）
CREATE USER IF NOT EXISTS 'rules_readonly'@'%' IDENTIFIED BY 'your_secure_password';
GRANT SELECT ON boboan_net.momo_ingamenews TO 'rules_readonly'@'%';
FLUSH PRIVILEGES;

-- 验证：此账号应无法执行写操作
-- mysql -u rules_readonly -p boboan_net
-- INSERT INTO momo_ingamenews VALUES (...);  -- 应失败
`.trim();
