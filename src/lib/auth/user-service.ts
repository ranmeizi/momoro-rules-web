import { boboan } from "@/lib/db/boboan-client";
import { validatePassword } from "./password";
import type { User } from "@/generated/boboan-client";

export interface PublicUser {
  id: string;
  username: string;
  nickname: string | null;
  email: string | null;
  picture: string | null;
  status: string;
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    username: user.username,
    nickname: user.nickname,
    email: user.email,
    picture: user.picture,
    status: user.status,
  };
}

export function displayName(user: Pick<User, "nickname" | "username">): string {
  return user.nickname ?? user.username;
}

/** 按用户名或邮箱查找（兼容 boboan-nest 登录习惯） */
export async function findByLogin(login: string): Promise<User | null> {
  return boboan.user.findFirst({
    where: {
      OR: [{ username: login }, { email: login }],
    },
  });
}

export async function findUserById(id: string): Promise<User | null> {
  return boboan.user.findUnique({ where: { id } });
}

export async function findUsersByIds(ids: string[]): Promise<User[]> {
  if (ids.length === 0) return [];
  return boboan.user.findMany({ where: { id: { in: ids } } });
}

/**
 * 验证登录 — 对齐 boboan-nest AuthService.login + UsersService.validateUser
 */
export async function validateUser(
  login: string,
  password: string
): Promise<PublicUser> {
  const user = await findByLogin(login);

  if (!user) {
    throw new AuthError("用户不存在");
  }

  if (user.status !== "active") {
    throw new AuthError("账号已停用或锁定");
  }

  const valid = validatePassword(password, user.password, user.salt);
  if (!valid) {
    throw new AuthError("用户名或密码错误");
  }

  return toPublicUser(user);
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}
