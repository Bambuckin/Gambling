import {
  appendPurchaseRequestTransition,
  createAwaitingConfirmationRequest,
  createPurchasedTicketRecord,
  type LedgerEntry,
  type PurchaseRequestRecord,
  type TicketRecord
} from "@lottery/domain";
import { describe, expect, it } from "vitest";
import type { LedgerStore } from "../ports/ledger-store.js";
import type { PurchaseRequestStore } from "../ports/purchase-request-store.js";
import type { TicketStore } from "../ports/ticket-store.js";
import type { TimeSource } from "../ports/time-source.js";
import {
  TicketVerificationResultService,
  TicketVerificationResultServiceError
} from "../services/ticket-verification-result-service.js";
import { WalletLedgerService, type WalletLedgerEntryFactory } from "../services/wallet-ledger-service.js";

describe("TicketVerificationResultService", () => {
  it("normalizes verification result and credits winnings with ticket reference", async () => {
    const ticketStore = new InMemoryTicketStore([createPendingTicket("req-980")]);
    const requestStore = new InMemoryPurchaseRequestStore([createSuccessRequest("req-980")]);
    const walletLedgerService = createWalletLedgerService();
    const service = new TicketVerificationResultService({
      ticketStore,
      purchaseRequestStore: requestStore,
      walletLedgerService,
      timeSource: new FixedTimeSource("2026-04-06T01:10:00.000Z")
    });

    const result = await service.recordVerificationResult({
      ticketId: "req-980:ticket",
      verificationEventId: "req-980:verify:1",
      terminalStatus: "win",
      winningAmountMinor: 3400,
      rawOutput: "[terminal-result] win"
    });

    expect(result.replayed).toBe(false);
    expect(result.verificationStatus).toBe("verified");
    expect(result.winningAmountMinor).toBe(3400);
    expect(result.rawOutput).toContain("win");
    expect(result.winningsCredited).toBe(true);
    expect(ticketStore.saveCount).toBe(1);

    const updatedTicket = await ticketStore.getTicketById("req-980:ticket");
    expect(updatedTicket?.verificationStatus).toBe("verified");
    expect(updatedTicket?.winningAmountMinor).toBe(3400);
    expect(updatedTicket?.verificationRawOutput).toContain("win");

    const ledgerEntries = await walletLedgerService.listEntries("seed-user");
    expect(ledgerEntries).toHaveLength(1);
    expect(ledgerEntries[0]?.reference.ticketId).toBe("req-980:ticket");
    expect(ledgerEntries[0]?.idempotencyKey).toBe("req-980:ticket:winnings:req-980:verify:1");
  });

  it("returns replayed=true for the same verification event and suppresses duplicate credit", async () => {
    const ticketStore = new InMemoryTicketStore([createPendingTicket("req-981")]);
    const requestStore = new InMemoryPurchaseRequestStore([createSuccessRequest("req-981")]);
    const walletLedgerService = createWalletLedgerService();
    const service = new TicketVerificationResultService({
      ticketStore,
      purchaseRequestStore: requestStore,
      walletLedgerService,
      timeSource: new FixedTimeSource("2026-04-06T01:11:00.000Z")
    });

    const first = await service.recordVerificationResult({
      ticketId: "req-981:ticket",
      verificationEventId: "req-981:verify:1",
      terminalStatus: "win",
      winningAmountMinor: 1200,
      rawOutput: "[terminal-result] win"
    });
    const replay = await service.recordVerificationResult({
      ticketId: "req-981:ticket",
      verificationEventId: "req-981:verify:1",
      terminalStatus: "win",
      winningAmountMinor: 1200,
      rawOutput: "[terminal-result] win"
    });

    expect(first.replayed).toBe(false);
    expect(replay.replayed).toBe(true);
    expect(replay.winningsCredited).toBe(false);
    expect(ticketStore.saveCount).toBe(1);
    expect((await walletLedgerService.listEntries("seed-user")).length).toBe(1);
  });

  it("fails replay when event payload does not match persisted ticket outcome", async () => {
    const ticketStore = new InMemoryTicketStore([createPendingTicket("req-982")]);
    const requestStore = new InMemoryPurchaseRequestStore([createSuccessRequest("req-982")]);
    const walletLedgerService = createWalletLedgerService();
    const service = new TicketVerificationResultService({
      ticketStore,
      purchaseRequestStore: requestStore,
      walletLedgerService,
      timeSource: new FixedTimeSource("2026-04-06T01:12:00.000Z")
    });

    await service.recordVerificationResult({
      ticketId: "req-982:ticket",
      verificationEventId: "req-982:verify:1",
      terminalStatus: "lose",
      winningAmountMinor: 0,
      rawOutput: "[terminal-result] lose"
    });

    const action = service.recordVerificationResult({
      ticketId: "req-982:ticket",
      verificationEventId: "req-982:verify:1",
      terminalStatus: "win",
      winningAmountMinor: 1500,
      rawOutput: "[terminal-result] win"
    });

    await expect(action).rejects.toBeInstanceOf(TicketVerificationResultServiceError);
    await expect(action).rejects.toMatchObject({
      code: "replay_conflict"
    });
  });
});

function createPendingTicket(requestId: string): TicketRecord {
  return createPurchasedTicketRecord({
    ticketId: `${requestId}:ticket`,
    requestId,
    userId: "seed-user",
    lotteryCode: "demo-lottery",
    drawId: `draw-${requestId.split("-").at(-1)}`,
    purchasedAt: "2026-04-06T01:00:00.000Z",
    externalReference: `ext-${requestId}`
  });
}

function createSuccessRequest(requestId: string): PurchaseRequestRecord {
  const awaiting = createAwaitingConfirmationRequest({
    requestId,
    userId: "seed-user",
    lotteryCode: "demo-lottery",
    drawId: `draw-${requestId.split("-").at(-1)}`,
    payload: {
      draw_count: 1
    },
    costMinor: 100,
    currency: "RUB",
    createdAt: "2026-04-06T00:55:00.000Z"
  });
  const confirmed = appendPurchaseRequestTransition(awaiting, "confirmed", {
    eventId: `${requestId}:confirmed`,
    occurredAt: "2026-04-06T00:56:00.000Z"
  });
  const queued = appendPurchaseRequestTransition(confirmed, "queued", {
    eventId: `${requestId}:queued`,
    occurredAt: "2026-04-06T00:57:00.000Z"
  });
  const executing = appendPurchaseRequestTransition(queued, "executing", {
    eventId: `${requestId}:executing`,
    occurredAt: "2026-04-06T00:58:00.000Z"
  });
  return appendPurchaseRequestTransition(executing, "success", {
    eventId: `${requestId}:success`,
    occurredAt: "2026-04-06T00:59:00.000Z"
  });
}

function createWalletLedgerService(): WalletLedgerService {
  return new WalletLedgerService({
    ledgerStore: new InMemoryLedgerStore(),
    timeSource: new FixedTimeSource("2026-04-06T01:00:00.000Z"),
    entryFactory: new SequentialEntryFactory()
  });
}

class InMemoryTicketStore implements TicketStore {
  private tickets: TicketRecord[];
  saveCount = 0;

  constructor(initialTickets: readonly TicketRecord[]) {
    this.tickets = initialTickets.map(cloneTicket);
  }

  async listTickets(): Promise<readonly TicketRecord[]> {
    return this.tickets.map(cloneTicket);
  }

  async getTicketById(ticketId: string): Promise<TicketRecord | null> {
    const ticket = this.tickets.find((entry) => entry.ticketId === ticketId) ?? null;
    return ticket ? cloneTicket(ticket) : null;
  }

  async getTicketByRequestId(requestId: string): Promise<TicketRecord | null> {
    const ticket = this.tickets.find((entry) => entry.requestId === requestId) ?? null;
    return ticket ? cloneTicket(ticket) : null;
  }

  async saveTicket(ticket: TicketRecord): Promise<void> {
    this.saveCount += 1;
    const filtered = this.tickets.filter((entry) => entry.ticketId !== ticket.ticketId);
    this.tickets = [...filtered, cloneTicket(ticket)];
  }
}

class InMemoryPurchaseRequestStore implements PurchaseRequestStore {
  private records: PurchaseRequestRecord[];

  constructor(initialRecords: readonly PurchaseRequestRecord[]) {
    this.records = initialRecords.map(cloneRequest);
  }

  async listRequests(): Promise<readonly PurchaseRequestRecord[]> {
    return this.records.map(cloneRequest);
  }

  async getRequestById(requestId: string): Promise<PurchaseRequestRecord | null> {
    const record = this.records.find((entry) => entry.snapshot.requestId === requestId) ?? null;
    return record ? cloneRequest(record) : null;
  }

  async saveRequest(record: PurchaseRequestRecord): Promise<void> {
    const filtered = this.records.filter((entry) => entry.snapshot.requestId !== record.snapshot.requestId);
    this.records = [...filtered, cloneRequest(record)];
  }
}

class InMemoryLedgerStore implements LedgerStore {
  private entries: LedgerEntry[] = [];

  async listEntries(): Promise<readonly LedgerEntry[]> {
    return this.entries.map((entry) => cloneEntry(entry));
  }

  async listEntriesByUser(userId: string): Promise<readonly LedgerEntry[]> {
    return this.entries.filter((entry) => entry.userId === userId).map((entry) => cloneEntry(entry));
  }

  async appendEntry(entry: LedgerEntry): Promise<void> {
    this.entries = [...this.entries, cloneEntry(entry)];
  }
}

class FixedTimeSource implements TimeSource {
  constructor(private readonly value: string) {}

  nowIso(): string {
    return this.value;
  }
}

class SequentialEntryFactory implements WalletLedgerEntryFactory {
  private index = 0;

  nextEntryId(): string {
    this.index += 1;
    return `ledger-${this.index}`;
  }
}

function cloneRequest(record: PurchaseRequestRecord): PurchaseRequestRecord {
  return {
    snapshot: {
      ...record.snapshot,
      payload: { ...record.snapshot.payload }
    },
    state: record.state,
    journal: record.journal.map((entry) => ({ ...entry }))
  };
}

function cloneTicket(ticket: TicketRecord): TicketRecord {
  return {
    ...ticket
  };
}

function cloneEntry(entry: LedgerEntry): LedgerEntry {
  return {
    ...entry,
    reference: { ...entry.reference }
  };
}
