import type { TerminalExecutionLock } from "@lottery/application";

export class InMemoryTerminalExecutionLock implements TerminalExecutionLock {
  private ownerId: string | null = null;

  async acquire(ownerId: string): Promise<boolean> {
    const normalizedOwnerId = normalizeOwnerId(ownerId);
    if (this.ownerId === null) {
      this.ownerId = normalizedOwnerId;
      return true;
    }

    return this.ownerId === normalizedOwnerId;
  }

  async release(ownerId: string): Promise<void> {
    const normalizedOwnerId = normalizeOwnerId(ownerId);
    if (this.ownerId === normalizedOwnerId) {
      this.ownerId = null;
    }
  }
}

function normalizeOwnerId(ownerId: string): string {
  const normalized = ownerId.trim();
  if (!normalized) {
    throw new Error("ownerId is required");
  }
  return normalized;
}
