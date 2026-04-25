import { describe, expect, it } from "vitest";
import type {
  CanonicalPurchaseRecord,
  LedgerEntry,
  NotificationRecord,
  PurchaseAttemptRecord,
  PurchaseRequestRecord,
  TicketRecord
} from "@lottery/domain";
import {
  appendCanonicalPurchaseTransition,
  appendPurchaseRequestTransition,
  createAwaitingConfirmationRequest,
  createPurchasedTicketRecord,
  createSubmittedCanonicalPurchase
} from "@lottery/domain";
import type { CanonicalPurchaseStore } from "../ports/canonical-purchase-store.js";
import type { PurchaseAttemptStore } from "../ports/purchase-attempt-store.js";
import type { NotificationStore } from "../ports/notification-store.js";
import type { PurchaseQueueItem, PurchaseQueueStore } from "../ports/purchase-queue-store.js";
import type { PurchaseRequestStore } from "../ports/purchase-request-store.js";
import type { TicketStore } from "../ports/ticket-store.js";
import type { LedgerStore } from "../ports/ledger-store.js";
import type { TerminalExecutionResult } from "../ports/terminal-executor.js";
import type { TimeSource } from "../ports/time-source.js";
import { TicketPersistenceService } from "../services/ticket-persistence-service.js";
import {
  TerminalExecutionAttemptService,
  TerminalExecutionAttemptServiceError
} from "../services/terminal-execution-attempt-service.js";
import { type WalletLedgerEntryFactory, WalletLedgerService } from "../services/wallet-ledger-service.js";

describe("TerminalExecutionAttemptService", () => {
  it("records successful attempt, moves request to success, and removes queue item", async () => {
    const requestStore = new InMemoryPurchaseRequestStore([createExecutingRequest("req-801")]);
    const queueStore = new InMemoryPurchaseQueueStore([
      queueItem({
        requestId: "req-801",
        status: "executing",
        attemptCount: 1
      })
    ]);
    const ticketStore = new InMemoryTicketStore();
    const notificationStore = new StubNotificationStore();
    const ticketPersistenceService = new TicketPersistenceService({
      ticketStore,
      notificationStore
    });
    const service = new TerminalExecutionAttemptService({
      requestStore,
      queueStore,
      ticketPersistenceService
    });

    const result = await service.recordAttemptResult({
      requestId: "req-801",
      attempt: 1,
      startedAt: "2026-04-05T22:10:00.000Z",
      result: terminalResult({
        requestId: "req-801",
        nextState: "success",
        rawOutput: "[terminal] success",
        externalTicketReference: "demo-ext-801"
      })
    });

    expect(result.request.state).toBe("success");
    expect(result.queueItem).toBeNull();
    expect(result.ticket).not.toBeNull();
    expect(result.ticket?.requestId).toBe("req-801");
    expect(result.ticket?.externalReference).toBe("demo-ext-801");
    expect(result.journalNote).toContain("outcome=success");
    expect(await queueStore.getQueueItemByRequestId("req-801")).toBeNull();
    expect((await ticketStore.listTickets()).length).toBe(1);
  });

  it("debits reserved funds when purchase succeeds", async () => {
    const requestStore = new InMemoryPurchaseRequestStore([createExecutingRequest("req-801-ledger")]);
    const queueStore = new InMemoryPurchaseQueueStore([
      queueItem({
        requestId: "req-801-ledger",
        status: "executing",
        attemptCount: 1
      })
    ]);
    const walletLedgerService = createWalletLedgerService();
    await seedReservedFundsForRequest(walletLedgerService, "req-801-ledger");
    const ticketStore = new InMemoryTicketStore();
    const notificationStore = new StubNotificationStore();
    const ticketPersistenceService = new TicketPersistenceService({
      ticketStore,
      notificationStore
    });
    const service = new TerminalExecutionAttemptService({
      requestStore,
      queueStore,
      ticketPersistenceService,
      walletLedgerService
    });

    await service.recordAttemptResult({
      requestId: "req-801-ledger",
      attempt: 1,
      startedAt: "2026-04-05T22:10:00.000Z",
      result: terminalResult({
        requestId: "req-801-ledger",
        nextState: "success",
        rawOutput: "[terminal] success",
        externalTicketReference: "demo-ext-801-ledger"
      })
    });

    expect(await walletLedgerService.getWalletSnapshot("seed-user", "RUB")).toEqual({
      userId: "seed-user",
      availableMinor: 910,
      reservedMinor: 0,
      currency: "RUB"
    });
    expect((await walletLedgerService.listEntries("seed-user")).map((entry) => entry.operation)).toEqual([
      "credit",
      "reserve",
      "debit"
    ]);
  });

  it("records retrying attempt and re-queues item with queued status", async () => {
    const requestStore = new InMemoryPurchaseRequestStore([createExecutingRequest("req-802")]);
    const queueStore = new InMemoryPurchaseQueueStore([
      queueItem({
        requestId: "req-802",
        status: "executing",
        attemptCount: 2
      })
    ]);
    const ticketStore = new InMemoryTicketStore();
    const notificationStore = new StubNotificationStore();
    const ticketPersistenceService = new TicketPersistenceService({
      ticketStore,
      notificationStore
    });
    const service = new TerminalExecutionAttemptService({
      requestStore,
      queueStore,
      ticketPersistenceService
    });

    const result = await service.recordAttemptResult({
      requestId: "req-802",
      attempt: 2,
      startedAt: "2026-04-05T22:11:00.000Z",
      result: terminalResult({
        requestId: "req-802",
        nextState: "retrying",
        rawOutput: "[terminal] transient failure"
      })
    });

    expect(result.request.state).toBe("retrying");
    expect(result.queueItem).not.toBeNull();
    expect(result.ticket).toBeNull();
    expect(result.queueItem?.status).toBe("queued");
    expect(result.journalNote).toContain("outcome=retrying");
    expect((await ticketStore.listTickets()).length).toBe(0);
  });

  it("records add-to-cart attempt and does not create a purchased ticket", async () => {
    const requestStore = new InMemoryPurchaseRequestStore([createExecutingRequest("req-802-cart")]);
    const queueStore = new InMemoryPurchaseQueueStore([
      queueItem({
        requestId: "req-802-cart",
        status: "executing",
        attemptCount: 1
      })
    ]);
    const ticketStore = new InMemoryTicketStore();
    const notificationStore = new StubNotificationStore();
    const ticketPersistenceService = new TicketPersistenceService({
      ticketStore,
      notificationStore
    });
    const service = new TerminalExecutionAttemptService({
      requestStore,
      queueStore,
      ticketPersistenceService
    });

    const result = await service.recordAttemptResult({
      requestId: "req-802-cart",
      attempt: 1,
      startedAt: "2026-04-05T22:11:00.000Z",
      result: terminalResult({
        requestId: "req-802-cart",
        nextState: "added_to_cart",
        rawOutput: "[terminal] added_to_cart"
      })
    });

    expect(result.request.state).toBe("added_to_cart");
    expect(result.queueItem).toBeNull();
    expect(result.ticket).toBeNull();
    expect(result.journalNote).toContain("outcome=added_to_cart");
    expect(await queueStore.getQueueItemByRequestId("req-802-cart")).toBeNull();
    expect((await ticketStore.listTickets()).length).toBe(0);
  });

  it("rejects non-executing request state", async () => {
    const requestStore = new InMemoryPurchaseRequestStore([createQueuedRequest("req-803")]);
    const queueStore = new InMemoryPurchaseQueueStore([
      queueItem({
        requestId: "req-803",
        status: "queued",
        attemptCount: 1
      })
    ]);
    const ticketStore = new InMemoryTicketStore();
    const notificationStore = new StubNotificationStore();
    const ticketPersistenceService = new TicketPersistenceService({
      ticketStore,
      notificationStore
    });
    const service = new TerminalExecutionAttemptService({
      requestStore,
      queueStore,
      ticketPersistenceService
    });

    const action = service.recordAttemptResult({
      requestId: "req-803",
      attempt: 1,
      startedAt: "2026-04-05T22:12:00.000Z",
      result: terminalResult({
        requestId: "req-803",
        nextState: "error",
        rawOutput: "[terminal] hard failure"
      })
    });

    await expect(action).rejects.toBeInstanceOf(TerminalExecutionAttemptServiceError);
    await expect(action).rejects.toMatchObject({
      code: "request_state_invalid"
    });
  });

  it("releases reserved funds when purchase fails terminally", async () => {
    const requestStore = new InMemoryPurchaseRequestStore([createExecutingRequest("req-803-ledger")]);
    const queueStore = new InMemoryPurchaseQueueStore([
      queueItem({
        requestId: "req-803-ledger",
        status: "executing",
        attemptCount: 1
      })
    ]);
    const walletLedgerService = createWalletLedgerService();
    await seedReservedFundsForRequest(walletLedgerService, "req-803-ledger");
    const ticketStore = new InMemoryTicketStore();
    const notificationStore = new StubNotificationStore();
    const ticketPersistenceService = new TicketPersistenceService({
      ticketStore,
      notificationStore
    });
    const service = new TerminalExecutionAttemptService({
      requestStore,
      queueStore,
      ticketPersistenceService,
      walletLedgerService
    });

    const result = await service.recordAttemptResult({
      requestId: "req-803-ledger",
      attempt: 1,
      startedAt: "2026-04-05T22:12:00.000Z",
      result: terminalResult({
        requestId: "req-803-ledger",
        nextState: "error",
        rawOutput: "[terminal] hard failure"
      })
    });

    expect(result.request.state).toBe("error");
    expect(await walletLedgerService.getWalletSnapshot("seed-user", "RUB")).toEqual({
      userId: "seed-user",
      availableMinor: 1000,
      reservedMinor: 0,
      currency: "RUB"
    });
    expect((await walletLedgerService.listEntries("seed-user")).map((entry) => entry.operation)).toEqual([
      "credit",
      "reserve",
      "release"
    ]);
  });

  it("records canonical attempt history and advances canonical purchase to awaiting_draw_close on success", async () => {
    const requestStore = new InMemoryPurchaseRequestStore([createExecutingRequest("req-804")]);
    const queueStore = new InMemoryPurchaseQueueStore([
      queueItem({
        requestId: "req-804",
        status: "executing",
        attemptCount: 1
      })
    ]);
    const canonicalPurchaseStore = new InMemoryCanonicalPurchaseStore([createCanonicalProcessingPurchase("req-804")]);
    const purchaseAttemptStore = new InMemoryPurchaseAttemptStore();
    const ticketStore = new InMemoryTicketStore();
    const notificationStore = new StubNotificationStore();
    const ticketPersistenceService = new TicketPersistenceService({
      ticketStore,
      notificationStore
    });
    const service = new TerminalExecutionAttemptService({
      requestStore,
      queueStore,
      canonicalPurchaseStore,
      purchaseAttemptStore,
      ticketPersistenceService
    });

    const result = await service.recordAttemptResult({
      requestId: "req-804",
      attempt: 1,
      startedAt: "2026-04-05T22:12:00.000Z",
      result: terminalResult({
        requestId: "req-804",
        nextState: "success",
        rawOutput: "[terminal] success",
        externalTicketReference: "demo-ext-804"
      })
    });

    expect(result.ticket?.requestId).toBe("req-804");
    await expect(purchaseAttemptStore.getAttemptById("req-804:attempt:1")).resolves.toMatchObject({
      outcome: "success",
      purchaseId: "req-804"
    });
    await expect(canonicalPurchaseStore.getPurchaseByLegacyRequestId("req-804")).resolves.toMatchObject({
      status: "awaiting_draw_close",
      externalTicketReference: "demo-ext-804"
    });
  });

  it("publishes canonical success without writing a legacy ticket row", async () => {
    const requestStore = new InMemoryPurchaseRequestStore([createExecutingRequest("req-806")]);
    const queueStore = new InMemoryPurchaseQueueStore([
      queueItem({
        requestId: "req-806",
        status: "executing",
        attemptCount: 1
      })
    ]);
    const canonicalPurchaseStore = new InMemoryCanonicalPurchaseStore([createCanonicalProcessingPurchase("req-806")]);
    const purchaseAttemptStore = new InMemoryPurchaseAttemptStore();
    const ticketStore = new InMemoryTicketStore();
    const notificationStore = new StubNotificationStore();
    const ticketPersistenceService = new TicketPersistenceService({
      ticketStore,
      notificationStore,
      persistLegacyTicket: false
    });
    const service = new TerminalExecutionAttemptService({
      requestStore,
      queueStore,
      canonicalPurchaseStore,
      purchaseAttemptStore,
      ticketPersistenceService
    });

    const result = await service.recordAttemptResult({
      requestId: "req-806",
      attempt: 1,
      startedAt: "2026-04-05T22:12:00.000Z",
      result: terminalResult({
        requestId: "req-806",
        nextState: "success",
        rawOutput: "[terminal] success",
        externalTicketReference: "demo-ext-806"
      })
    });

    expect(result.ticket?.ticketId).toBe("canonical:req-806");
    expect((await ticketStore.listTickets()).length).toBe(0);
    await expect(canonicalPurchaseStore.getPurchaseByLegacyRequestId("req-806")).resolves.toMatchObject({
      status: "awaiting_draw_close",
      externalTicketReference: "demo-ext-806"
    });
  });

  it("replays recorded canonical attempt without duplicating tickets", async () => {
    const requestStore = new InMemoryPurchaseRequestStore([appendPurchaseRequestTransition(createExecutingRequest("req-805"), "success", {
      eventId: "req-805:attempt:1:success",
      occurredAt: "2026-04-05T22:12:30.000Z",
      note: "terminal_attempt attempt=1 outcome=success"
    })]);
    const queueStore = new InMemoryPurchaseQueueStore([]);
    const canonicalPurchaseStore = new InMemoryCanonicalPurchaseStore([
      createCanonicalAwaitingDrawClosePurchase("req-805")
    ]);
    const purchaseAttemptStore = new InMemoryPurchaseAttemptStore([
      {
        attemptId: "req-805:attempt:1",
        purchaseId: "req-805",
        legacyRequestId: "req-805",
        attemptNumber: 1,
        outcome: "success",
        startedAt: "2026-04-05T22:12:00.000Z",
        finishedAt: "2026-04-05T22:12:30.000Z",
        rawOutput: "[terminal] success",
        durationMs: 30_000,
        externalTicketReference: "demo-ext-805",
        errorMessage: null
      }
    ]);
    const ticketStore = new InMemoryTicketStore();
    await ticketStore.saveTicket(createPurchasedTicketRecord({
      ticketId: "req-805:ticket",
      requestId: "req-805",
      userId: "seed-user",
      lotteryCode: "demo-lottery",
      drawId: "draw-300",
      purchasedAt: "2026-04-05T22:12:30.000Z",
      externalReference: "demo-ext-805"
    }));
    const notificationStore = new StubNotificationStore();
    const ticketPersistenceService = new TicketPersistenceService({
      ticketStore,
      notificationStore
    });
    const service = new TerminalExecutionAttemptService({
      requestStore,
      queueStore,
      canonicalPurchaseStore,
      purchaseAttemptStore,
      ticketPersistenceService
    });

    const replay = await service.recordAttemptResult({
      requestId: "req-805",
      attempt: 1,
      startedAt: "2026-04-05T22:12:00.000Z",
      result: terminalResult({
        requestId: "req-805",
        nextState: "success",
        rawOutput: "[terminal] success",
        externalTicketReference: "demo-ext-805"
      })
    });

    expect(replay.ticket?.ticketId).toBe("req-805:ticket");
    expect((await ticketStore.listTickets()).length).toBe(1);
  });
});

function createQueuedRequest(requestId: string): PurchaseRequestRecord {
  const awaiting = createAwaitingConfirmationRequest({
    requestId,
    userId: "seed-user",
    lotteryCode: "demo-lottery",
    drawId: "draw-300",
    payload: {
      draw_count: 1
    },
    costMinor: 90,
    currency: "RUB",
    createdAt: "2026-04-05T22:00:00.000Z"
  });
  const confirmed = appendPurchaseRequestTransition(awaiting, "confirmed", {
    eventId: `${requestId}:confirmed`,
    occurredAt: "2026-04-05T22:01:00.000Z"
  });
  return appendPurchaseRequestTransition(confirmed, "queued", {
    eventId: `${requestId}:queued`,
    occurredAt: "2026-04-05T22:02:00.000Z"
  });
}

function createExecutingRequest(requestId: string): PurchaseRequestRecord {
  return appendPurchaseRequestTransition(createQueuedRequest(requestId), "executing", {
    eventId: `${requestId}:executing:1`,
    occurredAt: "2026-04-05T22:03:00.000Z"
  });
}

function queueItem(input: {
  readonly requestId: string;
  readonly status: "queued" | "executing";
  readonly attemptCount: number;
}): PurchaseQueueItem {
  return {
    requestId: input.requestId,
    lotteryCode: "demo-lottery",
    userId: "seed-user",
    drawId: "draw-300",
    priority: "regular",
    enqueuedAt: "2026-04-05T22:02:00.000Z",
    attemptCount: input.attemptCount,
    status: input.status
  };
}

function terminalResult(input: {
  readonly requestId: string;
  readonly nextState: TerminalExecutionResult["nextState"];
  readonly rawOutput: string;
  readonly externalTicketReference?: string | null;
}): TerminalExecutionResult {
  return {
    requestId: input.requestId,
    nextState: input.nextState,
    rawOutput: input.rawOutput,
    externalTicketReference: input.externalTicketReference ?? null,
    finishedAt: "2026-04-05T22:12:30.000Z"
  };
}

class InMemoryPurchaseRequestStore implements PurchaseRequestStore {
  private records: PurchaseRequestRecord[];

  constructor(records: readonly PurchaseRequestRecord[]) {
    this.records = records.map(cloneRequestRecord);
  }

  async listRequests(): Promise<readonly PurchaseRequestRecord[]> {
    return this.records.map(cloneRequestRecord);
  }

  async getRequestById(requestId: string): Promise<PurchaseRequestRecord | null> {
    const record = this.records.find((entry) => entry.snapshot.requestId === requestId) ?? null;
    return record ? cloneRequestRecord(record) : null;
  }

  async saveRequest(record: PurchaseRequestRecord): Promise<void> {
    const filtered = this.records.filter((entry) => entry.snapshot.requestId !== record.snapshot.requestId);
    this.records = [...filtered, cloneRequestRecord(record)];
  }

  async clearAll(): Promise<void> {}
}

class InMemoryPurchaseQueueStore implements PurchaseQueueStore {
  private items: PurchaseQueueItem[];

  constructor(items: readonly PurchaseQueueItem[]) {
    this.items = items.map((item) => ({ ...item }));
  }

  async listQueueItems(): Promise<readonly PurchaseQueueItem[]> {
    return this.items.map((item) => ({ ...item }));
  }

  async getQueueItemByRequestId(requestId: string): Promise<PurchaseQueueItem | null> {
    const item = this.items.find((entry) => entry.requestId === requestId) ?? null;
    return item ? { ...item } : null;
  }

  async listSnapshot(): Promise<readonly PurchaseQueueItem[]> {
    return this.listQueueItems();
  }

  async getByRequestId(requestId: string): Promise<PurchaseQueueItem | null> {
    return this.getQueueItemByRequestId(requestId);
  }

  async enqueue(item: PurchaseQueueItem): Promise<void> {
    await this.saveQueueItem(item);
  }

  async reserve(requestId: string): Promise<PurchaseQueueItem | null> {
    const existing = await this.getQueueItemByRequestId(requestId);
    if (!existing || existing.status !== "queued") {
      return null;
    }

    const nextItem: PurchaseQueueItem = {
      ...existing,
      attemptCount: existing.attemptCount + 1,
      status: "executing"
    };
    await this.saveQueueItem(nextItem);
    return nextItem;
  }

  async requeue(requestId: string): Promise<PurchaseQueueItem | null> {
    const existing = await this.getQueueItemByRequestId(requestId);
    if (!existing) {
      return null;
    }

    const nextItem = existing.status === "queued" ? existing : { ...existing, status: "queued" as const };
    await this.saveQueueItem(nextItem);
    return nextItem;
  }

  async reprioritize(requestId: string, priority: PurchaseQueueItem["priority"]): Promise<PurchaseQueueItem | null> {
    const existing = await this.getQueueItemByRequestId(requestId);
    if (!existing) {
      return null;
    }

    const nextItem = existing.priority === priority ? existing : { ...existing, priority };
    await this.saveQueueItem(nextItem);
    return nextItem;
  }

  async complete(requestId: string): Promise<void> {
    await this.removeQueueItem(requestId);
  }

  async saveQueueItem(item: PurchaseQueueItem): Promise<void> {
    const filtered = this.items.filter((entry) => entry.requestId !== item.requestId);
    this.items = [...filtered, { ...item }];
  }

  async removeQueueItem(requestId: string): Promise<void> {
    this.items = this.items.filter((entry) => entry.requestId !== requestId);
  }

  async clearAll(): Promise<void> {}
}

class InMemoryCanonicalPurchaseStore implements CanonicalPurchaseStore {
  private purchases: CanonicalPurchaseRecord[];

  constructor(initialPurchases: readonly CanonicalPurchaseRecord[]) {
    this.purchases = initialPurchases.map(cloneCanonicalPurchaseRecord);
  }

  async listPurchases(): Promise<readonly CanonicalPurchaseRecord[]> {
    return this.purchases.map(cloneCanonicalPurchaseRecord);
  }

  async getPurchaseById(purchaseId: string): Promise<CanonicalPurchaseRecord | null> {
    const purchase = this.purchases.find((entry) => entry.snapshot.purchaseId === purchaseId) ?? null;
    return purchase ? cloneCanonicalPurchaseRecord(purchase) : null;
  }

  async getPurchaseByLegacyRequestId(legacyRequestId: string): Promise<CanonicalPurchaseRecord | null> {
    const purchase = this.purchases.find((entry) => entry.snapshot.legacyRequestId === legacyRequestId) ?? null;
    return purchase ? cloneCanonicalPurchaseRecord(purchase) : null;
  }

  async savePurchase(record: CanonicalPurchaseRecord): Promise<void> {
    const filtered = this.purchases.filter((entry) => entry.snapshot.purchaseId !== record.snapshot.purchaseId);
    this.purchases = [...filtered, cloneCanonicalPurchaseRecord(record)];
  }

  async clearAll(): Promise<void> {
    this.purchases = [];
  }
}

class InMemoryPurchaseAttemptStore implements PurchaseAttemptStore {
  private attempts: PurchaseAttemptRecord[];

  constructor(initialAttempts: readonly PurchaseAttemptRecord[] = []) {
    this.attempts = initialAttempts.map((attempt) => ({ ...attempt }));
  }

  async listAttemptsByPurchaseId(purchaseId: string): Promise<readonly PurchaseAttemptRecord[]> {
    return this.attempts.filter((entry) => entry.purchaseId === purchaseId).map((attempt) => ({ ...attempt }));
  }

  async listAttemptsByLegacyRequestId(legacyRequestId: string): Promise<readonly PurchaseAttemptRecord[]> {
    return this.attempts.filter((entry) => entry.legacyRequestId === legacyRequestId).map((attempt) => ({ ...attempt }));
  }

  async getAttemptById(attemptId: string): Promise<PurchaseAttemptRecord | null> {
    const attempt = this.attempts.find((entry) => entry.attemptId === attemptId) ?? null;
    return attempt ? { ...attempt } : null;
  }

  async saveAttempt(record: PurchaseAttemptRecord): Promise<void> {
    const filtered = this.attempts.filter((entry) => entry.attemptId !== record.attemptId);
    this.attempts = [...filtered, { ...record }];
  }

  async clearAll(): Promise<void> {
    this.attempts = [];
  }
}

class InMemoryTicketStore implements TicketStore {
  private tickets: TicketRecord[] = [];

  async listTickets(): Promise<readonly TicketRecord[]> {
    return this.tickets.map((ticket) => ({ ...ticket }));
  }

  async getTicketById(ticketId: string): Promise<TicketRecord | null> {
    const ticket = this.tickets.find((entry) => entry.ticketId === ticketId) ?? null;
    return ticket ? { ...ticket } : null;
  }

  async getTicketByRequestId(requestId: string): Promise<TicketRecord | null> {
    const ticket = this.tickets.find((entry) => entry.requestId === requestId) ?? null;
    return ticket ? { ...ticket } : null;
  }

  async saveTicket(ticket: TicketRecord): Promise<void> {
    const filtered = this.tickets.filter((entry) => entry.ticketId !== ticket.ticketId);
    this.tickets = [...filtered, { ...ticket }];
  }

  async clearAll(): Promise<void> {}
}

function createWalletLedgerService(): WalletLedgerService {
  return new WalletLedgerService({
    ledgerStore: new InMemoryLedgerStore(),
    timeSource: {
      nowIso() {
        return "2026-04-05T22:12:30.000Z";
      }
    } satisfies TimeSource,
    entryFactory: new SequentialEntryFactory()
  });
}

async function seedReservedFundsForRequest(walletLedgerService: WalletLedgerService, requestId: string): Promise<void> {
  await walletLedgerService.recordEntry({
    userId: "seed-user",
    operation: "credit",
    amountMinor: 1000,
    currency: "RUB",
    idempotencyKey: `seed-user-credit:${requestId}`,
    reference: {
      requestId: `seed-credit:${requestId}`
    },
    createdAt: "2026-04-05T22:00:00.000Z"
  });
  await walletLedgerService.reserveFunds({
    userId: "seed-user",
    requestId,
    amountMinor: 90,
    currency: "RUB",
    idempotencyKey: `${requestId}:reserve`,
    createdAt: "2026-04-05T22:01:00.000Z"
  });
}

class InMemoryLedgerStore implements LedgerStore {
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

  async clearAll(): Promise<void> {}
}

class SequentialEntryFactory implements WalletLedgerEntryFactory {
  private index = 0;

  nextEntryId(): string {
    this.index += 1;
    return `ledger-${this.index}`;
  }
}

function cloneRequestRecord(record: PurchaseRequestRecord): PurchaseRequestRecord {
  return {
    snapshot: {
      ...record.snapshot,
      payload: { ...record.snapshot.payload }
    },
    state: record.state,
    journal: record.journal.map((entry) => ({ ...entry }))
  };
}

function createCanonicalProcessingPurchase(requestId: string): CanonicalPurchaseRecord {
  return appendCanonicalPurchaseTransition(
    appendCanonicalPurchaseTransition(
      createSubmittedCanonicalPurchase({
        purchaseId: requestId,
        legacyRequestId: requestId,
        userId: "seed-user",
        lotteryCode: "demo-lottery",
        drawId: "draw-300",
        payload: {
          draw_count: 1
        },
        costMinor: 90,
        currency: "RUB",
        submittedAt: "2026-04-05T22:00:00.000Z"
      }),
      "queued",
      {
        eventId: `${requestId}:queued`,
        occurredAt: "2026-04-05T22:02:00.000Z"
      }
    ),
    "processing",
    {
      eventId: `${requestId}:processing`,
      occurredAt: "2026-04-05T22:03:00.000Z"
    }
  );
}

function createCanonicalPurchasedPurchase(requestId: string): CanonicalPurchaseRecord {
  return appendCanonicalPurchaseTransition(createCanonicalProcessingPurchase(requestId), "purchased", {
    eventId: `${requestId}:purchased`,
    occurredAt: "2026-04-05T22:12:30.000Z",
    externalTicketReference: `demo-ext-${requestId.split("-").at(-1) ?? requestId}`
  });
}

function createCanonicalAwaitingDrawClosePurchase(requestId: string): CanonicalPurchaseRecord {
  return appendCanonicalPurchaseTransition(createCanonicalPurchasedPurchase(requestId), "awaiting_draw_close", {
    eventId: `${requestId}:awaiting_draw_close`,
    occurredAt: "2026-04-05T22:12:30.000Z",
    externalTicketReference: `demo-ext-${requestId.split("-").at(-1) ?? requestId}`
  });
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

class StubNotificationStore implements NotificationStore {
  async saveNotification(): Promise<void> {}
  async listUserNotifications(): Promise<readonly NotificationRecord[]> { return []; }
  async getNotificationById(): Promise<NotificationRecord | null> { return null; }
  async markNotificationRead(): Promise<void> {}
  async clearAll(): Promise<void> {}
}
