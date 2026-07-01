/**
 * 执行结果归一化 — 修正 AI 常见偏差后再做 schema 校验
 */

export function normalizeRuleResult(
  raw: unknown,
  ruleId: string
): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }

  const obj = { ...(raw as Record<string, unknown>) };

  if (!obj.executedAt && typeof obj.executAt === "string") {
    obj.executedAt = obj.executAt;
  }
  delete obj.executAt;

  if (!obj.executedAt) {
    obj.executedAt = new Date().toISOString();
  }

  if (!obj.version) {
    obj.version = "1.0";
  }

  if (!obj.ruleId) {
    obj.ruleId = ruleId;
  }

  if (Array.isArray(obj.suspiciousPlayers)) {
    obj.suspiciousPlayers = obj.suspiciousPlayers.map((player) => {
      if (!player || typeof player !== "object" || Array.isArray(player)) {
        return player;
      }
      const p = { ...(player as Record<string, unknown>) };
      if (typeof p.score === "number") {
        p.score = Math.min(100, Math.max(0, p.score));
      }
      return p;
    });
  }

  return obj;
}
