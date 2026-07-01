"use client";

import { useMemo, useState, type MouseEvent } from "react";
import {
  buildStickySegments,
  formatHourLabel,
  rowsToTimelinePoints,
  type StickySegment,
  type TimelinePoint,
} from "@/lib/drop-timeline";
import { setsEqual } from "@/lib/selection-set";
import type { IngameNewsRow } from "@/lib/suspicious-times";

const HOUR_TICKS = [0, 6, 12, 18, 24];

export default function DropTimelineChart({
  rows,
  focusDate,
  stickyMs,
  activeKeys,
  pinned,
  onHoverKeys,
  onToggleSelect,
}: {
  rows: IngameNewsRow[];
  focusDate: string;
  stickyMs: number;
  /** 当前展示高亮（选中或悬停） */
  activeKeys: Set<string>;
  /** 是否已有点击选中（有则忽略悬停） */
  pinned: boolean;
  onHoverKeys: (keys: Set<string>) => void;
  onToggleSelect: (keys: string[]) => void;
}) {
  const points = useMemo(
    () => rowsToTimelinePoints(rows, focusDate),
    [rows, focusDate]
  );
  const segments = useMemo(
    () => buildStickySegments(points, stickyMs),
    [points, stickyMs]
  );

  const [hoverSegment, setHoverSegment] = useState<StickySegment | null>(null);
  const [hoverPoint, setHoverPoint] = useState<TimelinePoint | null>(null);

  function handlePointEnter(p: TimelinePoint) {
    if (pinned) return;
    setHoverPoint(p);
    setHoverSegment(null);
    onHoverKeys(new Set([p.key]));
  }

  function handleSegmentEnter(seg: StickySegment) {
    if (pinned) return;
    setHoverSegment(seg);
    setHoverPoint(null);
    onHoverKeys(new Set(seg.keys));
  }

  function handleLeave() {
    setHoverPoint(null);
    setHoverSegment(null);
    if (!pinned) onHoverKeys(new Set());
  }

  function handlePointClick(p: TimelinePoint, e: MouseEvent) {
    e.stopPropagation();
    onToggleSelect([p.key]);
  }

  function handleSegmentClick(seg: StickySegment, e: MouseEvent) {
    e.stopPropagation();
    onToggleSelect(seg.keys);
  }

  const infoPoint =
    hoverPoint ??
    (activeKeys.size === 1
      ? points.find((p) => activeKeys.has(p.key)) ?? null
      : null);
  const infoSegment =
    hoverSegment ??
    (activeKeys.size > 1
      ? segments.find((s) => setsEqual(new Set(s.keys), activeKeys)) ?? null
      : null);

  if (points.length === 0) {
    return (
      <p className="text-xs text-[var(--color-muted)] py-2">
        {focusDate} 当日无掉落，时间轴不展示
      </p>
    );
  }

  return (
    <div className="mb-3 select-none">
      <div className="flex items-center justify-between gap-2 mb-1.5 text-xs text-[var(--color-muted)]">
        <span>{focusDate} · 24 小时掉落分布</span>
        <span>
          {points.length} 个时间点
          {segments.filter((s) => s.keys.length > 1).length > 0 &&
            ` · ${segments.filter((s) => s.keys.length > 1).length} 段活跃`}
          {pinned && " · 已选中"}
        </span>
      </div>
      <div
        className="relative h-14 rounded-lg bg-zinc-900/80 border border-[var(--color-card-border)]"
        onMouseLeave={handleLeave}
      >
        {HOUR_TICKS.map((h) => (
          <div
            key={h}
            className="absolute top-0 bottom-5 border-l border-zinc-700/50 pointer-events-none"
            style={{ left: `${(h / 24) * 100}%` }}
          />
        ))}

        {segments
          .filter((seg) => seg.keys.length > 1)
          .map((seg) => {
            const left = seg.startFraction * 100;
            const width = Math.max(
              (seg.endFraction - seg.startFraction) * 100,
              0.8
            );
            const segKeys = new Set(seg.keys);
            const active =
              setsEqual(activeKeys, segKeys) ||
              (hoverSegment === seg && !pinned);
            const selected = pinned && setsEqual(activeKeys, segKeys);
            return (
              <button
                key={`${seg.startTs}-${seg.endTs}`}
                type="button"
                className={`absolute top-2 h-3 rounded-sm cursor-pointer transition-colors ${
                  selected
                    ? "bg-[var(--color-warning)]/70 ring-1 ring-[var(--color-warning)]"
                    : active
                      ? "bg-[var(--color-primary)]/60 ring-1 ring-[var(--color-primary)]"
                      : "bg-[var(--color-primary)]/35 hover:bg-[var(--color-primary)]/55"
                }`}
                style={{ left: `${left}%`, width: `${width}%` }}
                title={`活跃 ${formatHourLabel(seg.startFraction)} – ${formatHourLabel(seg.endFraction)}（${seg.keys.length} 条）· 点击选中`}
                onMouseEnter={() => handleSegmentEnter(seg)}
                onClick={(e) => handleSegmentClick(seg, e)}
              />
            );
          })}

        {points.map((p) => {
          const active = activeKeys.has(p.key);
          const selected = pinned && activeKeys.has(p.key) && activeKeys.size === 1;
          return (
            <button
              key={p.key}
              type="button"
              className={`absolute bottom-1.5 w-2.5 h-2.5 -ml-[5px] rounded-full border-2 transition-transform z-10 cursor-pointer ${
                selected
                  ? "bg-[var(--color-accent)] border-white scale-125 shadow-[0_0_6px_var(--color-accent)]"
                  : active
                    ? "bg-[var(--color-accent)] border-white scale-110 shadow-[0_0_4px_var(--color-accent)]"
                    : "bg-[var(--color-accent)]/80 border-[var(--color-accent)] hover:scale-110"
              }`}
              style={{ left: `${p.fraction * 100}%` }}
              title={`${formatHourLabel(p.fraction)} · ${p.object} · 点击选中`}
              onMouseEnter={() => handlePointEnter(p)}
              onClick={(e) => handlePointClick(p, e)}
            />
          );
        })}

        <div className="absolute bottom-0 left-0 right-0 flex justify-between px-0.5 text-[10px] text-[var(--color-muted)] font-mono pointer-events-none">
          {HOUR_TICKS.map((h) => (
            <span
              key={h}
              style={{
                transform: h === 24 ? "translateX(-100%)" : undefined,
              }}
            >
              {String(h).padStart(2, "0")}
            </span>
          ))}
        </div>
      </div>
      {(infoPoint || infoSegment) && (
        <p className="text-[10px] text-[var(--color-muted)] mt-1 font-mono">
          {infoPoint
            ? `${formatHourLabel(infoPoint.fraction)} · ${infoPoint.object}${pinned && activeKeys.has(infoPoint.key) ? " · 已选中，再次点击取消" : ""}`
            : `${formatHourLabel(infoSegment!.startFraction)} – ${formatHourLabel(infoSegment!.endFraction)} · ${infoSegment!.keys.length} 条${pinned ? " · 已选中，再次点击取消" : ""}`}
        </p>
      )}
      {!pinned && (
        <p className="text-[10px] text-[var(--color-muted)] mt-0.5">
          悬停预览 · 点击时间轴或表格行可固定选中
        </p>
      )}
    </div>
  );
}
