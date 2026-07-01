import type { IngameNewsRow } from "./suspicious-times";

const DAY_MS = 86400000;

/** 本地日历日 YYYY-MM-DD */
export function localDateKey(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 当日 0–1 位置（本地时区） */
export function tsToDayFraction(ts: number, dateKey: string): number | null {
  if (localDateKey(ts) !== dateKey) return null;
  const d = new Date(ts);
  const msInDay =
    d.getHours() * 3600000 +
    d.getMinutes() * 60000 +
    d.getSeconds() * 1000 +
    d.getMilliseconds();
  return msInDay / DAY_MS;
}

export interface TimelinePoint {
  key: string;
  ts: number;
  fraction: number;
  object: string;
}

export interface StickySegment {
  startFraction: number;
  endFraction: number;
  startTs: number;
  endTs: number;
  keys: string[];
}

export function rowsToTimelinePoints(
  rows: IngameNewsRow[],
  focusDate: string
): TimelinePoint[] {
  return rows
    .map((row) => {
      const fraction = tsToDayFraction(row.ts, focusDate);
      if (fraction == null) return null;
      return {
        key: row.key,
        ts: row.ts,
        fraction,
        object: row.object,
      };
    })
    .filter((p): p is TimelinePoint => p != null)
    .sort((a, b) => a.ts - b.ts);
}

/** 将相距 ≤ stickyMs 的时间点合并为活跃时段 */
export function buildStickySegments(
  points: TimelinePoint[],
  stickyMs: number
): StickySegment[] {
  if (points.length === 0) return [];

  const segments: StickySegment[] = [];
  let cur = {
    startFraction: points[0].fraction,
    endFraction: points[0].fraction,
    startTs: points[0].ts,
    endTs: points[0].ts,
    keys: [points[0].key],
  };

  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    if (p.ts - cur.endTs <= stickyMs) {
      cur.endFraction = p.fraction;
      cur.endTs = p.ts;
      cur.keys.push(p.key);
    } else {
      segments.push({ ...cur, keys: [...cur.keys] });
      cur = {
        startFraction: p.fraction,
        endFraction: p.fraction,
        startTs: p.ts,
        endTs: p.ts,
        keys: [p.key],
      };
    }
  }
  segments.push({ ...cur, keys: [...cur.keys] });

  return segments;
}

export function formatHourLabel(fraction: number): string {
  const totalMinutes = Math.round(fraction * 24 * 60);
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return m === 0 ? `${h}:00` : `${h}:${String(m).padStart(2, "0")}`;
}
