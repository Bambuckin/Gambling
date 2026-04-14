import type { AccessAuditLog, IdentityStore, SessionStore } from "@lottery/application";
import {
  normalizeIdentityLogin,
  normalizeIdentityPhone,
  type AccessAuditEvent,
  type AccessIdentity,
  type AccessSession
} from "@lottery/domain";
import type { Pool } from "pg";
import { deepClone, normalizeText, optionalNormalizedText } from "./utils.js";

export class PostgresIdentityStore implements IdentityStore {
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async findByLogin(login: string): Promise<AccessIdentity | null> {
    const normalizedLogin = normalizeIdentityLogin(login);
    const result = await this.pool.query(
      `
        select
          identity_id,
          login,
          password_hash,
          role,
          status,
          display_name,
          phone,
          created_at,
          updated_at
        from lottery_identities
        where login = $1
        limit 1
      `,
      [normalizedLogin]
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return rowToAccessIdentity(row);
  }

  async findById(identityId: string): Promise<AccessIdentity | null> {
    const normalizedIdentityId = normalizeText(identityId, "identityId");
    const result = await this.pool.query(
      `
        select
          identity_id,
          login,
          password_hash,
          role,
          status,
          display_name,
          phone,
          created_at,
          updated_at
        from lottery_identities
        where identity_id = $1
        limit 1
      `,
      [normalizedIdentityId]
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return rowToAccessIdentity(row);
  }

  async upsert(identity: AccessIdentity): Promise<void> {
    const payload = normalizeIdentity(identity);
    await this.pool.query(
      `
        insert into lottery_identities (
          identity_id,
          login,
          password_hash,
          role,
          status,
          display_name,
          phone,
          created_at,
          updated_at
        ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        on conflict (identity_id)
        do update
          set login = excluded.login,
              password_hash = excluded.password_hash,
              role = excluded.role,
              status = excluded.status,
              display_name = excluded.display_name,
              phone = excluded.phone,
              created_at = excluded.created_at,
              updated_at = excluded.updated_at
      `,
      [
        payload.identityId,
        payload.login,
        payload.passwordHash,
        payload.role,
        payload.status,
        payload.displayName,
        payload.phone,
        payload.createdAt,
        payload.updatedAt
      ]
    );
  }

  async upsertMany(identities: readonly AccessIdentity[]): Promise<void> {
    for (const identity of identities) {
      await this.upsert(identity);
    }
  }

  async count(): Promise<number> {
    const result = await this.pool.query("select count(*)::integer as count from lottery_identities");
    return Number(result.rows[0]?.count ?? 0);
  }
}

export class PostgresSessionStore implements SessionStore {
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async create(session: AccessSession): Promise<void> {
    const payload = normalizeSession(session);
    await this.pool.query(
      `
        insert into lottery_sessions (
          session_id,
          identity_id,
          role,
          issued_at,
          expires_at,
          last_seen_at,
          return_to_lottery_code,
          revoked_at
        ) values ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        payload.sessionId,
        payload.identityId,
        payload.role,
        payload.issuedAt,
        payload.expiresAt,
        payload.lastSeenAt,
        payload.returnToLotteryCode ?? null,
        payload.revokedAt ?? null
      ]
    );
  }

  async findById(sessionId: string): Promise<AccessSession | null> {
    const normalizedSessionId = normalizeText(sessionId, "sessionId");
    const result = await this.pool.query(
      `
        select
          session_id,
          identity_id,
          role,
          issued_at,
          expires_at,
          last_seen_at,
          return_to_lottery_code,
          revoked_at
        from lottery_sessions
        where session_id = $1
        limit 1
      `,
      [normalizedSessionId]
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return rowToAccessSession(row);
  }

  async update(session: AccessSession): Promise<void> {
    const payload = normalizeSession(session);
    const result = await this.pool.query(
      `
        update lottery_sessions
        set
          identity_id = $2,
          role = $3,
          issued_at = $4,
          expires_at = $5,
          last_seen_at = $6,
          return_to_lottery_code = $7,
          revoked_at = $8
        where session_id = $1
      `,
      [
        payload.sessionId,
        payload.identityId,
        payload.role,
        payload.issuedAt,
        payload.expiresAt,
        payload.lastSeenAt,
        payload.returnToLotteryCode ?? null,
        payload.revokedAt ?? null
      ]
    );

    if (result.rowCount === 0) {
      throw new Error(`session ${payload.sessionId} was not found`);
    }
  }

  async revoke(sessionId: string, revokedAt: string): Promise<AccessSession | null> {
    const normalizedSessionId = normalizeText(sessionId, "sessionId");
    const normalizedRevokedAt = toIsoString(revokedAt);

    const result = await this.pool.query(
      `
        update lottery_sessions
        set
          revoked_at = $2,
          last_seen_at = $2
        where session_id = $1
        returning
          session_id,
          identity_id,
          role,
          issued_at,
          expires_at,
          last_seen_at,
          return_to_lottery_code,
          revoked_at
      `,
      [normalizedSessionId, normalizedRevokedAt]
    );

    const row = result.rows[0];
    return row ? rowToAccessSession(row) : null;
  }
}

export class PostgresAccessAuditLog implements AccessAuditLog {
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async append(event: AccessAuditEvent): Promise<void> {
    const clonedEvent = deepClone(event);
    const occurredAt = toIsoString(event.occurredAt);

    await this.pool.query(
      `
        insert into lottery_access_audit_events (
          occurred_at,
          event
        ) values ($1, $2::jsonb)
      `,
      [occurredAt, JSON.stringify(clonedEvent)]
    );
  }

  async listEvents(): Promise<readonly AccessAuditEvent[]> {
    const result = await this.pool.query(
      `
        select event
        from lottery_access_audit_events
        order by occurred_at asc, id asc
      `
    );

    return result.rows.map((row: { event: AccessAuditEvent }) => deepClone(row.event));
  }
}

function normalizeIdentity(identity: AccessIdentity): AccessIdentity {
  return {
    ...identity,
    identityId: normalizeText(identity.identityId, "identity.identityId"),
    login: normalizeIdentityLogin(identity.login),
    passwordHash: normalizeText(identity.passwordHash, "identity.passwordHash"),
    role: identity.role,
    status: identity.status,
    displayName: normalizeText(identity.displayName, "identity.displayName"),
    phone: normalizeIdentityPhone(identity.phone),
    createdAt: toIsoString(identity.createdAt),
    updatedAt: toIsoString(identity.updatedAt)
  };
}

function normalizeSession(session: AccessSession): AccessSession {
  const returnToLotteryCode = optionalNormalizedText(session.returnToLotteryCode);
  const revokedAt = optionalNormalizedText(session.revokedAt);

  return {
    ...session,
    sessionId: normalizeText(session.sessionId, "session.sessionId"),
    identityId: normalizeText(session.identityId, "session.identityId"),
    role: session.role,
    issuedAt: toIsoString(session.issuedAt),
    expiresAt: toIsoString(session.expiresAt),
    lastSeenAt: toIsoString(session.lastSeenAt),
    ...(returnToLotteryCode ? { returnToLotteryCode } : {}),
    ...(revokedAt ? { revokedAt: toIsoString(revokedAt) } : {})
  };
}

function rowToAccessIdentity(row: {
  identity_id: string;
  login: string;
  password_hash: string;
  role: AccessIdentity["role"];
  status: AccessIdentity["status"];
  display_name: string;
  phone: string;
  created_at: unknown;
  updated_at: unknown;
}): AccessIdentity {
  return {
    identityId: row.identity_id,
    login: row.login,
    passwordHash: row.password_hash,
    role: row.role,
    status: row.status,
    displayName: row.display_name,
    phone: normalizeIdentityPhone(row.phone),
    createdAt: toIsoFromUnknown(row.created_at),
    updatedAt: toIsoFromUnknown(row.updated_at)
  };
}

function rowToAccessSession(row: {
  session_id: string;
  identity_id: string;
  role: AccessSession["role"];
  issued_at: unknown;
  expires_at: unknown;
  last_seen_at: unknown;
  return_to_lottery_code: string | null;
  revoked_at: unknown | null;
}): AccessSession {
  return {
    sessionId: row.session_id,
    identityId: row.identity_id,
    role: row.role,
    issuedAt: toIsoFromUnknown(row.issued_at),
    expiresAt: toIsoFromUnknown(row.expires_at),
    lastSeenAt: toIsoFromUnknown(row.last_seen_at),
    ...(row.return_to_lottery_code ? { returnToLotteryCode: row.return_to_lottery_code } : {}),
    ...(row.revoked_at ? { revokedAt: toIsoFromUnknown(row.revoked_at) } : {})
  };
}

function toIsoString(value: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new Error(`Invalid ISO timestamp: ${value}`);
  }

  return new Date(timestamp).toISOString();
}

function toIsoFromUnknown(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string") {
    return toIsoString(value);
  }

  throw new Error(`Unsupported timestamp value: ${String(value)}`);
}
