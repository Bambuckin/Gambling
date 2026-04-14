import { randomUUID } from "node:crypto";
import {
  arePurchaseDraftPayloadsEqual,
  type PurchaseDraftPayload,
  type PurchaseRequestRecord,
  createAwaitingConfirmationRequest
} from "@lottery/domain";
import type { TimeSource } from "../ports/time-source.js";
import type { PurchaseRequestStore } from "../ports/purchase-request-store.js";

export interface PurchaseRequestServiceDependencies {
  readonly requestStore: PurchaseRequestStore;
  readonly timeSource: TimeSource;
  readonly requestIdFactory?: PurchaseRequestIdFactory;
}

export interface PurchaseRequestIdFactory {
  nextRequestId(): string;
}

export interface CreateAwaitingConfirmationInput {
  readonly requestId?: string;
  readonly userId: string;
  readonly lotteryCode: string;
  readonly drawId: string;
  readonly payload: PurchaseDraftPayload;
  readonly costMinor: number;
  readonly currency: string;
}

export interface CreateAwaitingConfirmationResult {
  readonly request: PurchaseRequestRecord;
  readonly replayed: boolean;
}

export type PurchaseRequestServiceErrorCode = "request_conflict";

export class PurchaseRequestServiceError extends Error {
  readonly code: PurchaseRequestServiceErrorCode;

  constructor(
    message: string,
    options: {
      readonly code: PurchaseRequestServiceErrorCode;
    }
  ) {
    super(message);
    this.name = "PurchaseRequestServiceError";
    this.code = options.code;
  }
}

export class PurchaseRequestService {
  private readonly requestStore: PurchaseRequestStore;
  private readonly timeSource: TimeSource;
  private readonly requestIdFactory: PurchaseRequestIdFactory;

  constructor(dependencies: PurchaseRequestServiceDependencies) {
    this.requestStore = dependencies.requestStore;
    this.timeSource = dependencies.timeSource;
    this.requestIdFactory = dependencies.requestIdFactory ?? {
      nextRequestId() {
        return `req-${randomUUID()}`;
      }
    };
  }

  async createAwaitingConfirmation(
    input: CreateAwaitingConfirmationInput
  ): Promise<CreateAwaitingConfirmationResult> {
    const requestId = (input.requestId ?? this.requestIdFactory.nextRequestId()).trim();
    const existing = await this.requestStore.getRequestById(requestId);
    if (existing) {
      if (!matchesSnapshot(existing, input)) {
        throw new PurchaseRequestServiceError(`requestId "${requestId}" already exists with different payload`, {
          code: "request_conflict"
        });
      }

      return {
        request: existing,
        replayed: true
      };
    }

    const request = createAwaitingConfirmationRequest({
      requestId,
      userId: input.userId,
      lotteryCode: input.lotteryCode,
      drawId: input.drawId,
      payload: input.payload,
      costMinor: input.costMinor,
      currency: input.currency,
      createdAt: this.timeSource.nowIso()
    });

    await this.requestStore.saveRequest(request);
    return {
      request,
      replayed: false
    };
  }

  async listByUser(userId: string): Promise<PurchaseRequestRecord[]> {
    const normalizedUserId = userId.trim();
    const records = await this.requestStore.listRequests();
    return records.filter((record) => record.snapshot.userId === normalizedUserId);
  }
}

function matchesSnapshot(existing: PurchaseRequestRecord, input: CreateAwaitingConfirmationInput): boolean {
  const snapshot = existing.snapshot;
  return (
    snapshot.userId === input.userId.trim() &&
    snapshot.lotteryCode === input.lotteryCode.trim().toLowerCase() &&
    snapshot.drawId === input.drawId.trim() &&
    snapshot.costMinor === Math.trunc(input.costMinor) &&
    snapshot.currency === input.currency.trim().toUpperCase() &&
    arePayloadsEqual(snapshot.payload, input.payload)
  );
}

function arePayloadsEqual(left: PurchaseDraftPayload, right: PurchaseDraftPayload): boolean {
  return arePurchaseDraftPayloadsEqual(left, right);
}
