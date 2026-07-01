import { ReadOnlyQuery } from "./sandbox/query";
import type { SuspiciousTimeDropTable, SuspiciousTimeSlot } from "./suspicious-times";

/**
 * 按可疑时间数组逐段查 momo_ingamenews（仅服务端 API 调用）
 */
export async function fetchDropsForSuspiciousTimes(
  subject: string,
  slots: SuspiciousTimeSlot[],
  options?: { type?: number }
): Promise<SuspiciousTimeDropTable[]> {
  if (slots.length === 0) return [];

  const query = new ReadOnlyQuery();
  const type = options?.type ?? 1;
  const tables: SuspiciousTimeDropTable[] = [];

  for (const slot of slots) {
    const rows = await query.fetch_ingamenews({
      subject,
      from: slot.from,
      to: slot.to,
      type,
    });
    tables.push({ slot, rows });
  }

  return tables;
}
