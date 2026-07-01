import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { displayName, findUsersByIds } from "@/lib/auth/user-service";

const ReviewSchema = z.object({
  ruleId: z.string(),
  action: z.enum(["approve", "reject"]),
  note: z.string().optional(),
});

/** 管理员审核接口 — 生产环境应加 admin 鉴权 */
export async function POST(req: NextRequest) {
  const adminKey = req.headers.get("x-admin-key");
  if (!adminKey || adminKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  try {
    const body = ReviewSchema.parse(await req.json());
    const rule = await prisma.rule.findUnique({ where: { id: body.ruleId } });
    if (!rule) {
      return NextResponse.json({ error: "规则不存在" }, { status: 404 });
    }

    const updated = await prisma.rule.update({
      where: { id: body.ruleId },
      data: {
        status: body.action === "approve" ? "APPROVED" : "REJECTED",
        reviewNote: body.note ?? null,
        reviewedAt: new Date(),
      },
    });

    return NextResponse.json({ rule: updated });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "参数无效" }, { status: 400 });
    }
    return NextResponse.json({ error: "审核失败" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const adminKey = req.headers.get("x-admin-key");
  if (!adminKey || adminKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const rules = await prisma.rule.findMany({
    where: { status: "PENDING_REVIEW" },
    orderBy: { createdAt: "asc" },
  });

  const userIds = [...new Set(rules.map((r) => r.userId))];
  const users = await findUsersByIds(userIds);
  const userMap = new Map(users.map((u) => [u.id, u]));

  return NextResponse.json({
    rules: rules.map((rule) => {
      const user = userMap.get(rule.userId);
      return {
        ...rule,
        user: user
          ? {
              username: user.username,
              displayName: displayName(user),
            }
          : { username: rule.userId, displayName: rule.userId },
      };
    }),
  });
}
