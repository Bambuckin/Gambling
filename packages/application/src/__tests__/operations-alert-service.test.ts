import { describe, expect, it } from "vitest";
import type { OperationsAuditEvent, OperationsAuditLog } from "../ports/operations-audit-log.js";
import type { TimeSource } from "../ports/time-source.js";
import { type AdminOperationsSnapshot } from "../services/admin-operations-query-service.js";
import { OperationsAlertService } from "../services/operations-alert-service.js";

describe("OperationsAlertService", () => {
  it("raises critical alerts for terminal offline and unresolved queue failures", async () => {
    const service = new OperationsAlertService({
      adminOperationsQueryService: {
        async getSnapshot() {
          return {
            terminal: {
              state: "offline",
              activeRequestId: "req-801",
              queueDepth: 2,
              consecutiveFailures: 4,
              lastErrorAt: "2026-04-05T22:58:00.000Z",
              checkedAt: "2026-04-05T22:59:00.000Z"
            },
            queue: {
              queueDepth: 2,
              queuedCount: 1,
              executingCount: 1,
              adminPriorityQueuedCount: 0,
              regularQueuedCount: 1
            },
            problemRequests: [
              problemRequest({
                requestId: "req-802",
                anomalyHint: "error",
                status: "error",
                updatedAt: "2026-04-05T22:58:00.000Z"
              }),
              problemRequest({
                requestId: "req-803",
                anomalyHint: "stale-executing",
                status: "executing",
                updatedAt: "2026-04-05T22:40:00.000Z"
              })
            ]
          } satisfies AdminOperationsSnapshot;
        }
      },
      operationsAuditLog: new InMemoryOperationsAuditLog(),
      timeSource: fixedTimeSource("2026-04-05T23:00:00.000Z")
    });

    const alerts = await service.listActiveAlerts();
    expect(alerts.map((alert) => alert.alertId)).toEqual([
      "queue-errors",
      "queue-stale-executing",
      "terminal-offline"
    ]);
    expect(alerts.every((alert) => alert.severity === "critical")).toBe(true);
    expect(alerts[2]?.referenceIds).toEqual(["req-801"]);
  });

  it("raises finance and retrying alerts from aggregated signals", async () => {
    const auditLog = new InMemoryOperationsAuditLog([
      {
        eventId: "ops-900",
        occurredAt: "2026-04-05T22:59:30.000Z",
        domain: "finance",
        action: "financial_anomaly_detected",
        severity: "critical",
        actor: {
          actorId: "finance-monitor",
          actorRole: "system"
        },
        target: {
          targetType: "ledger",
          targetId: "ledger"
        },
        reference: {
          ledgerEntryId: "ledger-33",
          requestId: "req-901"
        },
        message: "reserve/debit mismatch"
      }
    ]);
    const service = new OperationsAlertService({
      adminOperationsQueryService: {
        async getSnapshot() {
          return {
            terminal: {
              state: "idle",
              activeRequestId: null,
              queueDepth: 2,
              consecutiveFailures: 0,
              lastErrorAt: null,
              checkedAt: "2026-04-05T23:00:00.000Z"
            },
            queue: {
              queueDepth: 2,
              queuedCount: 2,
              executingCount: 0,
              adminPriorityQueuedCount: 0,
              regularQueuedCount: 2
            },
            problemRequests: [
              problemRequest({
                requestId: "req-910",
                anomalyHint: "retrying",
                status: "retrying",
                updatedAt: "2026-04-05T22:59:00.000Z"
              }),
              problemRequest({
                requestId: "req-911",
                anomalyHint: "retrying",
                status: "retrying",
                updatedAt: "2026-04-05T22:58:50.000Z"
              })
            ]
          } satisfies AdminOperationsSnapshot;
        }
      },
      operationsAuditLog: auditLog,
      timeSource: fixedTimeSource("2026-04-05T23:00:00.000Z")
    });

    const alerts = await service.listActiveAlerts();
    expect(alerts.map((alert) => alert.alertId)).toEqual(["finance-anomaly", "queue-retrying"]);
    expect(alerts[0]?.severity).toBe("critical");
    expect(alerts[0]?.referenceIds).toEqual(["ledger-33", "req-901"]);
    expect(alerts[1]?.severity).toBe("warning");
  });
});

function problemRequest(input: {
  readonly requestId: string;
  readonly status: "retrying" | "error" | "executing";
  readonly anomalyHint: "retrying" | "error" | "stale-executing";
  readonly updatedAt: string;
}): AdminOperationsSnapshot["problemRequests"][number] {
  return {
    requestId: input.requestId,
    userId: "seed-user",
    lotteryCode: "demo-lottery",
    drawId: "draw-900",
    status: input.status,
    queueStatus: input.status === "executing" ? "executing" : "queued",
    queuePriority: "regular",
    anomalyHint: input.anomalyHint,
    attemptCount: 1,
    updatedAt: input.updatedAt,
    lastError: input.anomalyHint === "error" ? "terminal_attempt outcome=error" : null
  };
}

class InMemoryOperationsAuditLog implements OperationsAuditLog {
  private readonly events: OperationsAuditEvent[];

  constructor(initialEvents: readonly OperationsAuditEvent[] = []) {
    this.events = initialEvents.map(cloneEvent);
  }

  async append(event: OperationsAuditEvent): Promise<void> {
    this.events.push(cloneEvent(event));
  }

  async listEvents(): Promise<readonly OperationsAuditEvent[]> {
    return this.events.map(cloneEvent);
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
