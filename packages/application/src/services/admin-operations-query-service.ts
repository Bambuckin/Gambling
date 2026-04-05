import type { RequestState } from "@lottery/domain";
import type { PurchaseQueuePriority, PurchaseQueueStore } from "../ports/purchase-queue-store.js";
import type { PurchaseRequestStore } from "../ports/purchase-request-store.js";
import type { TimeSource } from "../ports/time-source.js";
import { TerminalHealthService, type TerminalHealthSnapshot } from "./terminal-health-service.js";

export interface AdminOperationsQueryServiceDependencies {
  readonly requestStore: PurchaseRequestStore;
  readonly queueStore: PurchaseQueueStore;
  readonly timeSource: TimeSource;
  readonly staleExecutingThresholdMs?: number;
}

export interface AdminQueuePressureSnapshot {
  readonly queueDepth: number;
  readonly queuedCount: number;
  readonly executingCount: number;
  readonly adminPriorityQueuedCount: number;
  readonly regularQueuedCount: number;
}

export type AdminProblemAnomalyHint = "retrying" | "error" | "stale-executing";

export interface AdminProblemRequestView {
  readonly requestId: string;
  readonly userId: string;
  readonly lotteryCode: string;
  readonly drawId: string;
  readonly status: RequestState;
  readonly queueStatus: "queued" | "executing" | "missing";
  readonly queuePriority: PurchaseQueuePriority | null;
  readonly anomalyHint: AdminProblemAnomalyHint;
  readonly attemptCount: number;
  readonly updatedAt: string;
  readonly lastError: string | null;
}

export interface AdminOperationsSnapshot {
  readonly terminal: TerminalHealthSnapshot;
  readonly queue: AdminQueuePressureSnapshot;
  readonly problemRequests: readonly AdminProblemRequestView[];
}

export class AdminOperationsQueryService {
  private readonly requestStore: PurchaseRequestStore;
  private readonly queueStore: PurchaseQueueStore;
  private readonly timeSource: TimeSource;
  private readonly terminalHealthService: TerminalHealthService;
  private readonly staleExecutingThresholdMs: number;

  constructor(dependencies: AdminOperationsQueryServiceDependencies) {
    this.requestStore = dependencies.requestStore;
    this.queueStore = dependencies.queueStore;
    this.timeSource = dependencies.timeSource;
    this.terminalHealthService = new TerminalHealthService({
      requestStore: dependencies.requestStore,
      queueStore: dependencies.queueStore,
      timeSource: dependencies.timeSource
    });
    this.staleExecutingThresholdMs = normalizeStaleThresholdMs(dependencies.staleExecutingThresholdMs);
  }

  async getSnapshot(): Promise<AdminOperationsSnapshot> {
    const nowIso = this.timeSource.nowIso();
    const [terminal, queueItems, requests] = await Promise.all([
      this.terminalHealthService.getStateSnapshot(),
      this.queueStore.listQueueItems(),
      this.requestStore.listRequests()
    ]);

    const queueByRequestId = new Map(queueItems.map((item) => [item.requestId, item] as const));
    const queuedItems = queueItems.filter((item) => item.status === "queued");

    return {
      terminal,
      queue: {
        queueDepth: queueItems.length,
        queuedCount: queuedItems.length,
        executingCount: queueItems.filter((item) => item.status === "executing").length,
        adminPriorityQueuedCount: queuedItems.filter((item) => item.priority === "admin-priority").length,
        regularQueuedCount: queuedItems.filter((item) => item.priority === "regular").length
      },
      problemRequests: requests
        .map((record) => toProblemRequestView(record, queueByRequestId.get(record.snapshot.requestId), nowIso, this.staleExecutingThresholdMs))
        .filter((view): view is AdminProblemRequestView => view !== null)
        .sort(compareProblemRequests)
    };
  }
}

const DEFAULT_STALE_EXECUTING_THRESHOLD_MS = 5 * 60 * 1000;

function toProblemRequestView(
  record: Awaited<ReturnType<PurchaseRequestStore["listRequests"]>>[number],
  queueItem: Awaited<ReturnType<PurchaseQueueStore["listQueueItems"]>>[number] | undefined,
  nowIso: string,
  staleExecutingThresholdMs: number
): AdminProblemRequestView | null {
  const anomalyHint = resolveAnomalyHint(record, nowIso, staleExecutingThresholdMs);
  if (!anomalyHint) {
    return null;
  }

  const updatedAt = record.journal.at(-1)?.occurredAt ?? record.snapshot.createdAt;

  return {
    requestId: record.snapshot.requestId,
    userId: record.snapshot.userId,
    lotteryCode: record.snapshot.lotteryCode,
    drawId: record.snapshot.drawId,
    status: record.state,
    queueStatus: queueItem?.status ?? "missing",
    queuePriority: queueItem?.priority ?? null,
    anomalyHint,
    attemptCount: queueItem?.attemptCount ?? deriveAttemptCount(record.journal),
    updatedAt,
    lastError: resolveLastError(record.journal)
  };
}

function resolveAnomalyHint(
  record: Awaited<ReturnType<PurchaseRequestStore["listRequests"]>>[number],
  nowIso: string,
  staleExecutingThresholdMs: number
): AdminProblemAnomalyHint | null {
  if (record.state === "retrying") {
    return "retrying";
  }

  if (record.state === "error") {
    return "error";
  }

  if (record.state === "executing" && isStaleExecuting(record, nowIso, staleExecutingThresholdMs)) {
    return "stale-executing";
  }

  return null;
}

function deriveAttemptCount(
  journal: Awaited<ReturnType<PurchaseRequestStore["listRequests"]>>[number]["journal"]
): number {
  return journal.filter((entry) => entry.toState === "executing").length;
}

function resolveLastError(
  journal: Awaited<ReturnType<PurchaseRequestStore["listRequests"]>>[number]["journal"]
): string | null {
  for (const entry of [...journal].reverse()) {
    if (entry.toState === "error") {
      return entry.note ?? "request reached error state";
    }

    if (entry.note && entry.note.toLowerCase().includes("outcome=error")) {
      return entry.note;
    }
  }

  return null;
}

function isStaleExecuting(
  record: Awaited<ReturnType<PurchaseRequestStore["listRequests"]>>[number],
  nowIso: string,
  staleExecutingThresholdMs: number
): boolean {
  const updatedAt = record.journal.at(-1)?.occurredAt ?? record.snapshot.createdAt;
  const updatedTimestamp = Date.parse(updatedAt);
  const nowTimestamp = Date.parse(nowIso);

  if (!Number.isFinite(updatedTimestamp) || !Number.isFinite(nowTimestamp)) {
    return false;
  }

  return nowTimestamp - updatedTimestamp >= staleExecutingThresholdMs;
}

function normalizeStaleThresholdMs(value: number | undefined): number {
  const threshold = Math.trunc(value ?? DEFAULT_STALE_EXECUTING_THRESHOLD_MS);
  if (!Number.isFinite(threshold) || threshold <= 0) {
    return DEFAULT_STALE_EXECUTING_THRESHOLD_MS;
  }

  return threshold;
}

function compareProblemRequests(left: AdminProblemRequestView, right: AdminProblemRequestView): number {
  const updatedDiff = right.updatedAt.localeCompare(left.updatedAt);
  if (updatedDiff !== 0) {
    return updatedDiff;
  }

  return right.requestId.localeCompare(left.requestId);
}
