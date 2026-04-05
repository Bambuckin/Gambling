import {
  type AccessIdentity,
  type AccessSession,
  isSessionValid,
  normalizeIdentityLogin,
  resolveSessionStatus,
  touchSession
} from "@lottery/domain";
import type { TimeSource } from "../ports/time-source.js";
import type { IdentityStore } from "../ports/identity-store.js";
import type { PasswordVerifier } from "../ports/password-verifier.js";
import type { SessionStore } from "../ports/session-store.js";

export type LoginFailureReason = "identity_not_found" | "identity_disabled" | "invalid_password";
export type AuthenticateFailureReason =
  | "session_not_found"
  | "session_expired"
  | "session_revoked"
  | "identity_not_found"
  | "identity_disabled";

export interface LoginCommand {
  readonly login: string;
  readonly password: string;
  readonly returnToLotteryCode?: string;
}

export interface LogoutResult {
  readonly ok: boolean;
  readonly reason?: "session_not_found";
}

export interface AccessSessionFactory {
  nextSessionId(): string;
}

export interface AccessServiceConfig {
  readonly sessionTtlSeconds?: number;
}

export interface AccessServiceDependencies {
  readonly identityStore: IdentityStore;
  readonly sessionStore: SessionStore;
  readonly passwordVerifier: PasswordVerifier;
  readonly timeSource: TimeSource;
  readonly sessionFactory?: AccessSessionFactory;
  readonly config?: AccessServiceConfig;
}

export interface LoginSuccessResult {
  readonly ok: true;
  readonly identity: AccessIdentity;
  readonly session: AccessSession;
}

export interface LoginFailureResult {
  readonly ok: false;
  readonly reason: LoginFailureReason;
}

export interface AuthenticateSuccessResult {
  readonly ok: true;
  readonly identity: AccessIdentity;
  readonly session: AccessSession;
}

export interface AuthenticateFailureResult {
  readonly ok: false;
  readonly reason: AuthenticateFailureReason;
}

export type LoginResult = LoginSuccessResult | LoginFailureResult;
export type AuthenticateResult = AuthenticateSuccessResult | AuthenticateFailureResult;

const DEFAULT_SESSION_TTL_SECONDS = 60 * 60 * 8;

export class AccessService {
  private readonly identityStore: IdentityStore;
  private readonly sessionStore: SessionStore;
  private readonly passwordVerifier: PasswordVerifier;
  private readonly timeSource: TimeSource;
  private readonly sessionFactory: AccessSessionFactory;
  private readonly sessionTtlSeconds: number;

  constructor(dependencies: AccessServiceDependencies) {
    this.identityStore = dependencies.identityStore;
    this.sessionStore = dependencies.sessionStore;
    this.passwordVerifier = dependencies.passwordVerifier;
    this.timeSource = dependencies.timeSource;
    this.sessionFactory = dependencies.sessionFactory ?? new RandomSessionFactory();
    this.sessionTtlSeconds = dependencies.config?.sessionTtlSeconds ?? DEFAULT_SESSION_TTL_SECONDS;
  }

  async login(command: LoginCommand): Promise<LoginResult> {
    const login = normalizeIdentityLogin(command.login);
    const identity = await this.identityStore.findByLogin(login);
    if (!identity) {
      return { ok: false, reason: "identity_not_found" };
    }

    if (identity.status !== "active") {
      return { ok: false, reason: "identity_disabled" };
    }

    const passwordMatches = await this.passwordVerifier.verify(command.password, identity.passwordHash);
    if (!passwordMatches) {
      return { ok: false, reason: "invalid_password" };
    }

    const issuedAt = this.timeSource.nowIso();
    const expiresAt = new Date(Date.parse(issuedAt) + this.sessionTtlSeconds * 1000).toISOString();
    const session: AccessSession = {
      sessionId: this.sessionFactory.nextSessionId(),
      identityId: identity.identityId,
      role: identity.role,
      issuedAt,
      expiresAt,
      lastSeenAt: issuedAt,
      ...(command.returnToLotteryCode ? { returnToLotteryCode: command.returnToLotteryCode } : {})
    };

    await this.sessionStore.create(session);

    return {
      ok: true,
      identity,
      session
    };
  }

  async authenticate(sessionId: string): Promise<AuthenticateResult> {
    const session = await this.sessionStore.findById(sessionId);
    if (!session) {
      return { ok: false, reason: "session_not_found" };
    }

    const nowIso = this.timeSource.nowIso();
    if (!isSessionValid(session, nowIso)) {
      const status = resolveSessionStatus(session, nowIso);
      if (status === "expired") {
        await this.sessionStore.revoke(session.sessionId, nowIso);
        return { ok: false, reason: "session_expired" };
      }

      return { ok: false, reason: "session_revoked" };
    }

    const identity = await this.identityStore.findById(session.identityId);
    if (!identity) {
      return { ok: false, reason: "identity_not_found" };
    }

    if (identity.status !== "active") {
      return { ok: false, reason: "identity_disabled" };
    }

    const refreshedSession = touchSession(session, nowIso);
    await this.sessionStore.update(refreshedSession);

    return {
      ok: true,
      identity,
      session: refreshedSession
    };
  }

  async logout(sessionId: string): Promise<LogoutResult> {
    const revokedSession = await this.sessionStore.revoke(sessionId, this.timeSource.nowIso());
    if (!revokedSession) {
      return {
        ok: false,
        reason: "session_not_found"
      };
    }

    return { ok: true };
  }
}

class RandomSessionFactory implements AccessSessionFactory {
  nextSessionId(): string {
    return `sess_${Math.random().toString(36).slice(2, 14)}`;
  }
}
