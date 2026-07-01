import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { signToken, setAuthCookie } from "@/lib/auth";
import { AuthError, validateUser } from "@/lib/auth/user-service";

const LoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = LoginSchema.parse(await req.json());
    const user = await validateUser(body.username, body.password);

    const token = await signToken({
      sub: user.id,
      userId: user.id,
      username: user.email ?? user.username,
    });
    await setAuthCookie(token);

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        picture: user.picture,
        email: user.email,
      },
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "参数无效" }, { status: 400 });
    }
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    console.error("[auth/login]", e);
    return NextResponse.json({ error: "登录失败" }, { status: 500 });
  }
}
