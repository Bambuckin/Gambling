export type OperationsAuditSeverity = "info" | "warning" | "critical";

export interface OperationsAuditActor {
  readonly actorId: string;
  readonly actorRole: "admin" | "system";
  readonly actorLabel?: string;
}

export interface OperationsAuditTarget {
  readonly targetType: "request" | "queue" | "terminal" | "ledger";
  readonly targetId: string;
}

export interface OperationsAuditReference {
  readonly requestId?: string;
  readonly userId?: string;
  readonly lotteryCode?: string;
  readonly drawId?: string;
  readonly terminalId?: string;
  readonly ledgerEntryId?: string;
}

export interface OperationsAuditEvent {
  readonly eventId: string;
  readonly occurredAt: string;
  readonly domain: "admin-queue" | "terminal" | "finance";
  readonly action: string;
  readonly severity: OperationsAuditSeverity;
  readonly actor: OperationsAuditActor;
  readonly target: OperationsAuditTarget;
  readonly reference: OperationsAuditReference;
  readonly message: string;
}

export interface OperationsAuditLog {
  append(event: OperationsAuditEvent): Promise<void>;
  listEvents(): Promise<readonly OperationsAuditEvent[]>;
}
