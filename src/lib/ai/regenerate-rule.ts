import { prisma } from "@/lib/db/client";
import { generateRuleCode } from "@/lib/ai/generate";

/** 后台执行 AI 代码生成并更新规则状态 */
export async function runRuleCodeGeneration(
  ruleId: string,
  description: string
): Promise<void> {
  try {
    const { code, validation } = await generateRuleCode(description, ruleId);

    await prisma.rule.update({
      where: { id: ruleId },
      data: {
        generatedCode: code,
        status: validation.valid ? "PENDING_REVIEW" : "DRAFT",
        reviewNote: validation.valid
          ? null
          : `代码校验未通过: ${validation.errors.join("; ")}`,
        reviewedAt: null,
      },
    });
  } catch (e) {
    console.error(`规则 ${ruleId} AI 生成失败:`, e);
    const message = e instanceof Error ? e.message : String(e);
    await prisma.rule.update({
      where: { id: ruleId },
      data: {
        status: "DRAFT",
        reviewNote: `AI 生成失败: ${message.slice(0, 500)}`,
      },
    });
  }
}

/** 标记为生成中并异步启动任务（不 await） */
export function scheduleRuleCodeGeneration(
  ruleId: string,
  description: string
): void {
  void runRuleCodeGeneration(ruleId, description);
}
