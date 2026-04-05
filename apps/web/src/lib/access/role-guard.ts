import type { SessionRole } from "@lottery/domain";

export type AccessGuardReason = "session_not_found" | "role_forbidden";

export interface MiddlewareGuardInput {
  readonly pathname: string;
  readonly sessionId: string | undefined;
  readonly roleHint: string | undefined;
}

export interface MiddlewareGuardDecision {
  readonly allowed: boolean;
  readonly reason?: AccessGuardReason;
  readonly redirectPath?: string;
}

interface RouteRoleRule {
  readonly pathPrefix: string;
  readonly requiredRoles: readonly SessionRole[];
}

const ROUTE_ROLE_RULES: readonly RouteRoleRule[] = [
  {
    pathPrefix: "/lottery",
    requiredRoles: ["user"]
  },
  {
    pathPrefix: "/admin",
    requiredRoles: ["admin"]
  }
];

export function requireRole(actualRole: SessionRole, requiredRoles: readonly SessionRole[]): boolean {
  return requiredRoles.includes(actualRole);
}

export function evaluateMiddlewareGuard(input: MiddlewareGuardInput): MiddlewareGuardDecision {
  const requiredRoles = resolveRequiredRolesForPath(input.pathname);
  if (!requiredRoles) {
    return { allowed: true };
  }

  const returnToPath = normalizeReturnToPath(input.pathname) ?? "/";
  if (!input.sessionId) {
    return {
      allowed: false,
      reason: "session_not_found",
      redirectPath: buildLoginRedirectPath(returnToPath, "session_not_found")
    };
  }

  const roleHint = parseRoleHint(input.roleHint);
  if (roleHint && !requireRole(roleHint, requiredRoles)) {
    return {
      allowed: false,
      reason: "role_forbidden",
      redirectPath: buildDeniedPath(returnToPath, requiredRoles, roleHint)
    };
  }

  return { allowed: true };
}

export function resolveRequiredRolesForPath(pathname: string): readonly SessionRole[] | null {
  for (const rule of ROUTE_ROLE_RULES) {
    if (pathname === rule.pathPrefix || pathname.startsWith(`${rule.pathPrefix}/`)) {
      return rule.requiredRoles;
    }
  }

  return null;
}

export function buildLoginRedirectPath(returnToPath: string | null, errorCode?: string): string {
  const searchParams = new URLSearchParams();
  if (returnToPath) {
    searchParams.set("returnTo", returnToPath);
  }
  if (errorCode) {
    searchParams.set("error", errorCode);
  }

  const query = searchParams.toString();
  return query ? `/login?${query}` : "/login";
}

export function buildDeniedPath(
  returnToPath: string,
  requiredRoles: readonly SessionRole[],
  actualRole: SessionRole
): string {
  const searchParams = new URLSearchParams();
  searchParams.set("returnTo", returnToPath);
  searchParams.set("required", requiredRoles.join(","));
  searchParams.set("actual", actualRole);
  return `/denied?${searchParams.toString()}`;
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

export function parseRoleHint(value: string | null | undefined): SessionRole | null {
  if (value === "admin" || value === "user") {
    return value;
  }

  return null;
}
