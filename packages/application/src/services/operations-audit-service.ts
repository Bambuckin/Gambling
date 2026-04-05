import type { TimeSource } from "../ports/time-source.js";
import type {
  OperationsAuditActor,
  OperationsAuditEvent,
  OperationsAuditLog,
  OperationsAuditReference,
  OperationsAuditSeverity,
  OperationsAuditTarget
} from "../ports/operations-audit-log.js";

export interface OperationsAuditEventIdFactory {
  nextEventId(): string;
}

export interface OperationsAuditServiceDependencies {
  readonly operationsAuditLog: OperationsAuditLog;
  readonly timeSource: TimeSource;
  readonly eventIdFactory?: OperationsAuditEventIdFactory;
}

export interface RecordAdminQueueActionInput {
  readonly actor: OperationsAuditActor;
  readonly action: "queue_priority_changed" | "admin_priority_enqueued";
  readonly requestId: string;
  readonly reference: OperationsAuditReference;
  readonly message: string;
  readonly severity?: OperationsAuditSeverity;
}

export interface RecordTerminalIncidentInput {
  readonly action: "terminal_degraded" | "terminal_offline" | "terminal_execution_error" | "terminal_execution_stale";
  readonly reference: OperationsAuditReference;
  readonly message: string;
  readonly severity?: OperationsAuditSeverity;
  readonly actor?: OperationsAuditActor;
  readonly terminalId?: string;
}

export interface RecordFinancialAnomalyInput {
  readonly action: "financial_anomaly_detected";
  readonly reference: OperationsAuditReference;
  readonly message: string;
  readonly severity?: OperationsAuditSeverity;
  readonly actor?: OperationsAuditActor;
  readonly targetId?: string;
}

export class OperationsAuditService {
  private readonly operationsAuditLog: OperationsAuditLog;
  private readonly timeSource: TimeSource;
  private readonly eventIdFactory: OperationsAuditEventIdFactory;

  constructor(dependencies: OperationsAuditServiceDependencies) {
    this.operationsAuditLog = dependencies.operationsAuditLog;
    this.timeSource = dependencies.timeSource;
    this.eventIdFactory = dependencies.eventIdFactory ?? new RandomOperationsAuditEventIdFactory();
  }

  async recordAdminQueueAction(input: RecordAdminQueueActionInput): Promise<OperationsAuditEvent> {
    return this.recordEvent({
      domain: "admin-queue",
      action: input.action,
      severity: input.severity ?? "info",
      actor: input.actor,
      target: {
        targetType: "request",
        targetId: input.requestId
      },
      reference: input.reference,
      message: input.message
    });
  }

  async recordTerminalIncident(input: RecordTerminalIncidentInput): Promise<OperationsAuditEvent> {
    const severity = input.severity ?? defaultTerminalSeverity(input.action);
    return this.recordEvent({
      domain: "terminal",
      action: input.action,
      severity,
      actor: input.actor ?? systemActor("terminal-monitor"),
      target: {
        targetType: "terminal",
        targetId: (input.terminalId ?? "main-terminal").trim() || "main-terminal"
      },
      reference: input.reference,
      message: input.message
    });
  }

  async recordFinancialAnomaly(input: RecordFinancialAnomalyInput): Promise<OperationsAuditEvent> {
    return this.recordEvent({
      domain: "finance",
      action: input.action,
      severity: input.severity ?? "critical",
      actor: input.actor ?? systemActor("finance-monitor"),
      target: {
        targetType: "ledger",
        targetId: (input.targetId ?? "ledger").trim() || "ledger"
      },
      reference: input.reference,
      message: input.message
    });
  }

  async listEvents(input: { readonly limit?: number } = {}): Promise<readonly OperationsAuditEvent[]> {
    const events = await this.operationsAuditLog.listEvents();
    if (input.limit === undefined) {
      return events.map(cloneOperationsAuditEvent);
    }

    const normalizedLimit = Math.trunc(input.limit);
    if (!Number.isFinite(normalizedLimit) || normalizedLimit <= 0) {
      return [];
    }

    return events.slice(Math.max(0, events.length - normalizedLimit)).map(cloneOperationsAuditEvent);
  }

  private async recordEvent(input: {
    readonly domain: OperationsAuditEvent["domain"];
    readonly action: string;
    readonly severity: OperationsAuditSeverity;
    readonly actor: OperationsAuditActor;
    readonly target: OperationsAuditTarget;
    readonly reference: OperationsAuditReference;
    readonly message: string;
  }): Promise<OperationsAuditEvent> {
    const reference = sanitizeReference(input.reference);
    assertReferenceHasContext(reference);

    const event: OperationsAuditEvent = {
      eventId: this.eventIdFactory.nextEventId(),
      occurredAt: this.timeSource.nowIso(),
      domain: input.domain,
      action: input.action.trim(),
      severity: input.severity,
      actor: sanitizeActor(input.actor),
      target: sanitizeTarget(input.target),
      reference,
      message: input.message.trim()
    };

    if (!event.action) {
      throw new Error("operations audit action is required");
    }

    if (!event.message) {
      throw new Error("operations audit message is required");
    }

    await this.operationsAuditLog.append(event);
    return cloneOperationsAuditEvent(event);
  }
}

function sanitizeActor(actor: OperationsAuditActor): OperationsAuditActor {
  const actorId = actor.actorId.trim();
  if (!actorId) {
    throw new Error("operations audit actorId is required");
  }

  const role = actor.actorRole;
  if (role !== "admin" && role !== "system") {
    throw new Error("operations audit actorRole must be admin or system");
  }

  const actorLabel = actor.actorLabel?.trim();
  return {
    actorId,
    actorRole: role,
    ...(actorLabel ? { actorLabel } : {})
  };
}

function sanitizeTarget(target: OperationsAuditTarget): OperationsAuditTarget {
  const targetId = target.targetId.trim();
  if (!targetId) {
    throw new Error("operations audit targetId is required");
  }

  return {
    targetType: target.targetType,
    targetId
  };
}

function sanitizeReference(reference: OperationsAuditReference): OperationsAuditReference {
  const sanitized: OperationsAuditReference = {
    ...(reference.requestId?.trim() ? { requestId: reference.requestId.trim() } : {}),
    ...(reference.userId?.trim() ? { userId: reference.userId.trim() } : {}),
    ...(reference.lotteryCode?.trim() ? { lotteryCode: reference.lotteryCode.trim() } : {}),
    ...(reference.drawId?.trim() ? { drawId: reference.drawId.trim() } : {}),
    ...(reference.terminalId?.trim() ? { terminalId: reference.terminalId.trim() } : {}),
    ...(reference.ledgerEntryId?.trim() ? { ledgerEntryId: reference.ledgerEntryId.trim() } : {})
  };

  return sanitized;
}

function assertReferenceHasContext(reference: OperationsAuditReference): void {
  if (Object.keys(reference).length > 0) {
    return;
  }

  throw new Error("operations audit reference requires at least one identifier");
}

function defaultTerminalSeverity(action: RecordTerminalIncidentInput["action"]): OperationsAuditSeverity {
  if (action === "terminal_offline" || action === "terminal_execution_error") {
    return "critical";
  }

  return "warning";
}

function systemActor(actorId: string): OperationsAuditActor {
  return {
    actorId,
    actorRole: "system"
  };
}

class RandomOperationsAuditEventIdFactory implements OperationsAuditEventIdFactory {
  nextEventId(): string {
    return `ops_${Math.random().toString(36).slice(2, 14)}`;
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
