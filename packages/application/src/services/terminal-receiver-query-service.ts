import type {
  CanonicalPurchaseRecord,
  PurchaseAttemptRecord,
  PurchaseDraftPayload,
  PurchaseRequestRecord,
  RequestState
} from "@lottery/domain";
import type { CanonicalPurchaseStore } from "../ports/canonical-purchase-store.js";
import type { PurchaseAttemptStore } from "../ports/purchase-attempt-store.js";
import type { PurchaseQueueStore } from "../ports/purchase-queue-store.js";
import type { PurchaseRequestStore } from "../ports/purchase-request-store.js";
import { buildCanonicalAttemptMap } from "./canonical-compatibility.js";

export interface TerminalReceiverQueryServiceDependencies {
  readonly requestStore: PurchaseRequestStore;
  readonly queueStore: PurchaseQueueStore;
  readonly canonicalPurchaseStore?: CanonicalPurchaseStore;
  readonly purchaseAttemptStore?: PurchaseAttemptStore;
}

export interface TerminalReceiverQueryInput {
  readonly limit?: number;
  readonly lotteryCode?: string;
}

export type TerminalReceiverState =
  | "awaiting_confirmation"
  | "confirmed"
  | "queued"
  | "executing"
  | "added_to_cart"
  | "success"
  | "completed"
  | "retrying"
  | "error"
  | "canceled"
  | "reserve_released";

export interface TerminalReceiverRow {
  readonly requestId: string;
  readonly purchaseId: string | null;
  readonly userId: string;
  readonly lotteryCode: string;
  readonly drawId: string;
  readonly state: TerminalReceiverState;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly reservedAt: string | null;
  readonly attemptCount: number;
  readonly payload: PurchaseDraftPayload | null;
  readonly workerRawOutput: string | null;
}

const DEFAULT_LIMIT = 40;

export class TerminalReceiverQueryService {
  private readonly requestStore: PurchaseRequestStore;
  private readonly queueStore: PurchaseQueueStore;
  private readonly canonicalPurchaseStore: CanonicalPurchaseStore | null;
  private readonly purchaseAttemptStore: PurchaseAttemptStore | null;

  constructor(dependencies: TerminalReceiverQueryServiceDependencies) {
    this.requestStore = dependencies.requestStore;
    this.queueStore = dependencies.queueStore;
    this.canonicalPurchaseStore = dependencies.canonicalPurchaseStore ?? null;
    this.purchaseAttemptStore = dependencies.purchaseAttemptStore ?? null;
  }

  async listRows(input: TerminalReceiverQueryInput = {}): Promise<readonly TerminalReceiverRow[]> {
    const normalizedLimit = Number.isFinite(input.limit) ? Math.max(1, Math.trunc(input.limit!)) : DEFAULT_LIMIT;
    const normalizedLotteryCode = input.lotteryCode?.trim().toLowerCase() ?? null;

    const [queueItems, requests, canonicalPurchases] = await Promise.all([
      this.queueStore.listQueueItems(),
      this.requestStore.listRequests(),
      this.canonicalPurchaseStore?.listPurchases() ?? Promise.resolve([])
    ]);

    const filteredRequests = normalizedLotteryCode
      ? requests.filter((record) => record.snapshot.lotteryCode === normalizedLotteryCode)
      : requests;
    const filteredCanonicalPurchases = normalizedLotteryCode
      ? canonicalPurchases.filter((purchase) => purchase.snapshot.lotteryCode === normalizedLotteryCode)
      : canonicalPurchases;

    const attemptsByPurchaseId = buildCanonicalAttemptMap(await this.listCanonicalAttempts(filteredCanonicalPurchases));
    const queueByRequestId = new Map(queueItems.map((item) => [item.requestId, item] as const));
    const requestById = new Map(filteredRequests.map((record) => [record.snapshot.requestId, record] as const));
    const coveredRequestIds = new Set<string>();

    return filteredCanonicalPurchases
      .map((purchase) => {
        const requestId = purchase.snapshot.legacyRequestId ?? purchase.snapshot.purchaseId;
        coveredRequestIds.add(requestId);
        return toCanonicalReceiverRow({
          purchase,
          attempts: attemptsByPurchaseId.get(purchase.snapshot.purchaseId) ?? [],
          queueItem: queueByRequestId.get(requestId),
          legacyRecord: requestById.get(requestId)
        });
      })
      .concat(
        filteredRequests
          .filter((record) => !coveredRequestIds.has(record.snapshot.requestId))
          .map((record) =>
            toLegacyReceiverRow({
              record,
              queueItem: queueByRequestId.get(record.snapshot.requestId)
            })
          )
      )
      .filter((row) => shouldIncludeReceiverRow(row.state))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, normalizedLimit);
  }

  private async listCanonicalAttempts(
    purchases: readonly CanonicalPurchaseRecord[]
  ): Promise<readonly PurchaseAttemptRecord[]> {
    if (!this.purchaseAttemptStore || purchases.length === 0) {
      return [];
    }

    const attempts = await Promise.all(
      purchases.map((purchase) => this.purchaseAttemptStore!.listAttemptsByPurchaseId(purchase.snapshot.purchaseId))
    );

    return attempts.flat();
  }
}

function toCanonicalReceiverRow(input: {
  readonly purchase: CanonicalPurchaseRecord;
  readonly attempts: readonly PurchaseAttemptRecord[];
  readonly queueItem: Awaited<ReturnType<PurchaseQueueStore["listQueueItems"]>>[number] | undefined;
  readonly legacyRecord: PurchaseRequestRecord | undefined;
}): TerminalReceiverRow {
  const requestId = input.purchase.snapshot.legacyRequestId ?? input.purchase.snapshot.purchaseId;
  const state = resolveCanonicalReceiverState(input.purchase.status);
  const latestAttempt = input.attempts.at(-1);
  const legacyAttemptCount = input.legacyRecord ? countLegacyAttempts(input.legacyRecord) : 0;
  const updatedAt =
    state === "success" || state === "completed"
      ? latestAttempt?.finishedAt ??
        input.purchase.journal.at(-1)?.occurredAt ??
        input.purchase.snapshot.submittedAt
      : input.purchase.journal.at(-1)?.occurredAt ??
        latestAttempt?.finishedAt ??
        input.purchase.snapshot.submittedAt;

  return {
    requestId,
    purchaseId: input.purchase.snapshot.purchaseId,
    userId: input.purchase.snapshot.userId,
    lotteryCode: input.purchase.snapshot.lotteryCode,
    drawId: input.purchase.snapshot.drawId,
    state,
    createdAt: input.purchase.snapshot.submittedAt,
    updatedAt,
    reservedAt: resolveCanonicalReservedAt(input.purchase, input.legacyRecord),
    attemptCount: Math.max(input.attempts.length, input.queueItem?.attemptCount ?? 0, legacyAttemptCount),
    payload: { ...input.purchase.snapshot.payload },
    workerRawOutput: latestAttempt?.rawOutput ?? extractLegacyRawOutput(input.legacyRecord)
  };
}

function toLegacyReceiverRow(input: {
  readonly record: PurchaseRequestRecord;
  readonly queueItem: Awaited<ReturnType<PurchaseQueueStore["listQueueItems"]>>[number] | undefined;
}): TerminalReceiverRow {
  const latestEntry = input.record.journal.at(-1);

  return {
    requestId: input.record.snapshot.requestId,
    purchaseId: null,
    userId: input.record.snapshot.userId,
    lotteryCode: input.record.snapshot.lotteryCode,
    drawId: input.record.snapshot.drawId,
    state: resolveLegacyReceiverState(input.record.state),
    createdAt: input.record.snapshot.createdAt,
    updatedAt: latestEntry?.occurredAt ?? input.record.snapshot.createdAt,
    reservedAt: resolveLegacyReservedAt(input.record),
    attemptCount: Math.max(countLegacyAttempts(input.record), input.queueItem?.attemptCount ?? 0),
    payload: { ...input.record.snapshot.payload },
    workerRawOutput: extractLegacyRawOutput(input.record)
  };
}

function resolveCanonicalReceiverState(
  status: CanonicalPurchaseRecord["status"]
): TerminalReceiverState {
  switch (status) {
    case "submitted":
      return "confirmed";
    case "queued":
      return "queued";
    case "processing":
      return "executing";
    case "purchase_failed_retryable":
      return "retrying";
    case "purchase_failed_final":
      return "error";
    case "purchased":
      return "success";
    case "awaiting_draw_close":
    case "settled":
      return "completed";
    case "canceled":
      return "canceled";
  }
}

function resolveLegacyReceiverState(state: RequestState): TerminalReceiverState {
  switch (state) {
    case "success":
    case "queued":
    case "executing":
    case "added_to_cart":
    case "retrying":
    case "error":
    case "confirmed":
    case "awaiting_confirmation":
    case "canceled":
    case "reserve_released":
      return state;
  }

  throw new Error(`unsupported receiver request state "${String(state)}"`);
}

function resolveCanonicalReservedAt(
  purchase: CanonicalPurchaseRecord,
  legacyRecord: PurchaseRequestRecord | undefined
): string | null {
  const processingEntry = purchase.journal.find((entry) => entry.kind === "status" && entry.nextValue === "processing");
  if (processingEntry) {
    return processingEntry.occurredAt;
  }

  return legacyRecord ? resolveLegacyReservedAt(legacyRecord) : null;
}

function resolveLegacyReservedAt(record: PurchaseRequestRecord): string | null {
  const reservedEntry =
    record.journal.find((entry) => entry.toState === "executing" && (entry.note ?? "").includes("terminal execution reserved")) ??
    record.journal.find((entry) => entry.toState === "executing");

  return reservedEntry?.occurredAt ?? null;
}

function countLegacyAttempts(record: PurchaseRequestRecord): number {
  return record.journal.filter((entry) => (entry.note ?? "").includes("terminal_attempt")).length;
}

function extractLegacyRawOutput(record: PurchaseRequestRecord | undefined): string | null {
  if (!record) {
    return null;
  }

  const latestAttemptEntry = [...record.journal]
    .reverse()
    .find((entry) => (entry.note ?? "").includes("terminal_attempt"));

  if (!latestAttemptEntry) {
    return null;
  }

  const note = latestAttemptEntry.note ?? "";
  const marker = "rawOutput=";
  const position = note.indexOf(marker);
  if (position < 0) {
    return null;
  }

  const value = note.slice(position + marker.length).trim();
  return value.length > 0 ? value : null;
}

function shouldIncludeReceiverRow(state: TerminalReceiverState): boolean {
  return (
    state !== "awaiting_confirmation" &&
    state !== "confirmed" &&
    state !== "canceled" &&
    state !== "reserve_released"
  );
}
