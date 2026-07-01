"use client";

import { useState } from "react";
import { formatDate } from "@/lib/utils";
import type { RuleResult } from "@/lib/result-schema";
import ExecutionResultDetail from "@/components/ExecutionResultDetail";

export interface RuleExecutionItem {
  id: string;
  status: string;
  executedAt: string;
  durationMs: number | null;
  errorMessage: string | null;
  result: RuleResult | null;
}

const STATUS_LABEL: Record<string, string> = {
  SUCCESS: "成功",
  FAILED: "失败",
  TIMEOUT: "超时",
  RUNNING: "运行中",
  PENDING: "等待中",
};

function statusClass(status: string): string {
  if (status === "SUCCESS") return "text-[var(--color-success)]";
  if (status === "FAILED" || status === "TIMEOUT") {
    return "text-[var(--color-danger)]";
  }
  return "text-[var(--color-muted)]";
}

export default function ExecutionHistoryList({
  executions,
}: {
  executions: RuleExecutionItem[];
}) {
  const [expandedId, setExpandedId] = useState<string | null>(() => {
    const firstWithResult = executions.find((ex) => ex.result);
    return firstWithResult?.id ?? null;
  });

  if (executions.length === 0) return null;

  return (
    <section className="card p-5">
      <h2 className="font-semibold mb-4">执行历史</h2>
      <div className="space-y-2">
        {executions.map((ex) => {
          const expanded = expandedId === ex.id;
          const canExpand = ex.status === "SUCCESS" && ex.result != null;

          return (
            <div
              key={ex.id}
              className="rounded-lg border border-[var(--color-card-border)] overflow-hidden"
            >
              <button
                type="button"
                onClick={() => {
                  if (!canExpand) return;
                  setExpandedId(expanded ? null : ex.id);
                }}
                className={`w-full text-left p-3 text-sm flex justify-between items-center gap-3 transition-colors ${
                  canExpand
                    ? "hover:bg-black/20 cursor-pointer"
                    : "cursor-default"
                }`}
                {...(canExpand ? { "aria-expanded": expanded } : {})}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`font-medium shrink-0 ${statusClass(ex.status)}`}>
                    {STATUS_LABEL[ex.status] ?? ex.status}
                  </span>
                  {ex.result && (
                    <span className="text-[var(--color-muted)] truncate">
                      {ex.result.suspiciousPlayers.length} 名可疑玩家
                    </span>
                  )}
                  {canExpand && (
                    <span className="text-xs text-[var(--color-primary)] shrink-0">
                      {expanded ? "收起结果" : "查看结果"}
                    </span>
                  )}
                </div>
                <span className="text-[var(--color-muted)] text-xs shrink-0">
                  {formatDate(ex.executedAt)}
                  {ex.durationMs != null ? ` · ${ex.durationMs}ms` : ""}
                </span>
              </button>

              {ex.errorMessage && !expanded && (
                <p className="px-3 pb-3 text-[var(--color-danger)] text-xs">
                  {ex.errorMessage}
                </p>
              )}

              {expanded && ex.result && (
                <div className="px-3 pb-3">
                  <ExecutionResultDetail
                    result={ex.result}
                    executedAt={ex.executedAt}
                  />
                </div>
              )}

              {expanded && ex.errorMessage && (
                <p className="px-3 pb-3 text-[var(--color-danger)] text-xs">
                  {ex.errorMessage}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
