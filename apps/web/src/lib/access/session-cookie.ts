import { cookies } from "next/headers";

export const ACCESS_SESSION_COOKIE_NAME = "lottery_access_session";
const ACCESS_SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 8;

export async function readSessionCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(ACCESS_SESSION_COOKIE_NAME)?.value ?? null;
}

export async function writeSessionCookie(sessionId: string): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(ACCESS_SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: ACCESS_SESSION_COOKIE_MAX_AGE_SECONDS
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ACCESS_SESSION_COOKIE_NAME);
}

export function buildSessionSetCookieHeader(sessionId: string): string {
  return [
    `${ACCESS_SESSION_COOKIE_NAME}=${sessionId}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${ACCESS_SESSION_COOKIE_MAX_AGE_SECONDS}`
  ].join("; ");
}
