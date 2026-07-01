"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const POLL_MS = 2000;

export default function RegenerateCodeButton({
  ruleId,
  initialStatus,
}: {
  ruleId: string;
  initialStatus: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState(initialStatus === "GENERATING");
  const [error, setError] = useState("");
  const submittingRef = useRef(false);

  const isGenerating = status === "GENERATING" || busy;
  const disabled = isGenerating || status === "ARCHIVED";

  const pollStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/rules/${ruleId}/regenerate`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.status && data.status !== "GENERATING") {
        setStatus(data.status);
        setBusy(false);
        submittingRef.current = false;
        router.refresh();
        return true;
      }
    } catch {
      // 继续轮询
    }
    return false;
  }, [ruleId, router]);

  useEffect(() => {
    setStatus(initialStatus);
    if (initialStatus === "GENERATING") {
      setBusy(true);
    }
  }, [initialStatus]);

  useEffect(() => {
    if (status !== "GENERATING" && !busy) return;

    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      const done = await pollStatus();
      if (!done && !cancelled) {
        timer = window.setTimeout(tick, POLL_MS);
      }
    };
    let timer = window.setTimeout(tick, POLL_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [status, busy, pollStatus]);

  async function handleRegenerate() {
    if (disabled || submittingRef.current) return;

    if (
      !confirm(
        "将用最新提示词重新生成代码，完成后状态变为「待审核」。生成过程中请勿重复点击。继续？"
      )
    ) {
      return;
    }

    setError("");
    submittingRef.current = true;
    setBusy(true);

    try {
      const res = await fetch(`/api/rules/${ruleId}/regenerate`, {
        method: "POST",
      });
      const data = await res.json();

      if (res.status === 409) {
        setStatus("GENERATING");
        setError("已在生成中，请稍候…");
        return;
      }

      if (!res.ok) {
        setError(data.error ?? "重新生成失败");
        setBusy(false);
        submittingRef.current = false;
        return;
      }

      setStatus("GENERATING");
      router.refresh();
    } catch {
      setError("网络错误");
      setBusy(false);
      submittingRef.current = false;
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleRegenerate}
        className="px-4 py-2 rounded-lg border border-[var(--color-card-border)] hover:border-[var(--color-primary)] transition-colors text-sm disabled:opacity-50 disabled:pointer-events-none"
        disabled={disabled}
        aria-busy={isGenerating ? true : undefined}
      >
        {isGenerating ? "AI 生成中…" : "重新生成代码"}
      </button>
      {isGenerating && (
        <p className="text-xs text-[var(--color-muted)] mt-2">
          已提交生成任务，页面将自动刷新；请勿关闭或重复点击
        </p>
      )}
      {error && (
        <p className="text-[var(--color-danger)] text-xs mt-2">{error}</p>
      )}
    </div>
  );
}
