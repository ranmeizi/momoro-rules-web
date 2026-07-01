import { NextResponse } from "next/server";
import { clearAuthCookie, getSession } from "@/lib/auth";
import { findUserById, toPublicUser } from "@/lib/auth/user-service";

export async function POST() {
  await clearAuthCookie();
  return NextResponse.json({ ok: true });
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ user: null });
  }

  const user = await findUserById(session.userId);
  if (!user || user.status !== "active") {
    return NextResponse.json({ user: null });
  }

  return NextResponse.json({ user: toPublicUser(user) });
}
