const DEFAULT_BOBOAN_LOGIN = "https://boboan.net/login";

/** 构建 Boboan 登录/注册页 URL，登录成功后跳回本站 */
export function buildBobanLoginUrl(options?: {
  /** 跳回本站的路径，默认 /login */
  redirectPath?: string;
  /** 附加在 redirect_uri 上的 query，如 registered=1 */
  redirectQuery?: Record<string, string>;
  /** 站点 origin；客户端可省略，自动取 window.location.origin */
  origin?: string;
}): string {
  const loginBase =
    process.env.NEXT_PUBLIC_BOBOAN_LOGIN_URL ?? DEFAULT_BOBOAN_LOGIN;

  const origin =
    options?.origin ??
    process.env.NEXT_PUBLIC_APP_URL ??
    (typeof window !== "undefined" ? window.location.origin : "");

  const url = new URL(loginBase);

  if (origin) {
    const path = options?.redirectPath ?? "/login";
    const qs = options?.redirectQuery
      ? `?${new URLSearchParams(options.redirectQuery).toString()}`
      : "";
    const redirectUri = `${origin.replace(/\/$/, "")}${path}${qs}`;
    url.searchParams.set("redirect_uri", redirectUri);
  }

  return url.toString();
}
