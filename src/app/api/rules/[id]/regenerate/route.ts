import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { scheduleRuleCodeGeneration } from "@/lib/ai/regenerate-rule";

export async function POST(
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

  if (rule.status === "ARCHIVED") {
    return NextResponse.json({ error: "已作废规则请先恢复" }, { status: 400 });
  }

  if (rule.status === "GENERATING") {
    return NextResponse.json(
      { error: "代码正在生成中，请稍候", rule },
      { status: 409 }
    );
  }

  try {
    const updated = await prisma.rule.update({
      where: { id: rule.id },
      data: {
        status: "GENERATING",
        reviewNote: "AI 正在重新生成代码…",
        reviewedAt: null,
      },
    });

    scheduleRuleCodeGeneration(rule.id, rule.description);

    return NextResponse.json(
      {
        rule: updated,
        message: "已开始生成，完成后状态将变为待审核",
        polling: true,
      },
      { status: 202 }
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "启动生成失败" }, { status: 500 });
  }
}

/** 查询生成状态（轻量轮询） */
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
    select: {
      id: true,
      status: true,
      reviewNote: true,
      updatedAt: true,
    },
  });

  if (!rule) {
    return NextResponse.json({ error: "规则不存在" }, { status: 404 });
  }

  return NextResponse.json({
    status: rule.status,
    generating: rule.status === "GENERATING",
    reviewNote: rule.reviewNote,
    updatedAt: rule.updatedAt,
  });
}
