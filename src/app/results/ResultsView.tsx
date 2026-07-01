"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import type { LeaderboardEntry, RuleResult, SuspiciousPlayer } from "@/lib/result-schema";
import { extractSuspiciousTimeSlots } from "@/lib/suspicious-times";
import PlayerDropPanel from "./PlayerDropPanel";

interface ExecutionItem {
  id: string;
  executedAt: string;
  ruleTitle: string;
  result: RuleResult;
}

type LeaderboardTab = "global" | "mine";

export default function ResultsView({
  globalLeaderboard,
  myLeaderboard,
  myExecutions,
}: {
  globalLeaderboard: LeaderboardEntry[];
  myLeaderboard: LeaderboardEntry[];
  myExecutions: ExecutionItem[];
}) {
  const [tab, setTab] = useState<LeaderboardTab>("global");
  const leaderboard = tab === "global" ? globalLeaderboard : myLeaderboard;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <Link
        href="/dashboard"
        className="text-sm text-[var(--color-muted)] hover:text-white mb-6 inline-block"
      >
        ← 返回控制台
      </Link>

      <h1 className="text-2xl font-bold mb-8">结果与排行榜</h1>

      <section className="mb-10">
        <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
          <h2 className="font-semibold text-lg">🏆 可疑玩家排行榜</h2>
          <div className="flex rounded-lg border border-[var(--color-card-border)] p-0.5 text-sm">
            <button
              type="button"
              onClick={() => setTab("global")}
              className={`px-4 py-1.5 rounded-md transition-colors ${
                tab === "global"
                  ? "bg-[var(--color-primary)] text-white"
                  : "text-[var(--color-muted)] hover:text-white"
              }`}
            >
              总榜
            </button>
            <button
              type="button"
              onClick={() => setTab("mine")}
              className={`px-4 py-1.5 rounded-md transition-colors ${
                tab === "mine"
                  ? "bg-[var(--color-primary)] text-white"
                  : "text-[var(--color-muted)] hover:text-white"
              }`}
            >
              我的榜
            </button>
          </div>
        </div>
        <p className="text-xs text-[var(--color-muted)] mb-4">
          {tab === "global"
            ? "汇总全平台有效规则（未作废）的执行结果"
            : "仅统计你创建且未作废的规则执行结果"}
        </p>
        {leaderboard.length === 0 ? (
          <p className="text-[var(--color-muted)] text-sm">
            暂无数据。作废的规则不参与统计。
          </p>
        ) : (
          <LeaderboardTable entries={leaderboard} />
        )}
      </section>

      <section>
        <h2 className="font-semibold text-lg mb-4">我的执行结果详情</h2>
        {myExecutions.length === 0 ? (
          <p className="text-[var(--color-muted)] text-sm">暂无有效执行记录</p>
        ) : (
          <div className="space-y-4">
            {myExecutions.map((ex) => (
              <div key={ex.id} className="card p-5">
                <div className="flex justify-between mb-3">
                  <span className="font-medium">{ex.ruleTitle}</span>
                  <span className="text-xs text-[var(--color-muted)]">
                    {formatDate(ex.executedAt)}
                  </span>
                </div>
                <p className="text-sm text-[var(--color-muted)] mb-4">
                  {ex.result.summary}
                </p>
                {ex.result.suspiciousPlayers.length > 0 && (
                  <div className="space-y-2">
                    {ex.result.suspiciousPlayers.map((p) => (
                      <SuspiciousPlayerCard
                        key={`${ex.id}-${p.playerId}`}
                        player={p}
                        fallbackCenter={ex.executedAt}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function LeaderboardTable({ entries }: { entries: LeaderboardEntry[] }) {
  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--color-card-border)] text-[var(--color-muted)]">
            <th className="text-left p-4">排名</th>
            <th className="text-left p-4">玩家</th>
            <th className="text-left p-4">可疑度</th>
            <th className="text-left p-4">命中次数</th>
            <th className="text-left p-4">主要原因</th>
            <th className="text-left p-4">操作</th>
          </tr>
        </thead>
        <tbody>
          {entries.slice(0, 20).map((entry, i) => (
            <LeaderboardRow key={entry.playerId} entry={entry} rank={i + 1} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LeaderboardRow({
  entry,
  rank,
}: {
  entry: LeaderboardEntry;
  rank: number;
}) {
  const [showDrops, setShowDrops] = useState(false);
  const player: SuspiciousPlayer = {
    playerId: entry.playerId,
    playerName: entry.playerName,
    score: entry.maxScore,
    reasons: entry.topReasons,
    timeRange: entry.timeRange,
  };

  return (
    <>
      <tr className="border-b border-[var(--color-card-border)]/50 align-top">
        <td className="p-4 font-mono">{rank}</td>
        <td className="p-4">
          <div>{entry.playerName ?? entry.playerId}</div>
          {entry.playerName && (
            <div className="text-xs text-[var(--color-muted)]">
              {entry.playerId}
            </div>
          )}
        </td>
        <td className="p-4">
          <ScoreBar score={entry.maxScore} />
        </td>
        <td className="p-4">{entry.hitCount}</td>
        <td className="p-4 text-[var(--color-muted)]">
          {entry.topReasons.join("；") || "—"}
        </td>
        <td className="p-4">
          <button
            type="button"
            onClick={() => setShowDrops((v) => !v)}
            className="text-xs text-[var(--color-primary)] hover:underline whitespace-nowrap"
          >
            {showDrops
              ? "收起"
              : `查看掉落（${extractSuspiciousTimeSlots(player).length} 段）`}
          </button>
        </td>
      </tr>
      {showDrops && (
        <tr className="border-b border-[var(--color-card-border)]/50 bg-black/20">
          <td colSpan={6} className="p-4">
            <PlayerDropPanel player={player} autoExpand />
          </td>
        </tr>
      )}
    </>
  );
}

function SuspiciousPlayerCard({
  player,
  fallbackCenter,
}: {
  player: SuspiciousPlayer;
  fallbackCenter: string;
}) {
  return (
    <div className="p-3 rounded-lg bg-black/30 text-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <span className="font-medium">
            {player.playerName ?? player.playerId}
          </span>
          {player.reasons[0] && (
            <span className="text-[var(--color-muted)] ml-2">
              {player.reasons[0]}
            </span>
          )}
          {player.timeRange?.from && (
            <p className="text-xs text-[var(--color-muted)] mt-1">
              可疑时段：{formatDate(player.timeRange.from)}
              {player.timeRange.to
                ? ` ~ ${formatDate(player.timeRange.to)}`
                : ""}
            </p>
          )}
        </div>
        <span className="font-mono text-[var(--color-accent)] shrink-0">
          {player.score}
        </span>
      </div>
      <PlayerDropPanel
        player={player}
        fallbackCenter={fallbackCenter}
      />
    </div>
  );
}

function ScoreBar({ score }: { score: number }) {
  const color =
    score >= 80
      ? "bg-[var(--color-danger)]"
      : score >= 50
        ? "bg-[var(--color-warning)]"
        : "bg-[var(--color-accent)]";
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="font-mono text-xs">{score}</span>
    </div>
  );
}
