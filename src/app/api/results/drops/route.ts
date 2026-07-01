import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { ReadOnlyQuery } from "@/lib/sandbox/query";
import {
  fetchDropsForSuspiciousTimes,
} from "@/lib/suspicious-drop-query";
import { localDateKey } from "@/lib/drop-timeline";
import type { SuspiciousTimeSlot } from "@/lib/suspicious-times";

const SlotSchema = z.object({
  id: z.string().optional(),
  label: z.string(),
  from: z.string(),
  to: z.string(),
  focusDate: z.string().optional(),
});

const PostBodySchema = z.object({
  subject: z.string().min(1),
  slots: z.array(SlotSchema).min(1),
  type: z.number().int().optional(),
});

/** GET：单段时间范围查询（兼容） */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const subject = searchParams.get("subject");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const typeParam = searchParams.get("type");

  if (!subject) {
    return NextResponse.json({ error: "缺少 subject" }, { status: 400 });
  }
  if (!from || !to) {
    return NextResponse.json({ error: "缺少 from / to 时间范围" }, { status: 400 });
  }

  try {
    const query = new ReadOnlyQuery();
    const filters: Record<string, unknown> = { subject, from, to };
    if (typeParam !== null && typeParam !== "") {
      filters.type = Number(typeParam);
    }

    const rows = await query.fetch_ingamenews(filters);
    return NextResponse.json({ subject, from, to, total: rows.length, rows });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "查询失败" },
      { status: 500 }
    );
  }
}

/** POST：按可疑时间数组逐段查掉落，每段一张表 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  try {
    const body = PostBodySchema.parse(await req.json());
    const slots: SuspiciousTimeSlot[] = body.slots.map((s, i) => {
      const fromMs = new Date(s.from).getTime();
      const toMs = new Date(s.to).getTime();
      const centerMs =
        Number.isFinite(fromMs) && Number.isFinite(toMs)
          ? Math.floor((fromMs + toMs) / 2)
          : Date.now();
      return {
        id: s.id ?? `${i}-${s.from}-${s.to}`,
        label: s.label,
        from: s.from,
        to: s.to,
        focusDate: s.focusDate ?? localDateKey(centerMs),
      };
    });

    const tables = await fetchDropsForSuspiciousTimes(body.subject, slots, {
      type: body.type,
    });

    return NextResponse.json({
      subject: body.subject,
      tables: tables.map((t) => ({
        slot: t.slot,
        total: t.rows.length,
        rows: t.rows,
      })),
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "参数无效" }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "查询失败" },
      { status: 500 }
    );
  }
}
