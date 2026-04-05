import { cookies } from "next/headers";
import type { SessionRole } from "@lottery/domain";
import { ACCESS_ROLE_HINT_COOKIE_NAME, ACCESS_SESSION_COOKIE_NAME } from "./cookie-names";

const ACCESS_SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 8;

export async function readSessionCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(ACCESS_SESSION_COOKIE_NAME)?.value ?? null;
}

export async function writeSessionCookie(sessionId: string, roleHint: SessionRole): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(ACCESS_SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: ACCESS_SESSION_COOKIE_MAX_AGE_SECONDS
  });

  cookieStore.set(ACCESS_ROLE_HINT_COOKIE_NAME, roleHint, {
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
  cookieStore.delete(ACCESS_ROLE_HINT_COOKIE_NAME);
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
