import type { OperationsAuditEvent, OperationsAuditLog } from "@lottery/application";

export class InMemoryOperationsAuditLog implements OperationsAuditLog {
  private readonly events: OperationsAuditEvent[] = [];

  async append(event: OperationsAuditEvent): Promise<void> {
    this.events.push(cloneOperationsAuditEvent(event));
  }

  async listEvents(): Promise<readonly OperationsAuditEvent[]> {
    return this.events.map(cloneOperationsAuditEvent);
  }

  clear(): void {
    this.events.length = 0;
  }
}

function cloneOperationsAuditEvent(event: OperationsAuditEvent): OperationsAuditEvent {
  return {
    ...event,
    actor: {
      ...event.actor
    },
    target: {
      ...event.target
    },
    reference: {
      ...event.reference
    }
  };
}
