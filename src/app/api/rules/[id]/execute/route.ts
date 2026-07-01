import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { executeInSandbox } from "@/lib/sandbox/executor";

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
    return NextResponse.json(
      { error: "规则已作废，无法执行。可在详情页恢复规则。" },
      { status: 403 }
    );
  }

  if (rule.status === "GENERATING") {
    return NextResponse.json(
      { error: "代码生成中，请稍候再执行" },
      { status: 403 }
    );
  }

  if (rule.status !== "APPROVED") {
    return NextResponse.json(
      { error: "规则尚未通过审核，无法执行" },
      { status: 403 }
    );
  }

  if (!rule.generatedCode) {
    return NextResponse.json({ error: "规则无代码" }, { status: 400 });
  }

  const execution = await prisma.ruleExecution.create({
    data: {
      ruleId: rule.id,
      userId: session.sub,
      status: "RUNNING",
    },
  });

  const sandboxResult = await executeInSandbox(rule.generatedCode, {
    ruleId: rule.id,
  });

  const updated = await prisma.ruleExecution.update({
    where: { id: execution.id },
    data: {
      status: sandboxResult.success
        ? "SUCCESS"
        : sandboxResult.error?.includes("超时")
          ? "TIMEOUT"
          : "FAILED",
      resultJson: sandboxResult.result
        ? JSON.stringify(sandboxResult.result)
        : null,
      errorMessage: sandboxResult.error ?? null,
      durationMs: sandboxResult.durationMs,
    },
  });

  return NextResponse.json({
    execution: updated,
    result: sandboxResult.result ?? null,
  });
}
