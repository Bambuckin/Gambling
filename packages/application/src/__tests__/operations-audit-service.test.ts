import { describe, expect, it } from "vitest";
import type { OperationsAuditEvent, OperationsAuditLog } from "../ports/operations-audit-log.js";
import type { TimeSource } from "../ports/time-source.js";
import { OperationsAuditService, type OperationsAuditEventIdFactory } from "../services/operations-audit-service.js";

describe("OperationsAuditService", () => {
  it("records structured events in append order with immutable reads", async () => {
    const log = new InMemoryOperationsAuditLog();
    const service = new OperationsAuditService({
      operationsAuditLog: log,
      timeSource: fixedTimeSource("2026-04-05T22:30:00.000Z"),
      eventIdFactory: new SequentialEventFactory()
    });

    await service.recordAdminQueueAction({
      actor: {
        actorId: "seed-admin",
        actorRole: "admin",
        actorLabel: "Administrator"
      },
      action: "queue_priority_changed",
      requestId: "req-701",
      reference: {
        requestId: "req-701",
        userId: "seed-user",
        lotteryCode: "demo-lottery"
      },
      message: "priority switched to admin-priority"
    });

    await service.recordTerminalIncident({
      action: "terminal_execution_error",
      reference: {
        requestId: "req-702",
        terminalId: "main-terminal"
      },
      message: "execution failed with timeout"
    });

    const events = await service.listEvents();
    expect(events.map((event) => event.eventId)).toEqual(["ops-1", "ops-2"]);
    expect(events.map((event) => event.domain)).toEqual(["admin-queue", "terminal"]);
    expect(events[0]?.target).toEqual({
      targetType: "request",
      targetId: "req-701"
    });
    expect(events[1]?.severity).toBe("critical");

    const mutable = events[0] as any;
    mutable.reference.requestId = "tampered";

    const freshRead = await service.listEvents();
    expect(freshRead[0]?.reference.requestId).toBe("req-701");
  });

  it("rejects events without contextual references", async () => {
    const service = new OperationsAuditService({
      operationsAuditLog: new InMemoryOperationsAuditLog(),
      timeSource: fixedTimeSource("2026-04-05T22:40:00.000Z"),
      eventIdFactory: new SequentialEventFactory()
    });

    await expect(
      service.recordFinancialAnomaly({
        action: "financial_anomaly_detected",
        reference: {},
        message: "ledger mismatch detected"
      })
    ).rejects.toThrow("requires at least one identifier");
  });
});

class InMemoryOperationsAuditLog implements OperationsAuditLog {
  private readonly events: OperationsAuditEvent[] = [];

  async append(event: OperationsAuditEvent): Promise<void> {
    this.events.push(cloneEvent(event));
  }

  async listEvents(): Promise<readonly OperationsAuditEvent[]> {
    return this.events.map(cloneEvent);
  }
}

class SequentialEventFactory implements OperationsAuditEventIdFactory {
  private index = 0;

  nextEventId(): string {
    this.index += 1;
    return `ops-${this.index}`;
  }
}

function fixedTimeSource(nowIso: string): TimeSource {
  return {
    nowIso() {
      return nowIso;
    }
  };
}

function cloneEvent(event: OperationsAuditEvent): OperationsAuditEvent {
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
