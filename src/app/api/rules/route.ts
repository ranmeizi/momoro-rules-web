import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { scheduleRuleCodeGeneration } from "@/lib/ai/regenerate-rule";

const CreateRuleSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().min(10).max(5000),
});

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const rules = await prisma.rule.findMany({
    where: { userId: session.sub },
    orderBy: { createdAt: "desc" },
    include: {
      executions: {
        orderBy: { executedAt: "desc" },
        take: 1,
      },
    },
  });

  return NextResponse.json({ rules });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  try {
    const body = CreateRuleSchema.parse(await req.json());

    const rule = await prisma.rule.create({
      data: {
        userId: session.sub,
        title: body.title,
        description: body.description,
        status: "GENERATING",
        reviewNote: "AI 正在生成代码…",
      },
    });

    scheduleRuleCodeGeneration(rule.id, body.description);

    return NextResponse.json(
      {
        rule,
        message: "规则已创建，代码生成中",
        polling: true,
      },
      { status: 202 }
    );
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "参数无效" }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "创建规则失败" }, { status: 500 });
  }
}
