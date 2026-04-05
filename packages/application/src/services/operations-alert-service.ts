import type { OperationsAuditLog } from "../ports/operations-audit-log.js";
import type { TimeSource } from "../ports/time-source.js";
import type { AdminOperationsQueryService, AdminProblemRequestView } from "./admin-operations-query-service.js";

export type OperationsAlertSeverity = "warning" | "critical";

export interface OperationsAlert {
  readonly alertId: string;
  readonly severity: OperationsAlertSeverity;
  readonly category: "terminal" | "queue" | "finance";
  readonly title: string;
  readonly description: string;
  readonly referenceIds: readonly string[];
  readonly detectedAt: string;
}

export interface OperationsAlertServiceDependencies {
  readonly adminOperationsQueryService: Pick<AdminOperationsQueryService, "getSnapshot">;
  readonly operationsAuditLog: OperationsAuditLog;
  readonly timeSource: TimeSource;
}

export class OperationsAlertService {
  private readonly adminOperationsQueryService: Pick<AdminOperationsQueryService, "getSnapshot">;
  private readonly operationsAuditLog: OperationsAuditLog;
  private readonly timeSource: TimeSource;

  constructor(dependencies: OperationsAlertServiceDependencies) {
    this.adminOperationsQueryService = dependencies.adminOperationsQueryService;
    this.operationsAuditLog = dependencies.operationsAuditLog;
    this.timeSource = dependencies.timeSource;
  }

  async listActiveAlerts(): Promise<readonly OperationsAlert[]> {
    const detectedAt = this.timeSource.nowIso();
    const [snapshot, auditEvents] = await Promise.all([
      this.adminOperationsQueryService.getSnapshot(),
      this.operationsAuditLog.listEvents()
    ]);

    const alerts: OperationsAlert[] = [];

    const terminalAlert = buildTerminalAlert(snapshot.terminal, detectedAt);
    if (terminalAlert) {
      alerts.push(terminalAlert);
    }

    const queueAlerts = buildQueueAlerts(snapshot.problemRequests, detectedAt);
    alerts.push(...queueAlerts);

    const financialAlert = buildFinancialAlert(auditEvents, detectedAt);
    if (financialAlert) {
      alerts.push(financialAlert);
    }

    return alerts.sort(compareAlerts).map(cloneAlert);
  }
}

function buildTerminalAlert(
  terminal: Awaited<ReturnType<AdminOperationsQueryService["getSnapshot"]>>["terminal"],
  detectedAt: string
): OperationsAlert | null {
  if (terminal.state === "offline") {
    return {
      alertId: "terminal-offline",
      severity: "critical",
      category: "terminal",
      title: "Terminal is offline",
      description: `Consecutive failures: ${terminal.consecutiveFailures}. Last error at ${terminal.lastErrorAt ?? "unknown"}.`,
      referenceIds: compactReferences([terminal.activeRequestId]),
      detectedAt
    };
  }

  if (terminal.state === "degraded") {
    return {
      alertId: "terminal-degraded",
      severity: "warning",
      category: "terminal",
      title: "Terminal is degraded",
      description: `Consecutive failures: ${terminal.consecutiveFailures}. Active request: ${terminal.activeRequestId ?? "none"}.`,
      referenceIds: compactReferences([terminal.activeRequestId]),
      detectedAt
    };
  }

  return null;
}

function buildQueueAlerts(
  problemRequests: readonly AdminProblemRequestView[],
  detectedAt: string
): OperationsAlert[] {
  const alerts: OperationsAlert[] = [];

  const errorRequests = problemRequests.filter((request) => request.anomalyHint === "error");
  if (errorRequests.length > 0) {
    alerts.push({
      alertId: "queue-errors",
      severity: "critical",
      category: "queue",
      title: "Requests stuck in error state",
      description: `${errorRequests.length} request(s) require operator triage.`,
      referenceIds: errorRequests.map((request) => request.requestId).slice(0, 5),
      detectedAt
    });
  }

  const staleExecutingRequests = problemRequests.filter((request) => request.anomalyHint === "stale-executing");
  if (staleExecutingRequests.length > 0) {
    alerts.push({
      alertId: "queue-stale-executing",
      severity: "critical",
      category: "queue",
      title: "Stale terminal execution detected",
      description: `${staleExecutingRequests.length} request(s) stayed in executing state beyond threshold.`,
      referenceIds: staleExecutingRequests.map((request) => request.requestId).slice(0, 5),
      detectedAt
    });
  }

  const retryingRequests = problemRequests.filter((request) => request.anomalyHint === "retrying");
  if (retryingRequests.length >= 2) {
    alerts.push({
      alertId: "queue-retrying",
      severity: "warning",
      category: "queue",
      title: "Multiple requests are retrying",
      description: `${retryingRequests.length} request(s) are in retrying state.`,
      referenceIds: retryingRequests.map((request) => request.requestId).slice(0, 5),
      detectedAt
    });
  }

  return alerts;
}

function buildFinancialAlert(
  events: Awaited<ReturnType<OperationsAuditLog["listEvents"]>>,
  detectedAt: string
): OperationsAlert | null {
  const criticalFinancialEvents = events.filter((event) => event.domain === "finance" && event.severity === "critical");
  if (criticalFinancialEvents.length === 0) {
    return null;
  }

  const references = criticalFinancialEvents.flatMap((event) => [
    event.reference.ledgerEntryId,
    event.reference.requestId
  ]);

  return {
    alertId: "finance-anomaly",
    severity: "critical",
    category: "finance",
    title: "Financial anomaly markers detected",
    description: `${criticalFinancialEvents.length} critical finance audit event(s) require investigation.`,
    referenceIds: compactReferences(references),
    detectedAt
  };
}

function compareAlerts(left: OperationsAlert, right: OperationsAlert): number {
  const severityDiff = rankSeverity(right.severity) - rankSeverity(left.severity);
  if (severityDiff !== 0) {
    return severityDiff;
  }

  return left.alertId.localeCompare(right.alertId);
}

function rankSeverity(severity: OperationsAlertSeverity): number {
  if (severity === "critical") {
    return 2;
  }

  return 1;
}

function compactReferences(references: readonly (string | null | undefined)[]): readonly string[] {
  const unique = new Set<string>();
  for (const reference of references) {
    const normalized = reference?.trim();
    if (normalized) {
      unique.add(normalized);
    }
  }

  return [...unique].slice(0, 5);
}

function cloneAlert(alert: OperationsAlert): OperationsAlert {
  return {
    ...alert,
    referenceIds: [...alert.referenceIds]
  };
}
