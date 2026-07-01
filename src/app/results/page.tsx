import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { aggregateLeaderboard } from "@/lib/result-schema";
import { fetchExecutionsForStats } from "@/lib/results-data";
import ResultsView from "./ResultsView";

export default async function ResultsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [globalExecutions, myExecutions] = await Promise.all([
    fetchExecutionsForStats({ limit: 500 }),
    fetchExecutionsForStats({ userId: session.sub, limit: 200 }),
  ]);

  const globalLeaderboard = aggregateLeaderboard(
    globalExecutions.map((e) => e.result)
  );
  const myLeaderboard = aggregateLeaderboard(
    myExecutions.map((e) => e.result)
  );

  return (
    <ResultsView
      globalLeaderboard={globalLeaderboard}
      myLeaderboard={myLeaderboard}
      myExecutions={myExecutions.map(({ ruleUserId: _, ...rest }) => rest)}
    />
  );
}
