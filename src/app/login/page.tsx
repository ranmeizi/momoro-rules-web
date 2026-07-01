"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { buildBobanLoginUrl } from "@/lib/boboan-login-url";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const registered = searchParams.get("registered") === "1";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const bobanAuthUrl = useMemo(
    () => buildBobanLoginUrl({ redirectQuery: { registered: "1" } }),
    []
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "登录失败");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card w-full max-w-md p-8">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold gradient-text">Momoro Rules</h1>
        <p className="text-[var(--color-muted)] mt-2 text-sm">
          稀有掉落公告分析 · 可疑玩家识别
        </p>
      </div>

      {registered && (
        <p className="text-sm text-[var(--color-success)] bg-[var(--color-success)]/10 border border-[var(--color-success)]/30 rounded-lg px-3 py-2 mb-4 text-center">
          已在 Boboan 完成注册或登录，请使用相同账号密码登录本站点
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm mb-1.5">用户名或邮箱</label>
          <input
            className="input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="请输入用户名或邮箱"
            required
            autoComplete="username"
          />
        </div>
        <div>
          <label className="block text-sm mb-1.5">密码</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="请输入密码"
            required
            autoComplete="current-password"
          />
        </div>

        {error && (
          <p className="text-[var(--color-danger)] text-sm">{error}</p>
        )}

        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? "登录中..." : "登录"}
        </button>
      </form>

      <div className="mt-6 pt-6 border-t border-[var(--color-card-border)]">
        <p className="text-sm text-[var(--color-muted)] text-center mb-3">
          还没有账号？
        </p>
        <a
          href={bobanAuthUrl}
          className="block w-full text-center py-2.5 rounded-lg border border-[var(--color-card-border)] text-sm font-medium text-white hover:border-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors"
        >
          前往 Boboan 注册 / 登录
        </a>
        <p className="text-xs text-[var(--color-muted)] mt-3 text-center leading-relaxed">
          在{" "}
          <a
            href="https://boboan.net/login"
            className="text-[var(--color-primary)] hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            boboan.net
          </a>{" "}
          完成注册或登录后，将自动跳回本页；账号与 Boboan 主站共用
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Suspense
        fallback={
          <div className="card w-full max-w-md p-8 text-center text-[var(--color-muted)] text-sm">
            加载中...
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
