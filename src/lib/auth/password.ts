import crypto from "crypto";

/** 与 boboan-nest UsersService 一致的 PBKDF2 密码校验 */
export function validatePassword(
  plainPassword: string,
  hashedPassword: string,
  salt: string
): boolean {
  const hash = crypto
    .pbkdf2Sync(plainPassword, salt, 1000, 32, "sha512")
    .toString("hex");
  return hash === hashedPassword;
}

export function genStorePassword(password: string): [string, string] {
  const salt = crypto.randomBytes(4).toString("hex");
  const hash = crypto
    .pbkdf2Sync(password, salt, 1000, 32, "sha512")
    .toString("hex");
  return [hash, salt];
}
