export const SESSION_ROLES = ["user", "admin"] as const;
export type SessionRole = (typeof SESSION_ROLES)[number];

export const ACCESS_IDENTITY_STATUSES = ["active", "disabled"] as const;
export type AccessIdentityStatus = (typeof ACCESS_IDENTITY_STATUSES)[number];

export interface AccessIdentity {
  readonly identityId: string;
  readonly login: string;
  readonly passwordHash: string;
  readonly role: SessionRole;
  readonly status: AccessIdentityStatus;
  readonly displayName: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AccessSession {
  readonly sessionId: string;
  readonly identityId: string;
  readonly role: SessionRole;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly lastSeenAt: string;
  readonly returnToLotteryCode?: string;
  readonly revokedAt?: string;
}

export type SessionStatus = "active" | "expired" | "revoked";

export function normalizeIdentityLogin(login: string): string {
  return login.trim().toLowerCase();
}

export function resolveSessionStatus(session: AccessSession, nowIso: string): SessionStatus {
  if (session.revokedAt) {
    return "revoked";
  }

  return Date.parse(session.expiresAt) <= Date.parse(nowIso) ? "expired" : "active";
}

export function isSessionValid(session: AccessSession, nowIso: string): boolean {
  return resolveSessionStatus(session, nowIso) === "active";
}

export function touchSession(session: AccessSession, nowIso: string): AccessSession {
  return {
    ...session,
    lastSeenAt: nowIso
  };
}
