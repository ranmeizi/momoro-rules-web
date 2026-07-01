import type { RuleStatus } from "@prisma/client";

/** 参与排行榜 / 统计的有效规则状态（不含已作废、生成中） */
export const ACTIVE_RULE_STATUS: { notIn: RuleStatus[] } = {
  notIn: ["ARCHIVED", "GENERATING"],
};

export const RULE_STATUS_MAP: Record<
  string,
  { label: string; color: string; badge?: string }
> = {
  DRAFT: { label: "草稿", color: "text-zinc-400", badge: "bg-zinc-700" },
  GENERATING: {
    label: "生成中",
    color: "text-[var(--color-accent)]",
    badge: "bg-[var(--color-accent)]/20 text-[var(--color-accent)]",
  },
  PENDING_REVIEW: {
    label: "待审核",
    color: "text-[var(--color-warning)]",
    badge: "bg-[var(--color-warning)]/20 text-[var(--color-warning)]",
  },
  APPROVED: {
    label: "已通过",
    color: "text-[var(--color-success)]",
    badge: "bg-[var(--color-success)]/20 text-[var(--color-success)]",
  },
  REJECTED: {
    label: "已拒绝",
    color: "text-[var(--color-danger)]",
    badge: "bg-[var(--color-danger)]/20 text-[var(--color-danger)]",
  },
  ARCHIVED: {
    label: "已作废",
    color: "text-zinc-500",
    badge: "bg-zinc-800 text-zinc-400",
  },
};

export function isRuleActive(status: string): boolean {
  return status !== "ARCHIVED" && status !== "GENERATING";
}
