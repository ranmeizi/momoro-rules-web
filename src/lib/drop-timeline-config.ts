const HOUR_MS = 60 * 60 * 1000;
const DEFAULT_STICKY_HOURS = 2;

/** 粘滞时间默认值（毫秒），可通过 NEXT_PUBLIC_DROP_STICKY_MS 配置 */
export function getDefaultStickyMs(): number {
  const raw = process.env.NEXT_PUBLIC_DROP_STICKY_MS;
  if (raw != null && raw !== "") {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return DEFAULT_STICKY_HOURS * HOUR_MS;
}

export function stickyMsToHours(ms: number): number {
  return ms / HOUR_MS;
}

export function stickyHoursToMs(hours: number): number {
  return hours * HOUR_MS;
}
