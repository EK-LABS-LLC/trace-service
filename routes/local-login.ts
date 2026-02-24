import { splitSetCookieHeader } from "better-auth/cookies";
import type { Context } from "hono";

const LOCAL_LOGIN_TOKEN_TTL_MS = 2 * 60 * 1000;

interface LocalLoginTokenRecord {
  email: string;
  password: string;
  redirectUrl: string;
  expiresAt: number;
}

interface LocalLoginTokenRequest {
  email?: string;
  password?: string;
  redirect_url?: string;
}

const localLoginTokens = new Map<string, LocalLoginTokenRecord>();

export async function handleCreateLocalLoginToken(c: Context): Promise<Response> {
  const requestUrl = safeParseUrl(c.req.url);
  if (!requestUrl || !isLoopbackHost(requestUrl.hostname)) {
    return c.json({ error: "Local login token endpoint is only available on loopback hosts" }, 403);
  }

  let body: LocalLoginTokenRequest;
  try {
    body = await c.req.json<LocalLoginTokenRequest>();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const email = body.email?.trim().toLowerCase();
  const password = body.password;
  const redirectUrl = body.redirect_url?.trim();

  if (!email || !password || !redirectUrl) {
    return c.json({ error: "Missing required fields: email, password, redirect_url" }, 400);
  }

  const redirect = safeParseUrl(redirectUrl);
  if (!redirect || !isLoopbackHost(redirect.hostname)) {
    return c.json({ error: "redirect_url must use a loopback host (localhost or 127.0.0.1)" }, 400);
  }

  purgeExpiredTokens();

  const token = crypto.randomUUID().replaceAll("-", "");
  const expiresAt = Date.now() + LOCAL_LOGIN_TOKEN_TTL_MS;

  localLoginTokens.set(token, {
    email,
    password,
    redirectUrl: redirect.toString(),
    expiresAt,
  });

  const loginUrl = new URL("/dashboard/api/local-login", requestUrl);
  loginUrl.searchParams.set("token", token);

  return c.json(
    {
      login_url: loginUrl.toString(),
      expires_at: new Date(expiresAt).toISOString(),
    },
    201,
  );
}

export async function handleConsumeLocalLoginToken(c: Context): Promise<Response> {
  const requestUrl = safeParseUrl(c.req.url);
  if (!requestUrl || !isLoopbackHost(requestUrl.hostname)) {
    return c.json({ error: "Local login endpoint is only available on loopback hosts" }, 403);
  }

  purgeExpiredTokens();

  const token = c.req.query("token")?.trim();
  if (!token) {
    return c.json({ error: "Missing token query parameter" }, 400);
  }

  const record = consumeToken(token);
  if (!record) {
    return c.json({ error: "Token is invalid or expired" }, 400);
  }

  const signInUrl = new URL("/api/auth/sign-in/email", requestUrl);
  const signInResponse = await fetch(signInUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email: record.email,
      password: record.password,
    }),
    redirect: "manual",
  });

  if (!signInResponse.ok) {
    const body = await signInResponse.text().catch(() => "");
    return c.json(
      {
        error: `Local sign-in failed (${signInResponse.status}): ${compactBody(body)}`,
      },
      401,
    );
  }

  const setCookies = getSetCookieHeaders(signInResponse.headers);
  if (setCookies.length === 0) {
    return c.json(
      {
        error: "Sign-in succeeded but no session cookie was returned",
      },
      500,
    );
  }

  for (const value of setCookies) {
    c.header("Set-Cookie", value, { append: true });
  }
  c.header("Cache-Control", "no-store");

  return c.redirect(record.redirectUrl, 302);
}

function consumeToken(token: string): LocalLoginTokenRecord | null {
  const record = localLoginTokens.get(token);
  if (!record) {
    return null;
  }

  localLoginTokens.delete(token);
  if (record.expiresAt <= Date.now()) {
    return null;
  }

  return record;
}

function purgeExpiredTokens(now = Date.now()): void {
  for (const [token, record] of localLoginTokens.entries()) {
    if (record.expiresAt <= now) {
      localLoginTokens.delete(token);
    }
  }
}

function getSetCookieHeaders(headers: Headers): string[] {
  const headersWithGetSetCookie = headers as Headers & {
    getSetCookie?: () => string[];
  };

  const direct = headersWithGetSetCookie.getSetCookie?.();
  if (direct && direct.length > 0) {
    return direct;
  }

  const combined = headers.get("set-cookie");
  if (!combined) {
    return [];
  }

  return splitSetCookieHeader(combined)
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function safeParseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function compactBody(body: string): string {
  const collapsed = body.split(/\s+/).join(" ").trim();
  if (!collapsed) {
    return "unknown error";
  }
  if (collapsed.length <= 240) {
    return collapsed;
  }
  return `${collapsed.slice(0, 240)}...`;
}
