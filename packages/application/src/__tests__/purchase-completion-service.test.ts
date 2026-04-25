import {
  appendCanonicalPurchaseTransition,
  appendPurchaseRequestTransition,
  createAwaitingConfirmationRequest,
  createSubmittedCanonicalPurchase,
  type CanonicalPurchaseRecord,
  type LedgerEntry,
  type NotificationRecord
} from "@lottery/domain";
import { describe, expect, it } from "vitest";
import type { CanonicalPurchaseStore } from "../ports/canonical-purchase-store.js";
import type { LedgerStore } from "../ports/ledger-store.js";
import type { NotificationStore } from "../ports/notification-store.js";
import type { PurchaseRequestStore } from "../ports/purchase-request-store.js";
import type { TicketStore } from "../ports/ticket-store.js";
import type { TimeSource } from "../ports/time-source.js";
import { PurchaseCompletionService } from "../services/purchase-completion-service.js";
import { TicketPersistenceService } from "../services/ticket-persistence-service.js";
import { WalletLedgerService, type WalletLedgerEntryFactory } from "../services/wallet-ledger-service.js";

describe("PurchaseCompletionService", () => {
  it("completes added_to_cart request with emulate_after_cart mode", async () => {
    const ticketStore = new StubTicketStore();
    const requestStore = new StubPurchaseRequestStore();
    const service = createService(ticketStore, requestStore);
    const request = createAddedToCartRequest("req-800");

    const result = await service.completeAfterCartStage({
      request,
      completionMode: "emulate_after_cart",
      cartExternalReference: "cart-ref-800"
    });

    expect(result.completed).toBe(true);
    expect(result.request.state).toBe("success");
    expect(result.ticket).not.toBeNull();
    expect(result.ticket!.requestId).toBe("req-800");
    expect(result.ticket!.externalReference).toBe("cart-ref-800");
    expect(await requestStore.getRequestById("req-800")).toMatchObject({
      state: "success"
    });
  });

  it("skips when completion mode is direct", async () => {
    const ticketStore = new StubTicketStore();
    const service = createService(ticketStore);
    const request = createAddedToCartRequest("req-801");

    const result = await service.completeAfterCartStage({
      request,
      completionMode: "direct",
      cartExternalReference: null
    });

    expect(result.completed).toBe(false);
    expect(result.request.state).toBe("added_to_cart");
    expect(result.ticket).toBeNull();
  });

  it("skips when request is not in added_to_cart state", async () => {
    const ticketStore = new StubTicketStore();
    const service = createService(ticketStore);
    const request = createExecutingRequest("req-802");

    const result = await service.completeAfterCartStage({
      request,
      completionMode: "emulate_after_cart",
      cartExternalReference: null
    });

    expect(result.completed).toBe(false);
    expect(result.request.state).toBe("executing");
  });

  it("preserves provided cart external reference", async () => {
    const ticketStore = new StubTicketStore();
    const service = createService(ticketStore);
    const request = createAddedToCartRequest("req-803");

    const result = await service.completeAfterCartStage({
      request,
      completionMode: "emulate_after_cart",
      cartExternalReference: "original-cart-ref"
    });

    expect(result.completed).toBe(true);
    expect(result.ticket!.externalReference).toBe("original-cart-ref");
  });

  it("advances canonical purchase to awaiting_draw_close during cart-stage completion", async () => {
    const ticketStore = new StubTicketStore();
    const requestStore = new StubPurchaseRequestStore();
    const canonicalPurchaseStore = new StubCanonicalPurchaseStore([
      createCanonicalPurchasedPurchase("req-804")
    ]);
    const service = createService(ticketStore, requestStore, canonicalPurchaseStore);
    const request = createAddedToCartRequest("req-804");

    await service.completeAfterCartStage({
      request,
      completionMode: "emulate_after_cart",
      cartExternalReference: null
    });

    await expect(canonicalPurchaseStore.getPurchaseByLegacyRequestId("req-804")).resolves.toMatchObject({
      status: "awaiting_draw_close"
    });
  });

  it("debits reserved funds when cart-stage completion persists the purchased ticket", async () => {
    const ticketStore = new StubTicketStore();
    const requestStore = new StubPurchaseRequestStore();
    const walletLedgerService = createWalletLedgerService();
    await walletLedgerService.recordEntry({
      userId: "seed-user",
      operation: "credit",
      amountMinor: 100_000,
      currency: "RUB",
      idempotencyKey: "seed-user-credit",
      reference: {
        requestId: "seed-user-credit"
      },
      createdAt: "2026-04-16T11:50:00.000Z"
    });
    await walletLedgerService.reserveFunds({
      userId: "seed-user",
      requestId: "req-805",
      amountMinor: 25_000,
      currency: "RUB",
      idempotencyKey: "req-805:reserve",
      createdAt: "2026-04-16T11:55:00.000Z"
    });
    const service = createService(ticketStore, requestStore, undefined, walletLedgerService);
    const request = createAddedToCartRequest("req-805");

    const result = await service.completeAfterCartStage({
      request,
      completionMode: "emulate_after_cart",
      cartExternalReference: "cart-ref-805"
    });

    expect(result.completed).toBe(true);
    await expect(walletLedgerService.getWalletSnapshot("seed-user", "RUB")).resolves.toEqual({
      userId: "seed-user",
      availableMinor: 75_000,
      reservedMinor: 0,
      currency: "RUB"
    });
    expect((await walletLedgerService.listEntries("seed-user")).map((entry) => entry.idempotencyKey)).toEqual([
      "seed-user-credit",
      "req-805:reserve",
      "req-805:purchase-debit"
    ]);
  });
});

function createService(
  ticketStore: StubTicketStore,
  requestStore: PurchaseRequestStore = new StubPurchaseRequestStore(),
  canonicalPurchaseStore?: CanonicalPurchaseStore,
  walletLedgerService?: Pick<WalletLedgerService, "debitReservedFunds">
): PurchaseCompletionService {
  return new PurchaseCompletionService({
    requestStore,
    ...(canonicalPurchaseStore ? { canonicalPurchaseStore } : {}),
    ...(walletLedgerService ? { walletLedgerService } : {}),
    ticketPersistenceService: new TicketPersistenceService({
      ticketStore,
      notificationStore: new StubNotificationStore()
    }),
    timeSource: new StubTimeSource()
  });
}

function createWalletLedgerService(): WalletLedgerService {
  return new WalletLedgerService({
    ledgerStore: new StubLedgerStore(),
    timeSource: new StubTimeSource(),
    entryFactory: new SequentialLedgerEntryFactory()
  });
}

class StubNotificationStore implements NotificationStore {
  private notifications: NotificationRecord[] = [];

  async saveNotification(notification: NotificationRecord): Promise<void> {
    this.notifications.push({ ...notification });
  }

  async listUserNotifications(): Promise<readonly NotificationRecord[]> {
    return this.notifications;
  }

  async getNotificationById(): Promise<NotificationRecord | null> {
    return null;
  }

  async markNotificationRead(): Promise<void> {}
  async clearAll(): Promise<void> {}
}

class StubTimeSource implements TimeSource {
  nowIso(): string {
    return "2026-04-16T12:00:00.000Z";
  }
}

class StubTicketStore implements TicketStore {
  private tickets: Map<string, import("@lottery/domain").TicketRecord> = new Map();

  async listTickets() {
    return [...this.tickets.values()];
  }

  async getTicketById(ticketId: string) {
    return this.tickets.get(ticketId) ?? null;
  }

  async getTicketByRequestId(requestId: string) {
    for (const ticket of this.tickets.values()) {
      if (ticket.requestId === requestId) return ticket;
    }
    return null;
  }

  async saveTicket(ticket: import("@lottery/domain").TicketRecord) {
    this.tickets.set(ticket.ticketId, { ...ticket });
  }

  async clearAll(): Promise<void> {}
}

class StubPurchaseRequestStore implements PurchaseRequestStore {
  private requests: Map<string, import("@lottery/domain").PurchaseRequestRecord> = new Map();

  async listRequests() {
    return [...this.requests.values()].map(cloneRequestRecord);
  }

  async getRequestById(requestId: string) {
    const request = this.requests.get(requestId) ?? null;
    return request ? cloneRequestRecord(request) : null;
  }

  async saveRequest(record: import("@lottery/domain").PurchaseRequestRecord) {
    this.requests.set(record.snapshot.requestId, cloneRequestRecord(record));
  }

  async clearAll(): Promise<void> {}
}

class StubCanonicalPurchaseStore implements CanonicalPurchaseStore {
  private purchases: CanonicalPurchaseRecord[];

  constructor(initialPurchases: readonly CanonicalPurchaseRecord[] = []) {
    this.purchases = initialPurchases.map(cloneCanonicalPurchaseRecord);
  }

  async listPurchases() {
    return this.purchases.map(cloneCanonicalPurchaseRecord);
  }

  async getPurchaseById(purchaseId: string) {
    const purchase = this.purchases.find((entry) => entry.snapshot.purchaseId === purchaseId) ?? null;
    return purchase ? cloneCanonicalPurchaseRecord(purchase) : null;
  }

  async getPurchaseByLegacyRequestId(legacyRequestId: string) {
    const purchase = this.purchases.find((entry) => entry.snapshot.legacyRequestId === legacyRequestId) ?? null;
    return purchase ? cloneCanonicalPurchaseRecord(purchase) : null;
  }

  async savePurchase(record: CanonicalPurchaseRecord) {
    const filtered = this.purchases.filter((entry) => entry.snapshot.purchaseId !== record.snapshot.purchaseId);
    this.purchases = [...filtered, cloneCanonicalPurchaseRecord(record)];
  }

  async clearAll(): Promise<void> {}
}

class StubLedgerStore implements LedgerStore {
  private entries: LedgerEntry[] = [];

  async listEntries(): Promise<readonly LedgerEntry[]> {
    return this.entries.map(cloneLedgerEntry);
  }

  async listEntriesByUser(userId: string): Promise<readonly LedgerEntry[]> {
    return this.entries.filter((entry) => entry.userId === userId).map(cloneLedgerEntry);
  }

  async appendEntry(entry: LedgerEntry): Promise<void> {
    this.entries = [...this.entries, cloneLedgerEntry(entry)];
  }

  async clearAll(): Promise<void> {
    this.entries = [];
  }
}

class SequentialLedgerEntryFactory implements WalletLedgerEntryFactory {
  private index = 0;

  nextEntryId(): string {
    this.index += 1;
    return `ledger-${this.index}`;
  }
}

function createAddedToCartRequest(requestId: string) {
  const executing = createExecutingRequest(requestId);
  return appendPurchaseRequestTransition(executing, "added_to_cart", {
    eventId: `${requestId}:added_to_cart`,
    occurredAt: "2026-04-16T11:59:00.000Z",
    note: "terminal_attempt attempt=1 outcome=added_to_cart"
  });
}

function createExecutingRequest(requestId: string) {
  const awaiting = createAwaitingConfirmationRequest({
    requestId,
    userId: "seed-user",
    lotteryCode: "bolshaya-8",
    drawId: "draw-800",
    payload: { draw_count: 1 },
    costMinor: 25_000,
    currency: "RUB",
    createdAt: "2026-04-16T11:55:00.000Z"
  });
  const confirmed = appendPurchaseRequestTransition(awaiting, "confirmed", {
    eventId: `${requestId}:confirmed`,
    occurredAt: "2026-04-16T11:55:30.000Z"
  });
  const queued = appendPurchaseRequestTransition(confirmed, "queued", {
    eventId: `${requestId}:queued`,
    occurredAt: "2026-04-16T11:56:00.000Z"
  });
  return appendPurchaseRequestTransition(queued, "executing", {
    eventId: `${requestId}:executing`,
    occurredAt: "2026-04-16T11:57:00.000Z"
  });
}

function cloneRequestRecord(record: import("@lottery/domain").PurchaseRequestRecord) {
  return {
    snapshot: {
      ...record.snapshot,
      payload: { ...record.snapshot.payload }
    },
    state: record.state,
    journal: record.journal.map((entry) => ({ ...entry }))
  };
}

function cloneCanonicalPurchaseRecord(record: CanonicalPurchaseRecord): CanonicalPurchaseRecord {
  return {
    snapshot: {
      ...record.snapshot,
      payload: { ...record.snapshot.payload }
    },
    status: record.status,
    resultStatus: record.resultStatus,
    resultVisibility: record.resultVisibility,
    purchasedAt: record.purchasedAt,
    settledAt: record.settledAt,
    externalTicketReference: record.externalTicketReference,
    journal: record.journal.map((entry) => ({ ...entry }))
  };
}

function cloneLedgerEntry(entry: LedgerEntry): LedgerEntry {
  return {
    ...entry,
    reference: { ...entry.reference }
  };
}

function createCanonicalPurchasedPurchase(requestId: string): CanonicalPurchaseRecord {
  return appendCanonicalPurchaseTransition(
    appendCanonicalPurchaseTransition(
      appendCanonicalPurchaseTransition(
        createSubmittedCanonicalPurchase({
          purchaseId: requestId,
          legacyRequestId: requestId,
          userId: "seed-user",
          lotteryCode: "bolshaya-8",
          drawId: "draw-800",
          payload: { draw_count: 1 },
          costMinor: 25_000,
          currency: "RUB",
          submittedAt: "2026-04-16T11:55:00.000Z"
        }),
        "queued",
        {
          eventId: `${requestId}:queued`,
          occurredAt: "2026-04-16T11:56:00.000Z"
        }
      ),
      "processing",
      {
        eventId: `${requestId}:processing`,
        occurredAt: "2026-04-16T11:57:00.000Z"
      }
    ),
    "purchased",
    {
      eventId: `${requestId}:purchased`,
      occurredAt: "2026-04-16T11:59:30.000Z",
      externalTicketReference: `cart-ref-${requestId.split("-").at(-1) ?? requestId}`
    }
  );
}
