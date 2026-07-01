import { z } from "zod";

/** 可疑玩家条目 — 规则执行结果的标准单元 */
export const SuspiciousPlayerSchema = z.object({
  playerId: z.string().describe("游戏内玩家唯一标识"),
  playerName: z.string().optional().describe("玩家昵称"),
  score: z.number().min(0).max(100).describe("可疑度 0-100"),
  reasons: z.array(z.string()).describe("可疑原因列表"),
  evidence: z
    .array(
      z.object({
        type: z.string().describe("证据类型，如 announcement / pattern / timing"),
        summary: z.string(),
        data: z.record(z.unknown()).optional(),
      })
    )
    .optional(),
  timeRange: z
    .object({
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
    })
    .optional(),
  /** 可疑时间点数组 — 每段对应一张掉落核查表 */
  suspiciousTimes: z
    .array(
      z.object({
        label: z.string().optional(),
        from: z.string(),
        to: z.string(),
      })
    )
    .optional(),
});

export type SuspiciousPlayer = z.infer<typeof SuspiciousPlayerSchema>;

/** 规则执行归一化结果 */
export const RuleResultSchema = z.object({
  version: z.literal("1.0"),
  ruleId: z.string(),
  executedAt: z.string().datetime(),
  summary: z.string().describe("规则执行摘要"),
  totalScanned: z.number().int().nonnegative().optional(),
  suspiciousPlayers: z.array(SuspiciousPlayerSchema),
  metadata: z
    .object({
      timeWindowDays: z.number().optional(),
      filters: z.record(z.unknown()).optional(),
    })
    .optional(),
});

export type RuleResult = z.infer<typeof RuleResultSchema>;

export function parseRuleResult(json: unknown): RuleResult {
  return RuleResultSchema.parse(json);
}

export function validateRuleResult(json: unknown): {
  success: boolean;
  data?: RuleResult;
  error?: string;
} {
  const result = RuleResultSchema.safeParse(json);
  if (result.success) return { success: true, data: result.data };
  return { success: false, error: result.error.message };
}

/** 排行榜聚合项 */
export interface LeaderboardEntry {
  playerId: string;
  playerName?: string;
  maxScore: number;
  hitCount: number;
  topReasons: string[];
  ruleContributors: number;
  timeRange?: { from?: string; to?: string };
}

export function aggregateLeaderboard(
  results: RuleResult[]
): LeaderboardEntry[] {
  const map = new Map<
    string,
    {
      playerName?: string;
      scores: number[];
      reasons: string[];
      rules: Set<string>;
      timeRange?: { from?: string; to?: string };
    }
  >();

  for (const result of results) {
    for (const player of result.suspiciousPlayers) {
      const existing = map.get(player.playerId) ?? {
        playerName: player.playerName,
        scores: [],
        reasons: [],
        rules: new Set<string>(),
        timeRange: player.timeRange,
      };
      const prevMax = existing.scores.length
        ? Math.max(...existing.scores)
        : -1;
      existing.scores.push(player.score);
      existing.reasons.push(...player.reasons);
      if (player.playerName) existing.playerName = player.playerName;
      existing.rules.add(result.ruleId);
      if (player.score >= prevMax && player.timeRange) {
        existing.timeRange = player.timeRange;
      }
      map.set(player.playerId, existing);
    }
  }

  return Array.from(map.entries())
    .map(([playerId, data]) => {
      const reasonCounts = new Map<string, number>();
      for (const r of data.reasons) {
        reasonCounts.set(r, (reasonCounts.get(r) ?? 0) + 1);
      }
      const topReasons = [...reasonCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([r]) => r);

      return {
        playerId,
        playerName: data.playerName,
        maxScore: Math.max(...data.scores),
        hitCount: data.scores.length,
        topReasons,
        ruleContributors: data.rules.size,
        timeRange: data.timeRange,
      };
    })
    .sort((a, b) => b.maxScore - a.maxScore || b.hitCount - a.hitCount);
}
