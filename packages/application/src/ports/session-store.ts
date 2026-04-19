import type { AccessSession } from "@lottery/domain";

export interface SessionStore {
  create(session: AccessSession): Promise<void>;
  findById(sessionId: string): Promise<AccessSession | null>;
  update(session: AccessSession): Promise<void>;
  revoke(sessionId: string, revokedAt: string): Promise<AccessSession | null>;
  revokeAll(revokedAt: string): Promise<void>;
}
