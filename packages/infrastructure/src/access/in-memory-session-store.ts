import type { SessionStore } from "@lottery/application";
import type { AccessSession } from "@lottery/domain";

export class InMemorySessionStore implements SessionStore {
  private readonly sessions = new Map<string, AccessSession>();

  async create(session: AccessSession): Promise<void> {
    if (this.sessions.has(session.sessionId)) {
      throw new Error(`session ${session.sessionId} already exists`);
    }

    this.sessions.set(session.sessionId, { ...session });
  }

  async findById(sessionId: string): Promise<AccessSession | null> {
    return cloneSession(this.sessions.get(sessionId));
  }

  async update(session: AccessSession): Promise<void> {
    if (!this.sessions.has(session.sessionId)) {
      throw new Error(`session ${session.sessionId} was not found`);
    }

    this.sessions.set(session.sessionId, { ...session });
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

    return cloneSession(revoked);
  }
}

function cloneSession(session: AccessSession | undefined): AccessSession | null {
  if (!session) {
    return null;
  }

  return {
    ...session
  };
}
