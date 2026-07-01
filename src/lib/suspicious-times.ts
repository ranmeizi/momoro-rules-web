import type { SuspiciousPlayer } from "./result-schema";
import { localDateKey } from "./drop-timeline";

const DAY_MS = 86400000;

/** 单个可疑时段 — 用于按段查 momo_ingamenews */
export interface SuspiciousTimeSlot {
  id: string;
  label: string;
  from: string;
  to: string;
  /** 可疑焦点日（本地 YYYY-MM-DD），用于 24h 时间轴 */
  focusDate: string;
}

/** momo_ingamenews 行（客户端展示用，不含 DB 依赖） */
export interface IngameNewsRow {
  key: string;
  map: string | null;
  object: string;
  objectId: string | null;
  origin: string;
  subject: string;
  ts: number;
  type: number;
  create_at: string;
  update_at: string;
}

export interface SuspiciousTimeDropTable {
  slot: SuspiciousTimeSlot;
  rows: IngameNewsRow[];
}

export const NEWS_TYPE_LABEL: Record<number, string> = {
  0: "MVP击杀",
  1: "稀有掉落",
  2: "稀有偷窃",
};

function parseTime(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") return value;
  const t = new Date(String(value)).getTime();
  return Number.isNaN(t) ? null : t;
}

function dayBounds(dateStr: string): { start: number; end: number } | null {
  const start = new Date(`${dateStr}T00:00:00.000Z`).getTime();
  if (Number.isNaN(start)) return null;
  return { start, end: start + DAY_MS - 1 };
}

function formatDayLabel(dateStr: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).format(new Date(`${dateStr}T12:00:00.000Z`));
}

/**
 * 从可疑玩家结果中提取可疑时间数组。
 * 优先 suspiciousTimes / evidence.data.date，其次 timeRange，最后 fallbackCenter。
 */
export function extractSuspiciousTimeSlots(
  player: SuspiciousPlayer,
  options?: { paddingDays?: number; fallbackCenter?: string }
): SuspiciousTimeSlot[] {
  const paddingDays = options?.paddingDays ?? 3;
  const pad = paddingDays * DAY_MS;
  const slots: SuspiciousTimeSlot[] = [];
  const seen = new Set<string>();

  function addSlot(label: string, centerStart: number, centerEnd: number) {
    const fromMs = centerStart - pad;
    const toMs = centerEnd + pad;
    const id = `${fromMs}-${toMs}-${label}`;
    if (seen.has(id)) return;
    seen.add(id);
    const focusMs = centerStart === centerEnd ? centerStart : Math.floor((centerStart + centerEnd) / 2);
    slots.push({
      id,
      label,
      from: new Date(fromMs).toISOString(),
      to: new Date(toMs).toISOString(),
      focusDate: localDateKey(focusMs),
    });
  }

  if (player.suspiciousTimes?.length) {
    for (const t of player.suspiciousTimes) {
      const fromMs = parseTime(t.from);
      const toMs = parseTime(t.to);
      if (fromMs == null || toMs == null) continue;
      addSlot(t.label ?? "可疑时段", fromMs, toMs);
    }
    if (slots.length > 0) return slots;
  }

  for (const ev of player.evidence ?? []) {
    const data = ev.data;
    if (!data) continue;

    if (typeof data.date === "string") {
      const bounds = dayBounds(data.date);
      if (bounds) {
        addSlot(ev.summary || formatDayLabel(data.date), bounds.start, bounds.end);
        continue;
      }
    }

    const fromMs = parseTime(data.from ?? data.from_ts);
    const toMs = parseTime(data.to ?? data.to_ts);
    if (fromMs != null && toMs != null) {
      addSlot(ev.summary || "可疑时段", fromMs, toMs);
    } else if (fromMs != null) {
      addSlot(ev.summary || "可疑时点", fromMs, fromMs);
    }
  }

  if (slots.length === 0 && player.timeRange) {
    const fromMs = parseTime(player.timeRange.from);
    const toMs = parseTime(player.timeRange.to);
    if (fromMs != null && toMs != null) {
      addSlot("整体可疑时段", fromMs, toMs);
    } else if (fromMs != null) {
      addSlot("可疑起始", fromMs, fromMs);
    } else if (toMs != null) {
      addSlot("可疑结束", toMs, toMs);
    }
  }

  if (slots.length === 0 && options?.fallbackCenter) {
    const center = parseTime(options.fallbackCenter);
    if (center != null) {
      addSlot("执行时间周边", center, center);
    }
  }

  return slots;
}
