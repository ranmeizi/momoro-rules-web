"use client";

import { useEffect, useRef, useState } from "react";
import {
  extractSuspiciousTimeSlots,
  NEWS_TYPE_LABEL,
  type IngameNewsRow,
  type SuspiciousTimeDropTable,
} from "@/lib/suspicious-times";
import type { SuspiciousPlayer } from "@/lib/result-schema";
import {
  getDefaultStickyMs,
  stickyHoursToMs,
  stickyMsToHours,
} from "@/lib/drop-timeline-config";
import {
  selectionSignature,
  toggleKeysSelection,
} from "@/lib/selection-set";
import DropTimelineChart from "@/components/DropTimelineChart";

function formatTs(ts: number): string {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(ts));
}

function formatWindow(from: string, to: string): string {
  const fmt = (s: string) =>
    new Intl.DateTimeFormat("zh-CN", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(s));
  return `${fmt(from)} ~ ${fmt(to)}`;
}

function DropSlotPanel({
  table,
  isOpen,
  onToggle,
  stickyMs,
  selectedKeys,
  onToggleSelect,
}: {
  table: SuspiciousTimeDropTable;
  isOpen: boolean;
  onToggle: () => void;
  stickyMs: number;
  selectedKeys: Set<string>;
  onToggleSelect: (keys: string[]) => void;
}) {
  const { slot, rows } = table;
  const scrollRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef(new Map<string, HTMLTableRowElement>());
  const [hoverKeys, setHoverKeys] = useState<Set<string>>(() => new Set());

  const pinned = selectedKeys.size > 0;
  const activeKeys = pinned ? selectedKeys : hoverKeys;
  const selectedSig = selectionSignature(selectedKeys);

  useEffect(() => {
    if (selectedKeys.size === 0) return;
    const targetKey = rows.find((r) => selectedKeys.has(r.key))?.key;
    if (!targetKey) return;
    const rowEl = rowRefs.current.get(targetKey);
    if (!rowEl) return;

    const container = scrollRef.current;
    if (!container) {
      rowEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
      return;
    }

    const rowTop = rowEl.offsetTop;
    const rowBottom = rowTop + rowEl.offsetHeight;
    const viewTop = container.scrollTop;
    const viewBottom = viewTop + container.clientHeight;

    if (rowTop < viewTop || rowBottom > viewBottom) {
      rowEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selectedSig, rows, selectedKeys]);

  function handleHoverKeys(keys: Set<string>) {
    if (pinned) return;
    setHoverKeys(keys);
  }

  function handleRowClick(key: string) {
    onToggleSelect([key]);
  }

  return (
    <div className="w-full border border-[var(--color-card-border)] rounded-lg overflow-hidden mb-2 last:mb-0">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-3 py-2 bg-black/30 text-xs flex justify-between gap-2 items-center hover:bg-black/40 transition-colors text-left"
        {...(isOpen ? { "aria-expanded": true } : { "aria-expanded": false })}
      >
        <span className="font-medium text-white">{slot.label}</span>
        <span className="text-[var(--color-muted)] shrink-0 flex items-center gap-2">
          <span>{formatWindow(slot.from, slot.to)}</span>
          <span className="text-[var(--color-primary)]">{isOpen ? "收起 ▲" : "展开 ▼"}</span>
        </span>
      </button>

      {isOpen && (
        <div className="w-full p-3 border-t border-[var(--color-card-border)]">
          <DropTimelineChart
            rows={rows}
            focusDate={slot.focusDate}
            stickyMs={stickyMs}
            activeKeys={activeKeys}
            pinned={pinned}
            onHoverKeys={handleHoverKeys}
            onToggleSelect={onToggleSelect}
          />
          {rows.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">该时段无掉落记录</p>
          ) : (
            <div
              ref={scrollRef}
              className="w-full overflow-x-auto overflow-y-auto h-96"
            >
              <table className="w-full min-w-full table-fixed text-xs">
                <thead className="sticky top-0 z-[1] bg-[var(--color-card)]">
                  <tr className="text-[var(--color-muted)] border-b border-[var(--color-card-border)]">
                    <th className="text-left p-2 w-[38%] whitespace-nowrap">时间</th>
                    <th className="text-left p-2 w-[18%] whitespace-nowrap">类型</th>
                    <th className="text-left p-2 w-[44%]">物品</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const lit = activeKeys.has(row.key);
                    const selected = pinned && lit;
                    return (
                      <tr
                        key={row.key}
                        ref={(el) => {
                          if (el) rowRefs.current.set(row.key, el);
                          else rowRefs.current.delete(row.key);
                        }}
                        onClick={() => handleRowClick(row.key)}
                        className={`border-b border-[var(--color-card-border)]/40 transition-colors cursor-pointer ${
                          selected
                            ? "bg-[var(--color-warning)]/25 ring-1 ring-inset ring-[var(--color-warning)]/60"
                            : lit
                              ? "bg-[var(--color-warning)]/15 ring-1 ring-inset ring-[var(--color-warning)]/40"
                              : "hover:bg-black/20"
                        }`}
                      >
                        <td className="p-2 whitespace-nowrap font-mono truncate">
                          {formatTs(row.ts)}
                        </td>
                        <td className="p-2 whitespace-nowrap truncate">
                          {NEWS_TYPE_LABEL[row.type] ?? row.type}
                        </td>
                        <td className="p-2 truncate" title={row.object}>
                          {row.object}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-[var(--color-muted)] mt-2 border-t border-[var(--color-card-border)] pt-2">
            共 {rows.length} 条 · 焦点日 {slot.focusDate}
          </p>
        </div>
      )}
    </div>
  );
}

export default function PlayerDropPanel({
  player,
  fallbackCenter,
  paddingDays = 3,
  autoExpand = false,
}: {
  player: SuspiciousPlayer;
  fallbackCenter?: string;
  paddingDays?: number;
  autoExpand?: boolean;
}) {
  const [panelOpen, setPanelOpen] = useState(autoExpand);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tables, setTables] = useState<SuspiciousTimeDropTable[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [openSlotId, setOpenSlotId] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set());
  const [stickyMs, setStickyMs] = useState(getDefaultStickyMs);

  const subject = player.playerName ?? player.playerId;

  async function loadDrops() {
    setLoading(true);
    setError("");

    const slots = extractSuspiciousTimeSlots(player, {
      fallbackCenter,
      paddingDays,
    });

    if (slots.length === 0) {
      setError("未找到可疑时间点");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/results/drops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, slots, type: 1 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "加载失败");
        return;
      }
      const next: SuspiciousTimeDropTable[] = (data.tables ?? []).map(
        (t: { slot: SuspiciousTimeDropTable["slot"]; rows: IngameNewsRow[] }) => ({
          slot: t.slot,
          rows: t.rows,
        })
      );
      setTables(next);
      setOpenSlotId(next[0]?.slot.id ?? null);
      setPanelOpen(true);
      setLoaded(true);
    } catch {
      setError("网络错误");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (autoExpand && !loaded) {
      loadDrops();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoExpand]);

  async function handleTogglePanel() {
    if (panelOpen) {
      setPanelOpen(false);
      setSelectedKeys(new Set());
      return;
    }
    if (loaded) {
      setPanelOpen(true);
      return;
    }
    await loadDrops();
  }

  function handleSlotToggle(slotId: string) {
    setSelectedKeys(new Set());
    setOpenSlotId((prev) => (prev === slotId ? null : slotId));
  }

  function handleToggleSelect(keys: string[]) {
    setSelectedKeys((prev) => toggleKeysSelection(prev, keys));
  }

  const slotCount = extractSuspiciousTimeSlots(player, {
    fallbackCenter,
    paddingDays,
  }).length;

  const stickyHours = stickyMsToHours(stickyMs);

  function handleStickyHoursChange(raw: string) {
    const h = Number(raw);
    if (!Number.isFinite(h) || h <= 0) return;
    setStickyMs(stickyHoursToMs(h));
    setSelectedKeys(new Set());
  }

  return (
    <div className="mt-2 w-full min-w-0">
      {!autoExpand && (
        <button
          type="button"
          onClick={handleTogglePanel}
          disabled={loading}
          className="text-xs text-[var(--color-primary)] hover:underline disabled:opacity-50"
        >
          {loading
            ? "加载中..."
            : panelOpen
              ? "收起掉落核查"
              : `查看可疑时段掉落（${slotCount} 段）`}
        </button>
      )}
      {error && (
        <p className="text-xs text-[var(--color-danger)] mt-1">{error}</p>
      )}
      {panelOpen && (
        <div className={`w-full min-w-0 ${autoExpand ? "" : "mt-3"}`}>
          {loading && autoExpand && (
            <p className="text-sm text-[var(--color-muted)] p-2">
              按可疑时段查询掉落记录...
            </p>
          )}
          {!loading && tables.length > 0 && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <p className="text-xs text-[var(--color-muted)]">
                  {subject} · 共 {tables.length} 个可疑时段 · 每段前后 {paddingDays}{" "}
                  天 · 同时仅展开一段
                </p>
                <label className="flex items-center gap-2 text-xs text-[var(--color-muted)] shrink-0">
                  粘滞时间
                  <input
                    type="number"
                    min={0.25}
                    max={24}
                    step={0.25}
                    value={stickyHours}
                    onChange={(e) => handleStickyHoursChange(e.target.value)}
                    className="w-16 px-2 py-1 rounded bg-black/40 border border-[var(--color-card-border)] text-white font-mono text-xs"
                  />
                  小时
                </label>
              </div>
              {tables.map((t) => (
                <DropSlotPanel
                  key={t.slot.id}
                  table={t}
                  isOpen={openSlotId === t.slot.id}
                  onToggle={() => handleSlotToggle(t.slot.id)}
                  stickyMs={stickyMs}
                  selectedKeys={selectedKeys}
                  onToggleSelect={handleToggleSelect}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
