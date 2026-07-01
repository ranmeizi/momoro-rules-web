"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ExecuteButton({ ruleId }: { ruleId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleExecute() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/rules/${ruleId}/execute`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "执行失败");
        router.refresh();
        return;
      }
      if (data.execution?.status !== "SUCCESS") {
        setError(data.execution?.errorMessage ?? "执行失败");
        router.refresh();
        return;
      }
      router.push("/results");
      router.refresh();
    } catch {
      setError("网络错误");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleExecute}
        className="btn-primary"
        disabled={loading}
      >
        {loading ? "执行中..." : "执行规则"}
      </button>
      {error && (
        <p className="text-[var(--color-danger)] text-xs mt-2">{error}</p>
      )}
    </div>
  );
}
