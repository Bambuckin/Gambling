import type { SessionRole } from "./access.js";

export const ACCESS_AUDIT_EVENT_TYPES = ["login_success", "login_denied", "logout"] as const;
export type AccessAuditEventType = (typeof ACCESS_AUDIT_EVENT_TYPES)[number];

export const ACCESS_LOGIN_DENIED_REASONS = [
  "identity_not_found",
  "identity_disabled",
  "invalid_password"
] as const;
export type AccessLoginDeniedReason = (typeof ACCESS_LOGIN_DENIED_REASONS)[number];

export interface AccessAuditActor {
  readonly login: string;
  readonly identityId?: string;
  readonly role?: SessionRole;
}

interface AccessAuditEventBase<TType extends AccessAuditEventType> {
  readonly type: TType;
  readonly occurredAt: string;
  readonly actor: AccessAuditActor;
}

export interface LoginSuccessAccessAuditEvent extends AccessAuditEventBase<"login_success"> {
  readonly sessionId: string;
}

export interface LoginDeniedAccessAuditEvent extends AccessAuditEventBase<"login_denied"> {
  readonly reason: AccessLoginDeniedReason;
}

export interface LogoutAccessAuditEvent extends AccessAuditEventBase<"logout"> {
  readonly sessionId: string;
}

export type AccessAuditEvent =
  | LoginSuccessAccessAuditEvent
  | LoginDeniedAccessAuditEvent
  | LogoutAccessAuditEvent;
