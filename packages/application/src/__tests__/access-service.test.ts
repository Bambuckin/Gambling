import { describe, expect, it } from "vitest";
import type { AccessAuditEvent, AccessIdentity, AccessSession } from "@lottery/domain";
import type { AccessAuditLog } from "../ports/access-audit-log.js";
import type { IdentityStore } from "../ports/identity-store.js";
import type { PasswordVerifier } from "../ports/password-verifier.js";
import type { SessionStore } from "../ports/session-store.js";
import type { TimeSource } from "../ports/time-source.js";
import { AccessService, type AccessSessionFactory } from "../services/access-service.js";

describe("AccessService", () => {
  it("creates and authenticates an active session after successful login", async () => {
    const time = new MutableTimeSource("2026-04-05T10:00:00.000Z");
    const { service, auditLog } = createAccessHarness({
      time,
      identities: [
        createIdentity({
          identityId: "identity-user",
          login: "operator",
          passwordHash: "secure-pass",
          role: "user",
          status: "active"
        })
      ]
    });

    const loginResult = await service.login({
      login: "Operator",
      password: "secure-pass",
      returnToLotteryCode: "gosloto-6x45"
    });

    expect(loginResult.ok).toBe(true);
    if (!loginResult.ok) {
      return;
    }

    expect(loginResult.session.returnToLotteryCode).toBe("gosloto-6x45");
    expect(loginResult.session.sessionId).toBe("session-1");

    time.set("2026-04-05T10:15:00.000Z");
    const authResult = await service.authenticate(loginResult.session.sessionId);

    expect(authResult).toMatchObject({
      ok: true,
      identity: {
        identityId: "identity-user"
      }
    });
    if (!authResult.ok) {
      return;
    }

    expect(authResult.session.lastSeenAt).toBe("2026-04-05T10:15:00.000Z");
    expect(auditLog.events).toEqual([
      {
        type: "login_success",
        occurredAt: "2026-04-05T10:00:00.000Z",
        sessionId: "session-1",
        actor: {
          login: "operator",
          identityId: "identity-user",
          role: "user"
        }
      }
    ]);
  });

  it("rejects login with invalid password", async () => {
    const { service, sessionStore, auditLog } = createAccessHarness({
      identities: [
        createIdentity({
          identityId: "identity-admin",
          login: "admin",
          passwordHash: "admin-pass",
          role: "admin",
          status: "active"
        })
      ]
    });

    const loginResult = await service.login({
      login: "admin",
      password: "wrong-pass"
    });

    expect(loginResult).toEqual({
      ok: false,
      reason: "invalid_password"
    });
    expect(await sessionStore.findById("session-1")).toBeNull();
    expect(auditLog.events).toEqual([
      {
        type: "login_denied",
        occurredAt: "2026-04-05T10:00:00.000Z",
        reason: "invalid_password",
        actor: {
          login: "admin",
          identityId: "identity-admin",
          role: "admin"
        }
      }
    ]);
  });

  it("rejects login for disabled identity and appends denied audit event", async () => {
    const { service, auditLog } = createAccessHarness({
      identities: [
        createIdentity({
          identityId: "identity-disabled",
          login: "disabled",
          passwordHash: "disabled-pass",
          role: "user",
          status: "disabled"
        })
      ]
    });

    const loginResult = await service.login({
      login: "disabled",
      password: "disabled-pass"
    });

    expect(loginResult).toEqual({
      ok: false,
      reason: "identity_disabled"
    });
    expect(auditLog.events).toEqual([
      {
        type: "login_denied",
        occurredAt: "2026-04-05T10:00:00.000Z",
        reason: "identity_disabled",
        actor: {
          login: "disabled",
          identityId: "identity-disabled",
          role: "user"
        }
      }
    ]);
  });

  it("expires and revokes stale sessions during authenticate", async () => {
    const time = new MutableTimeSource("2026-04-05T10:00:00.000Z");
    const { service, sessionStore, auditLog } = createAccessHarness({
      time,
      sessionTtlSeconds: 30,
      identities: [
        createIdentity({
          identityId: "identity-user",
          login: "user",
          passwordHash: "user-pass",
          role: "user",
          status: "active"
        })
      ]
    });

    const loginResult = await service.login({
      login: "user",
      password: "user-pass"
    });
    expect(loginResult.ok).toBe(true);
    if (!loginResult.ok) {
      return;
    }

    time.set("2026-04-05T10:01:00.000Z");
    const authResult = await service.authenticate(loginResult.session.sessionId);
    expect(authResult).toEqual({
      ok: false,
      reason: "session_expired"
    });

    const revoked = await sessionStore.findById(loginResult.session.sessionId);
    expect(revoked?.revokedAt).toBe("2026-04-05T10:01:00.000Z");
    expect(auditLog.events).toEqual([
      {
        type: "login_success",
        occurredAt: "2026-04-05T10:00:00.000Z",
        sessionId: "session-1",
        actor: {
          login: "user",
          identityId: "identity-user",
          role: "user"
        }
      }
    ]);
  });

  it("revokes session on logout and blocks further authenticate", async () => {
    const time = new MutableTimeSource("2026-04-05T10:00:00.000Z");
    const { service, auditLog } = createAccessHarness({
      time,
      identities: [
        createIdentity({
          identityId: "identity-user",
          login: "runner",
          passwordHash: "run-pass",
          role: "user",
          status: "active"
        })
      ]
    });

    const loginResult = await service.login({
      login: "runner",
      password: "run-pass"
    });
    expect(loginResult.ok).toBe(true);
    if (!loginResult.ok) {
      return;
    }

    const logoutResult = await service.logout(loginResult.session.sessionId);
    expect(logoutResult).toEqual({ ok: true });

    const authResult = await service.authenticate(loginResult.session.sessionId);
    expect(authResult).toEqual({
      ok: false,
      reason: "session_revoked"
    });
    expect(auditLog.events).toEqual([
      {
        type: "login_success",
        occurredAt: "2026-04-05T10:00:00.000Z",
        sessionId: "session-1",
        actor: {
          login: "runner",
          identityId: "identity-user",
          role: "user"
        }
      },
      {
        type: "logout",
        occurredAt: "2026-04-05T10:00:00.000Z",
        sessionId: "session-1",
        actor: {
          login: "runner",
          identityId: "identity-user",
          role: "user"
        }
      }
    ]);
  });
});

interface AccessHarnessInput {
  readonly identities: readonly AccessIdentity[];
  readonly time?: MutableTimeSource;
  readonly sessionTtlSeconds?: number;
}

function createAccessHarness(input: AccessHarnessInput): {
  readonly service: AccessService;
  readonly sessionStore: TestSessionStore;
  readonly auditLog: TestAccessAuditLog;
} {
  const timeSource = input.time ?? new MutableTimeSource("2026-04-05T10:00:00.000Z");
  const identityStore = new TestIdentityStore(input.identities);
  const sessionStore = new TestSessionStore();
  const auditLog = new TestAccessAuditLog();

  const dependencies = {
    identityStore,
    sessionStore,
    accessAuditLog: auditLog,
    passwordVerifier: new PlainTextPasswordVerifier(),
    timeSource,
    sessionFactory: new SequentialSessionFactory(),
    ...(
      typeof input.sessionTtlSeconds === "number"
        ? {
            config: {
              sessionTtlSeconds: input.sessionTtlSeconds
            }
          }
        : {}
    )
  };

  const service = new AccessService(dependencies);

  return { service, sessionStore, auditLog };
}

function createIdentity(input: {
  readonly identityId: string;
  readonly login: string;
  readonly passwordHash: string;
  readonly role: AccessIdentity["role"];
  readonly status: AccessIdentity["status"];
}): AccessIdentity {
  return {
    identityId: input.identityId,
    login: input.login.toLowerCase(),
    passwordHash: input.passwordHash,
    role: input.role,
    status: input.status,
    displayName: input.login,
    phone: "79990000000",
    createdAt: "2026-04-05T00:00:00.000Z",
    updatedAt: "2026-04-05T00:00:00.000Z"
  };
}

class TestIdentityStore implements IdentityStore {
  private readonly identitiesById = new Map<string, AccessIdentity>();
  private readonly identitiesByLogin = new Map<string, AccessIdentity>();

  constructor(identities: readonly AccessIdentity[]) {
    for (const identity of identities) {
      this.identitiesById.set(identity.identityId, identity);
      this.identitiesByLogin.set(identity.login.toLowerCase(), identity);
    }
  }

  async findByLogin(login: string): Promise<AccessIdentity | null> {
    return this.identitiesByLogin.get(login.trim().toLowerCase()) ?? null;
  }

  async findById(identityId: string): Promise<AccessIdentity | null> {
    return this.identitiesById.get(identityId) ?? null;
  }
}

class TestSessionStore implements SessionStore {
  private readonly sessions = new Map<string, AccessSession>();

  async create(session: AccessSession): Promise<void> {
    this.sessions.set(session.sessionId, session);
  }

  async findById(sessionId: string): Promise<AccessSession | null> {
    return this.sessions.get(sessionId) ?? null;
  }

  async update(session: AccessSession): Promise<void> {
    this.sessions.set(session.sessionId, session);
  }

  async revoke(sessionId: string, revokedAt: string): Promise<AccessSession | null> {
    const existing = this.sessions.get(sessionId);
    if (!existing) {
      return null;
    }

    const revoked: AccessSession = {
      ...existing,
      revokedAt,
      lastSeenAt: revokedAt
    };
    this.sessions.set(sessionId, revoked);

    return revoked;
  }
}

class PlainTextPasswordVerifier implements PasswordVerifier {
  async verify(plainTextPassword: string, passwordHash: string): Promise<boolean> {
    return plainTextPassword === passwordHash;
  }
}

class TestAccessAuditLog implements AccessAuditLog {
  readonly events: AccessAuditEvent[] = [];

  async append(event: AccessAuditEvent): Promise<void> {
    this.events.push({
      ...event,
      actor: { ...event.actor }
    });
  }
}

class MutableTimeSource implements TimeSource {
  private now: string;

  constructor(nowIso: string) {
    this.now = nowIso;
  }

  nowIso(): string {
    return this.now;
  }

  set(nowIso: string): void {
    this.now = nowIso;
  }
}

class SequentialSessionFactory implements AccessSessionFactory {
  private index = 0;

  nextSessionId(): string {
    this.index += 1;
    return `session-${this.index}`;
  }
}
