"use client";

import { formatDate } from "@/lib/utils";
import type { RuleResult, SuspiciousPlayer } from "@/lib/result-schema";
import PlayerDropPanel from "@/app/results/PlayerDropPanel";

export default function ExecutionResultDetail({
  result,
  executedAt,
}: {
  result: RuleResult;
  executedAt: string;
}) {
  return (
    <div className="mt-3 pt-3 border-t border-[var(--color-card-border)] space-y-3">
      <p className="text-sm text-[var(--color-muted)]">{result.summary}</p>
      {result.totalScanned != null && (
        <p className="text-xs text-[var(--color-muted)]">
          扫描记录数：{result.totalScanned}
        </p>
      )}
      {result.suspiciousPlayers.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">未发现可疑玩家</p>
      ) : (
        <div className="space-y-2">
          {result.suspiciousPlayers.map((p, i) => (
            <SuspiciousPlayerRow
              key={`${p.playerId}-${i}`}
              player={p}
              fallbackCenter={executedAt}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SuspiciousPlayerRow({
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
      <PlayerDropPanel player={player} fallbackCenter={fallbackCenter} />
    </div>
  );
}
