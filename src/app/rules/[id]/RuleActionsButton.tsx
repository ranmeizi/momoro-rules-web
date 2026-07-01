"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RuleActionsButton({
  ruleId,
  status,
}: {
  ruleId: string;
  status: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function patch(action: "archive" | "restore") {
    setLoading(action);
    setError("");
    try {
      const res = await fetch(`/api/rules/${ruleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "操作失败");
        return;
      }
      router.refresh();
    } catch {
      setError("网络错误");
    } finally {
      setLoading(null);
    }
  }

  async function remove() {
    if (
      !confirm(
        "确定永久删除此规则？执行记录也会一并删除，且无法恢复。"
      )
    ) {
      return;
    }
    setLoading("delete");
    setError("");
    try {
      const res = await fetch(`/api/rules/${ruleId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "删除失败");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("网络错误");
    } finally {
      setLoading(null);
    }
  }

  const isArchived = status === "ARCHIVED";
  const isGenerating = status === "GENERATING";

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {isArchived ? (
        <button
          type="button"
          onClick={() => patch("restore")}
          disabled={loading !== null}
          className="px-3 py-1.5 text-xs rounded-lg border border-[var(--color-card-border)] hover:border-[var(--color-primary)]"
        >
          {loading === "restore" ? "处理中..." : "恢复规则"}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => {
            if (
              confirm(
                "作废后此规则不再参与排行榜统计，且无法执行。可在详情页恢复。继续？"
              )
            ) {
              patch("archive");
            }
          }}
          disabled={loading !== null || isGenerating}
          className="px-3 py-1.5 text-xs rounded-lg border border-zinc-600 text-zinc-400 hover:border-zinc-400 disabled:opacity-50"
        >
          {loading === "archive" ? "处理中..." : "作废规则"}
        </button>
      )}
      <button
        type="button"
        onClick={remove}
        disabled={loading !== null}
        className="px-3 py-1.5 text-xs rounded-lg border border-[var(--color-danger)]/50 text-[var(--color-danger)] hover:border-[var(--color-danger)]"
      >
        {loading === "delete" ? "删除中..." : "删除"}
      </button>
      {error && (
        <span className="text-xs text-[var(--color-danger)]">{error}</span>
      )}
    </div>
  );
}
