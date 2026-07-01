"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

interface Rule {
  id: string;
  title: string;
  description: string;
  generatedCode: string | null;
  status: string;
  createdAt: string;
  user: { username: string; displayName: string | null };
}

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState("");
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [authed, setAuthed] = useState(false);

  async function loadRules(key: string) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/review", {
        headers: { "x-admin-key": key },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "加载失败");
        setAuthed(false);
        return;
      }
      setRules(data.rules);
      setAuthed(true);
      sessionStorage.setItem("admin_key", key);
    } catch {
      setError("网络错误");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const saved = sessionStorage.getItem("admin_key");
    if (saved) {
      setAdminKey(saved);
      loadRules(saved);
    }
  }, []);

  async function review(ruleId: string, action: "approve" | "reject") {
    const res = await fetch("/api/admin/review", {
      method: "POST",
      headers: {
        "x-admin-key": adminKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ruleId, action }),
    });
    if (res.ok) {
      loadRules(adminKey);
    }
  }

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="card w-full max-w-md p-8">
          <h1 className="text-xl font-bold mb-4">管理员审核</h1>
          <input
            className="input mb-4"
            type="password"
            placeholder="Admin API Key"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
          />
          {error && (
            <p className="text-[var(--color-danger)] text-sm mb-4">{error}</p>
          )}
          <button
            className="btn-primary w-full"
            onClick={() => loadRules(adminKey)}
            disabled={loading || !adminKey}
          >
            {loading ? "验证中..." : "进入"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">待审核规则 ({rules.length})</h1>
        <Link href="/dashboard" className="text-sm text-[var(--color-muted)]">
          用户端 →
        </Link>
      </div>

      {rules.length === 0 ? (
        <p className="text-[var(--color-muted)]">暂无待审核规则</p>
      ) : (
        <div className="space-y-6">
          {rules.map((rule) => (
            <div key={rule.id} className="card p-6">
              <div className="flex justify-between mb-3">
                <div>
                  <h2 className="font-semibold">{rule.title}</h2>
                  <p className="text-sm text-[var(--color-muted)]">
                    {rule.user.displayName ?? rule.user.username} ·{" "}
                    {formatDate(rule.createdAt)}
                  </p>
                </div>
              </div>
              <p className="text-sm mb-4 whitespace-pre-wrap">
                {rule.description}
              </p>
              {rule.generatedCode && (
                <pre className="text-xs overflow-x-auto p-4 bg-black/40 rounded-lg mb-4 max-h-60">
                  {rule.generatedCode}
                </pre>
              )}
              <div className="flex gap-3">
                <button
                  className="btn-primary"
                  onClick={() => review(rule.id, "approve")}
                >
                  通过
                </button>
                <button
                  className="px-4 py-2 rounded-lg border border-[var(--color-danger)] text-[var(--color-danger)]"
                  onClick={() => review(rule.id, "reject")}
                >
                  拒绝
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
