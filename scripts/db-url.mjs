/** 密码含 & @ # 等字符时必须 URL 编码，否则 MySQL 连接 URL 会被截断 */

export function normalizeMysqlUrl(raw) {
  const prefix = "mysql://";
  if (!raw.startsWith(prefix)) return raw;

  const rest = raw.slice(prefix.length);
  const atIdx = rest.lastIndexOf("@");
  if (atIdx === -1) return raw;

  const hostPart = rest.slice(atIdx + 1);
  const userPass = rest.slice(0, atIdx);
  const colonIdx = userPass.indexOf(":");
  if (colonIdx === -1) return raw;

  const user = userPass.slice(0, colonIdx);
  const password = userPass.slice(colonIdx + 1);

  let decoded = password;
  try {
    decoded = decodeURIComponent(password);
  } catch {
    // keep as-is
  }

  return `${prefix}${user}:${encodeURIComponent(decoded)}@${hostPart}`;
}

export function parseMysqlUrl(raw) {
  const normalized = normalizeMysqlUrl(raw);
  const rest = normalized.slice("mysql://".length);
  const atIdx = rest.lastIndexOf("@");
  const slashIdx = rest.indexOf("/");
  if (atIdx === -1 || slashIdx === -1) {
    throw new Error("Invalid MySQL URL");
  }

  const userPass = rest.slice(0, atIdx);
  const host = rest.slice(atIdx + 1, slashIdx);
  const database = rest.slice(slashIdx + 1).split("?")[0];
  const colonIdx = userPass.indexOf(":");

  return {
    user: decodeURIComponent(userPass.slice(0, colonIdx)),
    password: decodeURIComponent(userPass.slice(colonIdx + 1)),
    host,
    database,
  };
}
