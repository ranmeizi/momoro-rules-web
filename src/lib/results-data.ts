import { parseRuleResult, type RuleResult } from "@/lib/result-schema";
import { prisma } from "@/lib/db/client";
import { ACTIVE_RULE_STATUS } from "@/lib/rule-status";

export interface ParsedExecution {
  id: string;
  executedAt: string;
  ruleTitle: string;
  ruleUserId: string;
  result: RuleResult;
}

export async function fetchExecutionsForStats(options: {
  userId?: string;
  limit?: number;
}): Promise<ParsedExecution[]> {
  const executions = await prisma.ruleExecution.findMany({
    where: {
      status: "SUCCESS",
      resultJson: { not: null },
      rule: { status: ACTIVE_RULE_STATUS },
      ...(options.userId ? { userId: options.userId } : {}),
    },
    orderBy: { executedAt: "desc" },
    take: options.limit,
    include: {
      rule: { select: { title: true, userId: true } },
    },
  });

  const parsed: ParsedExecution[] = [];
  for (const ex of executions) {
    try {
      parsed.push({
        id: ex.id,
        executedAt: ex.executedAt.toISOString(),
        ruleTitle: ex.rule.title,
        ruleUserId: ex.rule.userId,
        result: parseRuleResult(JSON.parse(ex.resultJson!)),
      });
    } catch {
      // skip invalid
    }
  }
  return parsed;
}
