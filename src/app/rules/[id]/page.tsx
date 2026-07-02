import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import ExecuteButton from "./ExecuteButton";
import RegenerateCodeButton from "./RegenerateCodeButton";
import RuleActionsButton from "./RuleActionsButton";
import ExecutionHistoryList from "./ExecutionHistoryList";
import { RULE_STATUS_MAP } from "@/lib/rule-status";
import { parseRuleResult } from "@/lib/result-schema";

const STATUS_MAP = RULE_STATUS_MAP;

export default async function RuleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  const rule = await prisma.rule.findFirst({
    where: { id, userId: session.sub },
    include: {
      executions: { orderBy: { executedAt: "desc" }, take: 20 },
    },
  });

  if (!rule) notFound();

  const status = STATUS_MAP[rule.status] ?? STATUS_MAP.DRAFT;

  const executionItems = rule.executions.map((ex) => {
    let result = null;
    if (ex.status === "SUCCESS" && ex.resultJson) {
      try {
        result = parseRuleResult(JSON.parse(ex.resultJson));
      } catch {
        result = null;
      }
    }
    return {
      id: ex.id,
      status: ex.status,
      executedAt: ex.executedAt.toISOString(),
      durationMs: ex.durationMs,
      errorMessage: ex.errorMessage,
      result,
    };
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link
        href="/dashboard"
        className="text-sm text-[var(--color-muted)] hover:text-white mb-6 inline-block"
      >
        ← 返回控制台
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{rule.title}</h1>
          <p className={`text-sm mt-1 ${status.color}`}>状态：{status.label}</p>
          {rule.status === "GENERATING" && (
            <p className="text-xs text-[var(--color-accent)] mt-2">
              AI 正在生成代码，完成后将变为待审核
            </p>
          )}
          {rule.status === "PENDING_REVIEW" && (
            <p className="text-xs text-[var(--color-muted)] mt-2">
              代码已生成，等待管理员审核通过后可执行
            </p>
          )}
          {rule.status === "DRAFT" && !rule.generatedCode && (
            <p className="text-xs text-[var(--color-warning)] mt-2">
              代码尚未生成，请查看下方说明或重新创建规则
            </p>
          )}
          {rule.status === "ARCHIVED" && (
            <p className="text-xs text-[var(--color-muted)] mt-2">
              已作废，不参与排行榜统计，无法执行
            </p>
          )}
        </div>
        {rule.status === "APPROVED" && (
          <ExecuteButton ruleId={rule.id} />
        )}
      </div>

      <section className="card p-5 mb-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h2 className="font-semibold mb-0">规则管理</h2>
          <RuleActionsButton ruleId={rule.id} status={rule.status} />
        </div>
      </section>

      <section className="card p-5 mb-5">
        <h2 className="font-semibold mb-2">规则描述</h2>
        <p className="text-sm whitespace-pre-wrap">{rule.description}</p>
      </section>

      <section className="card p-5 mb-5">
        <div className="flex items-center justify-between gap-4 mb-3">
          <h2 className="font-semibold">生成的代码</h2>
          <RegenerateCodeButton ruleId={rule.id} initialStatus={rule.status} />
        </div>
        {rule.generatedCode ? (
          <>
            <pre className="text-xs overflow-x-auto p-4 bg-black/40 rounded-lg leading-relaxed max-h-[480px] overflow-y-auto">
              {rule.generatedCode}
            </pre>
            <p className="text-xs text-[var(--color-muted)] mt-3">
              代码经人工/AI 审核后方可执行
            </p>
          </>
        ) : rule.status === "GENERATING" ? (
          <p className="text-sm text-[var(--color-accent)]">
            AI 正在生成代码，完成后将自动刷新展示…
          </p>
        ) : (
          <p className="text-sm text-[var(--color-muted)]">
            暂无代码。请点击右上角「重新生成代码」，或重新创建一条规则。
          </p>
        )}
      </section>

      {rule.reviewNote && (
        <section className="card p-5 mb-5 border-[var(--color-warning)]/30">
          <h2 className="font-semibold mb-2 text-[var(--color-warning)]">
            审核备注
          </h2>
          <p className="text-sm">{rule.reviewNote}</p>
        </section>
      )}

      <ExecutionHistoryList executions={executionItems} />
    </div>
  );
}
