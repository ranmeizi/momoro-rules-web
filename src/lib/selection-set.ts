export function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const k of a) if (!b.has(k)) return false;
  return true;
}

/** 点击同一组 keys 则取消，否则选中该组 */
export function toggleKeysSelection(
  current: Set<string>,
  keys: Iterable<string>
): Set<string> {
  const next = new Set(keys);
  if (setsEqual(current, next)) return new Set();
  return next;
}

export function selectionSignature(keys: Set<string>): string {
  return [...keys].sort().join("\0");
}
