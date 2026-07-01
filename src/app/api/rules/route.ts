import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { generateRuleCode } from "@/lib/ai/generate";

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
        status: "DRAFT",
      },
    });

    const { code, validation } = await generateRuleCode(
      body.description,
      rule.id
    );

    const updated = await prisma.rule.update({
      where: { id: rule.id },
      data: {
        generatedCode: code,
        status: validation.valid ? "PENDING_REVIEW" : "DRAFT",
        reviewNote: validation.valid
          ? null
          : `代码校验未通过: ${validation.errors.join("; ")}`,
      },
    });

    return NextResponse.json({
      rule: updated,
      validation,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "参数无效" }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "创建规则失败" }, { status: 500 });
  }
}
