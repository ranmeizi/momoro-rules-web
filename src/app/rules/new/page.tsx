"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NewRulePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "创建失败");
        return;
      }
      if (data.rule?.id) {
        router.push(`/rules/${data.rule.id}`);
        router.refresh();
      }
    } catch {
      setError("网络错误");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link
        href="/dashboard"
        className="text-sm text-[var(--color-muted)] hover:text-white mb-6 inline-block"
      >
        ← 返回控制台
      </Link>

      <h1 className="text-2xl font-bold mb-2">创建分析规则</h1>
      <p className="text-[var(--color-muted)] text-sm mb-8">
        用自然语言描述你想找的可疑行为，AI 会将其翻译为规则代码。
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm mb-1.5">规则名称</label>
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例如：7天内高频稀有掉落检测"
            required
            maxLength={100}
          />
        </div>

        <div>
          <label className="block text-sm mb-1.5">规则描述（自然语言）</label>
          <textarea
            className="input min-h-[200px] resize-y"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={`示例：\n找出过去7天内，稀有掉落公告超过5次的玩家。\n这些玩家可能在挂机刷怪，可疑度按掉落次数递增。\n只关注 legendary 和 epic 级别的掉落。`}
            required
            minLength={10}
            maxLength={5000}
          />
        </div>

        <div className="card p-4 text-sm text-[var(--color-muted)]">
          <p className="font-medium text-white mb-2">编写提示</p>
          <ul className="list-disc list-inside space-y-1">
            <li>可选：说明时间范围（如「过去7天」）；不写则查全部历史</li>
            <li>描述可疑行为的判断标准</li>
            <li>可以指定关注的物品稀有度、区服等</li>
            <li>不需要写代码，AI 会帮你生成</li>
          </ul>
        </div>

        {error && (
          <p className="text-[var(--color-danger)] text-sm">{error}</p>
        )}

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? "提交中…" : "生成规则代码"}
        </button>
        <p className="text-xs text-[var(--color-muted)]">
          提交后将立即进入规则详情页，AI 在后台生成代码，无需等待
        </p>
      </form>
    </div>
  );
}
