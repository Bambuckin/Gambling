import type { AccessAuditLog } from "@lottery/application";
import type { AccessAuditEvent } from "@lottery/domain";

export class InMemoryAccessAuditLog implements AccessAuditLog {
  private readonly events: AccessAuditEvent[] = [];

  async append(event: AccessAuditEvent): Promise<void> {
    this.events.push(cloneAccessAuditEvent(event));
  }

  readAll(): readonly AccessAuditEvent[] {
    return this.events.map((event) => cloneAccessAuditEvent(event));
  }

  clear(): void {
    this.events.length = 0;
  }
}

function cloneAccessAuditEvent(event: AccessAuditEvent): AccessAuditEvent {
  return {
    ...event,
    actor: {
      ...event.actor
    }
  };
}
