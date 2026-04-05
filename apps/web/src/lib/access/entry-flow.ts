import type { AccessIdentity, AccessSession } from "@lottery/domain";
import { normalizeIdentityLogin } from "@lottery/domain";
import { redirect } from "next/navigation";
import { getAccessService } from "./access-runtime";
import { clearSessionCookie, readSessionCookie, writeSessionCookie } from "./session-cookie";

const LOTTERY_PATH_PREFIX = "/lottery/";
const LOTTERY_CODE_PATTERN = /^[a-z0-9][a-z0-9-]{1,40}$/i;

export interface AuthenticatedAccessContext {
  readonly identity: AccessIdentity;
  readonly session: AccessSession;
  readonly lotteryCode: string;
}

export interface LoginSubmissionInput {
  readonly login: string;
  readonly password: string;
  readonly returnToPath: string | null;
}

export async function requireLotteryAccess(rawLotteryCode: string): Promise<AuthenticatedAccessContext> {
  const lotteryCode = sanitizeLotteryCode(rawLotteryCode);
  const returnToPath = lotteryPathFromCode(lotteryCode);

  const sessionId = await readSessionCookie();
  if (!sessionId) {
    return redirect(loginPath(returnToPath));
  }

  const authResult = await getAccessService().authenticate(sessionId);
  if (!authResult.ok) {
    await clearSessionCookie();
    return redirect(loginPath(returnToPath, authResult.reason));
  }

  return {
    identity: authResult.identity,
    session: authResult.session,
    lotteryCode
  };
}

export async function submitLogin(input: LoginSubmissionInput): Promise<void> {
  const normalizedLogin = normalizeIdentityLogin(input.login);
  const fallbackReturnToPath = normalizeReturnToPath(input.returnToPath);
  const returnToLotteryCode = parseLotteryCodeFromPath(fallbackReturnToPath);

  const loginResult = await getAccessService().login({
    login: normalizedLogin,
    password: input.password,
    ...(returnToLotteryCode ? { returnToLotteryCode } : {})
  });

  if (!loginResult.ok) {
    return redirect(loginPath(fallbackReturnToPath, loginResult.reason));
  }

  await writeSessionCookie(loginResult.session.sessionId);
  return redirect(resolvePostLoginPath(loginResult.session, fallbackReturnToPath));
}

export async function submitLogout(): Promise<void> {
  const sessionId = await readSessionCookie();
  if (sessionId) {
    await getAccessService().logout(sessionId);
  }

  await clearSessionCookie();
}

export function normalizeReturnToPath(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return null;
  }

  return trimmed;
}

export function loginPath(returnToPath: string | null, error?: string): string {
  const searchParams = new URLSearchParams();
  if (returnToPath) {
    searchParams.set("returnTo", returnToPath);
  }
  if (error) {
    searchParams.set("error", error);
  }

  const query = searchParams.toString();
  return query ? `/login?${query}` : "/login";
}

export function sanitizeLotteryCode(value: string): string {
  const trimmed = value.trim();
  if (LOTTERY_CODE_PATTERN.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  return "demo-lottery";
}

function lotteryPathFromCode(lotteryCode: string): string {
  return `${LOTTERY_PATH_PREFIX}${lotteryCode}`;
}

function parseLotteryCodeFromPath(returnToPath: string | null): string | undefined {
  if (!returnToPath || !returnToPath.startsWith(LOTTERY_PATH_PREFIX)) {
    return undefined;
  }

  const candidate = returnToPath.slice(LOTTERY_PATH_PREFIX.length).split("/")[0];
  if (!candidate) {
    return undefined;
  }

  return sanitizeLotteryCode(candidate);
}

function resolvePostLoginPath(session: AccessSession, fallbackReturnToPath: string | null): string {
  if (fallbackReturnToPath) {
    return fallbackReturnToPath;
  }

  if (session.returnToLotteryCode) {
    return lotteryPathFromCode(sanitizeLotteryCode(session.returnToLotteryCode));
  }

  return "/lottery/demo-lottery";
}
