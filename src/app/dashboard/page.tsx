import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { displayName, findUserById } from "@/lib/auth/user-service";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { RULE_STATUS_MAP, ACTIVE_RULE_STATUS } from "@/lib/rule-status";

const STATUS_MAP = RULE_STATUS_MAP;

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await findUserById(session.userId);

  const [rules, activeCount, totalCount] = await Promise.all([
    prisma.rule.findMany({
      where: { userId: session.sub },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.rule.count({
      where: { userId: session.sub, status: ACTIVE_RULE_STATUS },
    }),
    prisma.rule.count({ where: { userId: session.sub } }),
  ]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">
            你好，{user ? displayName(user) : session.username}
          </h1>
        </div>
        <LogoutButton />
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 max-w-md">
        <StatCard label="有效规则数" value={activeCount} />
        <StatCard label="规则总数" value={totalCount} />
      </div>

      <div className="flex gap-3 mb-6">
        <Link href="/rules/new" className="btn-primary">
          + 创建新规则
        </Link>
        <Link
          href="/results"
          className="px-5 py-2.5 rounded-lg border border-[var(--color-card-border)] hover:border-[var(--color-primary)] transition-colors"
        >
          查看结果与排行榜
        </Link>
      </div>

      <section className="card p-6">
        <h2 className="font-semibold mb-4">最近规则</h2>
        {rules.length === 0 ? (
          <p className="text-[var(--color-muted)] text-sm">
            还没有规则，点击上方按钮创建你的第一条规则
          </p>
        ) : (
          <div className="space-y-3">
            {rules.map((rule) => {
              const status = STATUS_MAP[rule.status] ?? STATUS_MAP.DRAFT;
              const badgeClass = status.badge ?? "bg-zinc-700";
              return (
                <Link
                  key={rule.id}
                  href={`/rules/${rule.id}`}
                  className={`block p-4 rounded-lg border transition-colors ${
                    rule.status === "ARCHIVED"
                      ? "border-zinc-800 opacity-60 hover:opacity-80"
                      : "border-[var(--color-card-border)] hover:border-[var(--color-primary)]/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{rule.title}</span>
                    <span className={`badge ${badgeClass}`}>
                      {status.label}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--color-muted)] mt-1 line-clamp-1">
                    {rule.description}
                  </p>
                  <p className="text-xs text-[var(--color-muted)] mt-2">
                    {formatDate(rule.createdAt)}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-5">
      <p className="text-sm text-[var(--color-muted)]">{label}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
    </div>
  );
}

function LogoutButton() {
  return (
    <form
      action={async () => {
        "use server";
        const { clearAuthCookie } = await import("@/lib/auth");
        await clearAuthCookie();
        redirect("/login");
      }}
    >
      <button
        type="submit"
        className="text-sm text-[var(--color-muted)] hover:text-white transition-colors"
      >
        退出登录
      </button>
    </form>
  );
}
