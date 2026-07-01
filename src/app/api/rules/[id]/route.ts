import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db/client";

const PatchSchema = z.object({
  action: z.enum(["archive", "restore"]),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { id } = await params;
  const rule = await prisma.rule.findFirst({
    where: { id, userId: session.sub },
    include: {
      executions: { orderBy: { executedAt: "desc" }, take: 10 },
    },
  });

  if (!rule) {
    return NextResponse.json({ error: "规则不存在" }, { status: 404 });
  }

  return NextResponse.json({ rule });
}

/** 作废 / 恢复规则 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { id } = await params;
  const rule = await prisma.rule.findFirst({
    where: { id, userId: session.sub },
  });

  if (!rule) {
    return NextResponse.json({ error: "规则不存在" }, { status: 404 });
  }

  try {
    const body = PatchSchema.parse(await req.json());

    if (body.action === "archive") {
      if (rule.status === "ARCHIVED") {
        return NextResponse.json({ error: "规则已作废" }, { status: 400 });
      }
      if (rule.status === "GENERATING") {
        return NextResponse.json({ error: "代码生成中，请稍候" }, { status: 409 });
      }
      const updated = await prisma.rule.update({
        where: { id },
        data: {
          status: "ARCHIVED",
          archivedFromStatus: rule.status,
        },
      });
      return NextResponse.json({ rule: updated });
    }

    if (rule.status !== "ARCHIVED") {
      return NextResponse.json({ error: "规则未作废，无需恢复" }, { status: 400 });
    }

    const restoredStatus = rule.archivedFromStatus ?? "APPROVED";
    const updated = await prisma.rule.update({
      where: { id },
      data: {
        status: restoredStatus,
        archivedFromStatus: null,
      },
    });
    return NextResponse.json({ rule: updated });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "参数无效" }, { status: 400 });
    }
    return NextResponse.json({ error: "操作失败" }, { status: 500 });
  }
}

/** 永久删除规则及执行记录 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { id } = await params;
  const rule = await prisma.rule.findFirst({
    where: { id, userId: session.sub },
  });

  if (!rule) {
    return NextResponse.json({ error: "规则不存在" }, { status: 404 });
  }

  await prisma.rule.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
