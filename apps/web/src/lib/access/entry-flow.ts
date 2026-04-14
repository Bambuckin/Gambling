import type { AccessIdentity, AccessSession, SessionRole } from "@lottery/domain";
import { normalizeIdentityLogin } from "@lottery/domain";
import { redirect } from "next/navigation";
import { getAccessService } from "./access-runtime";
import { clearSessionCookie, readSessionCookie, writeSessionCookie } from "./session-cookie";
import { buildDeniedPath, buildLoginRedirectPath, normalizeReturnToPath, requireRole } from "./role-guard";
import { isLotteryEnabled, resolveFallbackLotteryCode } from "./lottery-catalog";

export { normalizeReturnToPath };

const LOTTERY_PATH_PREFIX = "/lottery/";
const LOTTERY_CODE_PATTERN = /^[a-z0-9][a-z0-9-]{1,40}$/i;

export interface AuthenticatedAccessContext {
  readonly identity: AccessIdentity;
  readonly session: AccessSession;
}

export interface AuthenticatedLotteryContext extends AuthenticatedAccessContext {
  readonly lotteryCode: string;
}

export interface LoginSubmissionInput {
  readonly login: string;
  readonly password: string;
  readonly returnToPath: string | null;
}

export async function requireLotteryAccess(rawLotteryCode: string): Promise<AuthenticatedLotteryContext> {
  const lotteryCode = await resolveAllowedLotteryCode(rawLotteryCode);
  const access = await requireAccessRole(["user"], lotteryPathFromCode(lotteryCode));

  return {
    ...access,
    lotteryCode
  };
}

export async function requireAdminAccess(returnToPath = "/admin"): Promise<AuthenticatedAccessContext> {
  return requireAccessRole(["admin"], returnToPath);
}

export async function resolveCurrentAccessRole(): Promise<SessionRole | null> {
  const sessionId = await readSessionCookie();
  if (!sessionId) {
    return null;
  }

  const authResult = await getAccessService().authenticate(sessionId);
  if (!authResult.ok) {
    return null;
  }

  return authResult.identity.role;
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

  await writeSessionCookie(loginResult.session.sessionId, loginResult.identity.role);
  return redirect(resolvePostLoginPath(loginResult.session, loginResult.identity.role, fallbackReturnToPath));
}

export async function submitLogout(): Promise<void> {
  const sessionId = await readSessionCookie();
  if (sessionId) {
    await getAccessService().logout(sessionId);
  }

  await clearSessionCookie();
}

export function loginPath(returnToPath: string | null, error?: string): string {
  return buildLoginRedirectPath(returnToPath, error);
}

export function sanitizeLotteryCode(value: string): string {
  const trimmed = value.trim();
  if (LOTTERY_CODE_PATTERN.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  return "mechtallion";
}

async function resolveAllowedLotteryCode(rawLotteryCode: string): Promise<string> {
  const candidateCode = sanitizeLotteryCode(rawLotteryCode);
  const enabled = await isLotteryEnabled(candidateCode);
  if (enabled) {
    return candidateCode;
  }

  return resolveFallbackLotteryCode(candidateCode);
}

async function requireAccessRole(
  requiredRoles: readonly SessionRole[],
  returnToPath: string
): Promise<AuthenticatedAccessContext> {
  const sessionId = await readSessionCookie();
  if (!sessionId) {
    return redirect(loginPath(returnToPath, "session_not_found"));
  }

  const authResult = await getAccessService().authenticate(sessionId);
  if (!authResult.ok) {
    return redirect(loginPath(returnToPath, authResult.reason));
  }

  if (!requireRole(authResult.identity.role, requiredRoles)) {
    return redirect(buildDeniedPath(returnToPath, requiredRoles, authResult.identity.role));
  }

  return {
    identity: authResult.identity,
    session: authResult.session
  };
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

function resolvePostLoginPath(session: AccessSession, role: SessionRole, fallbackReturnToPath: string | null): string {
  if (fallbackReturnToPath) {
    return fallbackReturnToPath;
  }

  if (session.returnToLotteryCode) {
    return lotteryPathFromCode(sanitizeLotteryCode(session.returnToLotteryCode));
  }

  return role === "admin" ? "/admin" : "/lottery/mechtallion";
}
