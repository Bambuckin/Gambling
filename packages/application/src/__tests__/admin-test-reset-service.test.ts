import { describe, expect, it } from "vitest";
import {
  appendPurchaseRequestTransition,
  type CanonicalDrawRecord,
  type CanonicalPurchaseRecord,
  createAwaitingConfirmationRequest,
  type AccessSession,
  type CashDeskRequest,
  type DrawClosureRecord,
  type DrawSnapshot,
  type LedgerEntry,
  type NotificationRecord,
  type PurchaseRequestRecord,
  type PurchaseAttemptRecord,
  type TicketRecord,
  type WinningsCreditJob
} from "@lottery/domain";
import type {
  CanonicalDrawStore,
  CanonicalPurchaseStore,
  CashDeskRequestStore,
  DrawClosureStore,
  DrawStore,
  LedgerStore,
  NotificationStore,
  PurchaseQueueItem,
  PurchaseQueueStore,
  PurchaseAttemptStore,
  PurchaseRequestStore,
  SessionStore,
  TerminalExecutionLock,
  TicketStore,
  TimeSource,
  WinningsCreditJobStore
} from "../index.js";
import { AdminTestResetService } from "../services/admin-test-reset-service.js";
import { WalletLedgerService } from "../services/wallet-ledger-service.js";

describe("admin test reset service", () => {
  it("clears queued requests, releases reserves, and drops queue items", async () => {
    const nowIso = "2026-04-18T10:00:00.000Z";
    const timeSource = fixedTime(nowIso);
    const drawStore = new MemoryDrawStore([]);
    const request = createQueuedRequest("req-clear-1");
    const requestStore = new MemoryRequestStore([request]);
    const queueStore = new MemoryQueueStore([
      {
        requestId: request.snapshot.requestId,
        lotteryCode: request.snapshot.lotteryCode,
        userId: request.snapshot.userId,
        drawId: request.snapshot.drawId,
        attemptCount: 0,
        priority: "regular",
        enqueuedAt: nowIso,
        status: "queued"
      }
    ]);
    const canonicalPurchaseStore = new MemoryCanonicalPurchaseStore([]);
    const canonicalDrawStore = new MemoryCanonicalDrawStore([]);
    const purchaseAttemptStore = new MemoryPurchaseAttemptStore([]);
    const ticketStore = new MemoryTicketStore([]);
    const ledgerStore = new MemoryLedgerStore([]);
    const notificationStore = new MemoryNotificationStore([]);
    const drawClosureStore = new MemoryDrawClosureStore([]);
    const cashDeskRequestStore = new MemoryCashDeskRequestStore([]);
    const winningsCreditJobStore = new MemoryWinningsCreditJobStore([]);
    const sessionStore = new MemorySessionStore([]);
    const executionLock = new MemoryTerminalExecutionLock();
    const walletLedgerService = new WalletLedgerService({
      ledgerStore,
      timeSource,
      entryFactory: {
        nextEntryId() {
          return "ledger-1";
        }
      }
    });

    await walletLedgerService.recordEntry({
      userId: request.snapshot.userId,
      operation: "credit",
      amountMinor: request.snapshot.costMinor,
      currency: request.snapshot.currency,
      idempotencyKey: `${request.snapshot.requestId}:seed-credit`,
      reference: {
        requestId: request.snapshot.requestId,
        drawId: request.snapshot.drawId,
        ticketId: "seed-ticket"
      }
    });

    await walletLedgerService.reserveFunds({
      userId: request.snapshot.userId,
      requestId: request.snapshot.requestId,
      amountMinor: request.snapshot.costMinor,
      currency: request.snapshot.currency,
      drawId: request.snapshot.drawId,
      idempotencyKey: `${request.snapshot.requestId}:reserve`
    });

    const service = new AdminTestResetService({
      drawStore,
      requestStore,
      queueStore,
      canonicalPurchaseStore,
      canonicalDrawStore,
      purchaseAttemptStore,
      ticketStore,
      ledgerStore,
      notificationStore,
      drawClosureStore,
      cashDeskRequestStore,
      winningsCreditJobStore,
      sessionStore,
      executionLock,
      walletLedgerService,
      timeSource
    });

    const result = await service.clearQueue();
    const updatedRequest = await requestStore.getRequestById(request.snapshot.requestId);

    expect(result).toMatchObject({
      removedQueueItems: 1,
      releasedReserves: 1,
      updatedRequests: 1
    });
    expect((await queueStore.listQueueItems())).toHaveLength(0);
    expect(updatedRequest?.state).toBe("reserve_released");
    expect(executionLock.cleared).toBe(true);
  });

  it("clears the full test runtime including draws and execution locks", async () => {
    const timeSource = fixedTime("2026-04-18T11:00:00.000Z");
    const drawStore = new MemoryDrawStore([
      {
        lotteryCode: "bolshaya-8",
        drawId: "draw-reset-1",
        drawAt: "2026-04-18T12:00:00.000Z",
        fetchedAt: "2026-04-18T11:00:00.000Z",
        freshnessTtlSeconds: 1800
      }
    ]);
    const requestStore = new MemoryRequestStore([createQueuedRequest("req-reset-1")]);
    const queueStore = new MemoryQueueStore([
      {
        requestId: "req-reset-1",
        lotteryCode: "bolshaya-8",
        userId: "seed-user",
        drawId: "draw-reset-1",
        attemptCount: 0,
        priority: "regular",
        enqueuedAt: "2026-04-18T11:00:00.000Z",
        status: "queued"
      }
    ]);
    const canonicalPurchaseStore = new MemoryCanonicalPurchaseStore([{} as CanonicalPurchaseRecord]);
    const canonicalDrawStore = new MemoryCanonicalDrawStore([{} as CanonicalDrawRecord]);
    const purchaseAttemptStore = new MemoryPurchaseAttemptStore([{} as PurchaseAttemptRecord]);
    const ticketStore = new MemoryTicketStore([{} as TicketRecord]);
    const ledgerStore = new MemoryLedgerStore([{} as LedgerEntry]);
    const notificationStore = new MemoryNotificationStore([{} as NotificationRecord]);
    const drawClosureStore = new MemoryDrawClosureStore([{} as DrawClosureRecord]);
    const cashDeskRequestStore = new MemoryCashDeskRequestStore([{} as CashDeskRequest]);
    const winningsCreditJobStore = new MemoryWinningsCreditJobStore([{} as WinningsCreditJob]);
    const sessionStore = new MemorySessionStore([{} as AccessSession]);
    const executionLock = new MemoryTerminalExecutionLock();
    const walletLedgerService = new WalletLedgerService({
      ledgerStore,
      timeSource,
      entryFactory: {
        nextEntryId() {
          return "ledger-2";
        }
      }
    });

    const service = new AdminTestResetService({
      drawStore,
      requestStore,
      queueStore,
      canonicalPurchaseStore,
      canonicalDrawStore,
      purchaseAttemptStore,
      ticketStore,
      ledgerStore,
      notificationStore,
      drawClosureStore,
      cashDeskRequestStore,
      winningsCreditJobStore,
      sessionStore,
      executionLock,
      walletLedgerService,
      timeSource
    });

    const result = await service.resetTestData();

    expect(result.clearedDraws).toBe(true);
    expect(result.clearedExecutionLocks).toBe(true);
    expect(result.clearedCanonicalPurchases).toBe(true);
    expect(result.clearedCanonicalDraws).toBe(true);
    expect(result.clearedPurchaseAttempts).toBe(true);
    expect((await drawStore.listSnapshots())).toHaveLength(0);
    expect((await requestStore.listRequests())).toHaveLength(0);
    expect((await queueStore.listQueueItems())).toHaveLength(0);
    expect((await canonicalPurchaseStore.listPurchases())).toHaveLength(0);
    expect((await canonicalDrawStore.listDraws())).toHaveLength(0);
    expect((await purchaseAttemptStore.listAttemptsByPurchaseId("missing"))).toHaveLength(0);
    expect((await ticketStore.listTickets())).toHaveLength(0);
    expect((await ledgerStore.listEntries())).toHaveLength(0);
    expect((await drawClosureStore.listClosures())).toHaveLength(0);
    expect((await cashDeskRequestStore.listCashDeskRequests())).toHaveLength(0);
    expect((await winningsCreditJobStore.listQueuedJobs())).toHaveLength(0);
    expect(sessionStore.revokedAt).toBe("2026-04-18T11:00:00.000Z");
    expect(executionLock.cleared).toBe(true);
  });
});

function fixedTime(nowIso: string): TimeSource {
  return {
    nowIso() {
      return nowIso;
    }
  };
}

function createQueuedRequest(requestId: string): PurchaseRequestRecord {
  const awaiting = createAwaitingConfirmationRequest({
    requestId,
    userId: "seed-user",
    lotteryCode: "bolshaya-8",
    drawId: "draw-test-1",
    payload: {},
    costMinor: 100,
    currency: "RUB",
    createdAt: "2026-04-18T09:00:00.000Z"
  });
  const confirmed = appendPurchaseRequestTransition(awaiting, "confirmed", {
    eventId: `${requestId}:confirmed`,
    occurredAt: "2026-04-18T09:00:30.000Z"
  });

  return appendPurchaseRequestTransition(confirmed, "queued", {
    eventId: `${requestId}:queued`,
    occurredAt: "2026-04-18T09:01:00.000Z"
  });
}

class MemoryDrawStore implements DrawStore {
  private snapshots: DrawSnapshot[];

  constructor(initialSnapshots: readonly DrawSnapshot[]) {
    this.snapshots = [...initialSnapshots];
  }

  async listSnapshots(): Promise<readonly DrawSnapshot[]> {
    return [...this.snapshots];
  }

  async getSnapshot(lotteryCode: string): Promise<DrawSnapshot | null> {
    return this.snapshots.find((snapshot) => snapshot.lotteryCode === lotteryCode) ?? null;
  }

  async upsertSnapshot(snapshot: DrawSnapshot): Promise<void> {
    this.snapshots = [...this.snapshots.filter((entry) => entry.lotteryCode !== snapshot.lotteryCode), snapshot];
  }

  async deleteSnapshot(lotteryCode: string): Promise<void> {
    this.snapshots = this.snapshots.filter((entry) => entry.lotteryCode !== lotteryCode);
  }

  async clearAll(): Promise<void> {
    this.snapshots = [];
  }
}

class MemoryRequestStore implements PurchaseRequestStore {
  private requests: PurchaseRequestRecord[];

  constructor(initialRequests: readonly PurchaseRequestRecord[]) {
    this.requests = [...initialRequests];
  }

  async listRequests(): Promise<readonly PurchaseRequestRecord[]> {
    return [...this.requests];
  }

  async getRequestById(requestId: string): Promise<PurchaseRequestRecord | null> {
    return this.requests.find((request) => request.snapshot.requestId === requestId) ?? null;
  }

  async saveRequest(record: PurchaseRequestRecord): Promise<void> {
    this.requests = [...this.requests.filter((entry) => entry.snapshot.requestId !== record.snapshot.requestId), record];
  }

  async clearAll(): Promise<void> {
    this.requests = [];
  }
}

class MemoryCanonicalPurchaseStore implements CanonicalPurchaseStore {
  private records: CanonicalPurchaseRecord[];

  constructor(initialRecords: readonly CanonicalPurchaseRecord[]) {
    this.records = [...initialRecords];
  }

  async listPurchases(): Promise<readonly CanonicalPurchaseRecord[]> {
    return [...this.records];
  }

  async getPurchaseById(purchaseId: string): Promise<CanonicalPurchaseRecord | null> {
    return this.records.find((record) => record.snapshot.purchaseId === purchaseId) ?? null;
  }

  async getPurchaseByLegacyRequestId(legacyRequestId: string): Promise<CanonicalPurchaseRecord | null> {
    return this.records.find((record) => record.snapshot.legacyRequestId === legacyRequestId) ?? null;
  }

  async savePurchase(record: CanonicalPurchaseRecord): Promise<void> {
    this.records = [...this.records.filter((entry) => entry.snapshot.purchaseId !== record.snapshot.purchaseId), record];
  }

  async clearAll(): Promise<void> {
    this.records = [];
  }
}

class MemoryCanonicalDrawStore implements CanonicalDrawStore {
  private records: CanonicalDrawRecord[];

  constructor(initialRecords: readonly CanonicalDrawRecord[]) {
    this.records = [...initialRecords];
  }

  async listDraws(lotteryCode?: string): Promise<readonly CanonicalDrawRecord[]> {
    return lotteryCode ? this.records.filter((record) => record.lotteryCode === lotteryCode) : [...this.records];
  }

  async getDraw(lotteryCode: string, drawId: string): Promise<CanonicalDrawRecord | null> {
    return this.records.find((record) => record.lotteryCode === lotteryCode && record.drawId === drawId) ?? null;
  }

  async saveDraw(record: CanonicalDrawRecord): Promise<void> {
    this.records = [
      ...this.records.filter((entry) => !(entry.lotteryCode === record.lotteryCode && entry.drawId === record.drawId)),
      record
    ];
  }

  async deleteDraw(lotteryCode: string, drawId: string): Promise<void> {
    this.records = this.records.filter((entry) => !(entry.lotteryCode === lotteryCode && entry.drawId === drawId));
  }

  async clearAll(): Promise<void> {
    this.records = [];
  }
}

class MemoryPurchaseAttemptStore implements PurchaseAttemptStore {
  private records: PurchaseAttemptRecord[];

  constructor(initialRecords: readonly PurchaseAttemptRecord[]) {
    this.records = [...initialRecords];
  }

  async listAttemptsByPurchaseId(purchaseId: string): Promise<readonly PurchaseAttemptRecord[]> {
    return this.records.filter((record) => record.purchaseId === purchaseId);
  }

  async listAttemptsByLegacyRequestId(legacyRequestId: string): Promise<readonly PurchaseAttemptRecord[]> {
    return this.records.filter((record) => record.legacyRequestId === legacyRequestId);
  }

  async getAttemptById(attemptId: string): Promise<PurchaseAttemptRecord | null> {
    return this.records.find((record) => record.attemptId === attemptId) ?? null;
  }

  async saveAttempt(record: PurchaseAttemptRecord): Promise<void> {
    this.records = [...this.records.filter((entry) => entry.attemptId !== record.attemptId), record];
  }

  async clearAll(): Promise<void> {
    this.records = [];
  }
}

class MemoryQueueStore implements PurchaseQueueStore {
  private items: PurchaseQueueItem[];

  constructor(initialItems: readonly PurchaseQueueItem[]) {
    this.items = [...initialItems];
  }

  async listQueueItems(): Promise<readonly PurchaseQueueItem[]> {
    return [...this.items];
  }

  async getQueueItemByRequestId(requestId: string): Promise<PurchaseQueueItem | null> {
    return this.items.find((item) => item.requestId === requestId) ?? null;
  }

  async saveQueueItem(item: PurchaseQueueItem): Promise<void> {
    this.items = [...this.items.filter((entry) => entry.requestId !== item.requestId), item];
  }

  async removeQueueItem(requestId: string): Promise<void> {
    this.items = this.items.filter((item) => item.requestId !== requestId);
  }

  async clearAll(): Promise<void> {
    this.items = [];
  }
}

class MemoryTicketStore implements TicketStore {
  private tickets: TicketRecord[];

  constructor(initialTickets: readonly TicketRecord[]) {
    this.tickets = [...initialTickets];
  }

  async listTickets(): Promise<readonly TicketRecord[]> {
    return [...this.tickets];
  }

  async getTicketById(ticketId: string): Promise<TicketRecord | null> {
    return this.tickets.find((ticket) => ticket.ticketId === ticketId) ?? null;
  }

  async getTicketByRequestId(requestId: string): Promise<TicketRecord | null> {
    return this.tickets.find((ticket) => ticket.requestId === requestId) ?? null;
  }

  async saveTicket(ticket: TicketRecord): Promise<void> {
    this.tickets = [...this.tickets.filter((entry) => entry.ticketId !== ticket.ticketId), ticket];
  }

  async clearAll(): Promise<void> {
    this.tickets = [];
  }
}

class MemoryLedgerStore implements LedgerStore {
  private entries: LedgerEntry[];

  constructor(initialEntries: readonly LedgerEntry[]) {
    this.entries = [...initialEntries];
  }

  async listEntries(): Promise<readonly LedgerEntry[]> {
    return [...this.entries];
  }

  async listEntriesByUser(userId: string): Promise<readonly LedgerEntry[]> {
    return this.entries.filter((entry) => entry.userId === userId);
  }

  async appendEntry(entry: LedgerEntry): Promise<void> {
    this.entries = [...this.entries, entry];
  }

  async clearAll(): Promise<void> {
    this.entries = [];
  }
}

class MemoryNotificationStore implements NotificationStore {
  private notifications: NotificationRecord[];

  constructor(initialNotifications: readonly NotificationRecord[]) {
    this.notifications = [...initialNotifications];
  }

  async saveNotification(notification: NotificationRecord): Promise<void> {
    this.notifications = [...this.notifications.filter((entry) => entry.notificationId !== notification.notificationId), notification];
  }

  async listUserNotifications(userId: string): Promise<readonly NotificationRecord[]> {
    return this.notifications.filter((notification) => notification.userId === userId);
  }

  async getNotificationById(notificationId: string): Promise<NotificationRecord | null> {
    return this.notifications.find((notification) => notification.notificationId === notificationId) ?? null;
  }

  async markNotificationRead(notificationId: string): Promise<void> {
    this.notifications = this.notifications.map((notification) =>
      notification.notificationId === notificationId ? { ...notification, read: true } : notification
    );
  }

  async clearAll(): Promise<void> {
    this.notifications = [];
  }
}

class MemoryDrawClosureStore implements DrawClosureStore {
  private closures: DrawClosureRecord[];

  constructor(initialClosures: readonly DrawClosureRecord[]) {
    this.closures = [...initialClosures];
  }

  async getClosure(lotteryCode: string, drawId: string): Promise<DrawClosureRecord | null> {
    return this.closures.find((closure) => closure.lotteryCode === lotteryCode && closure.drawId === drawId) ?? null;
  }

  async saveClosure(record: DrawClosureRecord): Promise<void> {
    this.closures = [
      ...this.closures.filter((entry) => !(entry.lotteryCode === record.lotteryCode && entry.drawId === record.drawId)),
      record
    ];
  }

  async listClosures(lotteryCode?: string): Promise<readonly DrawClosureRecord[]> {
    return lotteryCode ? this.closures.filter((closure) => closure.lotteryCode === lotteryCode) : [...this.closures];
  }

  async deleteClosure(lotteryCode: string, drawId: string): Promise<void> {
    this.closures = this.closures.filter((closure) => !(closure.lotteryCode === lotteryCode && closure.drawId === drawId));
  }

  async clearAll(): Promise<void> {
    this.closures = [];
  }
}

class MemoryCashDeskRequestStore implements CashDeskRequestStore {
  private requests: CashDeskRequest[];

  constructor(initialRequests: readonly CashDeskRequest[]) {
    this.requests = [...initialRequests];
  }

  async saveCashDeskRequest(request: CashDeskRequest): Promise<void> {
    this.requests = [...this.requests.filter((entry) => entry.cashDeskRequestId !== request.cashDeskRequestId), request];
  }

  async getCashDeskRequestById(cashDeskRequestId: string): Promise<CashDeskRequest | null> {
    return this.requests.find((request) => request.cashDeskRequestId === cashDeskRequestId) ?? null;
  }

  async getCashDeskRequestByTicketId(ticketId: string): Promise<CashDeskRequest | null> {
    return this.requests.find((request) => request.ticketId === ticketId) ?? null;
  }

  async listCashDeskRequests(): Promise<readonly CashDeskRequest[]> {
    return [...this.requests];
  }

  async clearAll(): Promise<void> {
    this.requests = [];
  }
}

class MemoryWinningsCreditJobStore implements WinningsCreditJobStore {
  private jobs: WinningsCreditJob[];

  constructor(initialJobs: readonly WinningsCreditJob[]) {
    this.jobs = [...initialJobs];
  }

  async saveJob(job: WinningsCreditJob): Promise<void> {
    this.jobs = [...this.jobs.filter((entry) => entry.ticketId !== job.ticketId), job];
  }

  async getJobByTicketId(ticketId: string): Promise<WinningsCreditJob | null> {
    return this.jobs.find((job) => job.ticketId === ticketId) ?? null;
  }

  async listQueuedJobs(): Promise<readonly WinningsCreditJob[]> {
    return [...this.jobs];
  }

  async clearAll(): Promise<void> {
    this.jobs = [];
  }
}

class MemorySessionStore implements SessionStore {
  private sessions: AccessSession[];
  revokedAt: string | null = null;

  constructor(initialSessions: readonly AccessSession[]) {
    this.sessions = [...initialSessions];
  }

  async create(session: AccessSession): Promise<void> {
    this.sessions = [...this.sessions, session];
  }

  async findById(sessionId: string): Promise<AccessSession | null> {
    return this.sessions.find((session) => session.sessionId === sessionId) ?? null;
  }

  async update(session: AccessSession): Promise<void> {
    this.sessions = [...this.sessions.filter((entry) => entry.sessionId !== session.sessionId), session];
  }

  async revoke(sessionId: string, revokedAt: string): Promise<AccessSession | null> {
    const existing = await this.findById(sessionId);
    this.revokedAt = revokedAt;
    return existing;
  }

  async revokeAll(revokedAt: string): Promise<void> {
    this.revokedAt = revokedAt;
    this.sessions = [];
  }
}

class MemoryTerminalExecutionLock implements TerminalExecutionLock {
  cleared = false;

  async acquire(_ownerId: string): Promise<boolean> {
    return true;
  }

  async release(_ownerId: string): Promise<void> {}

  async clearAll(): Promise<void> {
    this.cleared = true;
  }
}
