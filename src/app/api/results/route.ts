import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { aggregateLeaderboard } from "@/lib/result-schema";
import { fetchExecutionsForStats } from "@/lib/results-data";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const [globalExecutions, myExecutions] = await Promise.all([
    fetchExecutionsForStats({ limit: 500 }),
    fetchExecutionsForStats({ userId: session.sub, limit: 200 }),
  ]);

  const toApi = (list: typeof myExecutions) =>
    list.map((ex) => ({
      id: ex.id,
      ruleId: ex.result.ruleId,
      ruleTitle: ex.ruleTitle,
      executedAt: ex.executedAt,
      result: ex.result,
    }));

  return NextResponse.json({
    globalLeaderboard: aggregateLeaderboard(
      globalExecutions.map((e) => e.result)
    ),
    myLeaderboard: aggregateLeaderboard(myExecutions.map((e) => e.result)),
    myExecutions: toApi(myExecutions),
  });
}
