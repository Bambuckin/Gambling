import {
  applyTicketVerificationOutcome,
  createPurchasedTicketRecord,
  type LedgerEntry,
  type TicketRecord,
  type WinningsCreditJob
} from "@lottery/domain";
import { describe, expect, it } from "vitest";
import type { LedgerStore } from "../ports/ledger-store.js";
import type { TicketStore } from "../ports/ticket-store.js";
import type { TimeSource } from "../ports/time-source.js";
import type { WinningsCreditJobStore } from "../ports/winnings-credit-job-store.js";
import { TicketClaimService } from "../services/ticket-claim-service.js";
import { WalletLedgerService, type WalletLedgerEntryFactory } from "../services/wallet-ledger-service.js";
import { WinningsCreditService } from "../services/winnings-credit-service.js";

describe("WinningsCreditService", () => {
  it("processes a queued legacy-ticket job with canonical purchase identity", async () => {
    const ticketStore = new InMemoryTicketStore([createWinningTicket("req-910")]);
    const jobStore = new InMemoryWinningsCreditJobStore();
    const service = createService({ ticketStore, jobStore });

    const queued = await service.enqueueCreditJob({
      requestId: "req-910",
      purchaseId: "purchase-910",
      ticketId: "req-910:ticket",
      userId: "seed-user",
      drawId: "draw-910",
      winningAmountMinor: 4_500,
      currency: "RUB"
    });
    const processed = await service.processCreditJobForTicket("req-910:ticket");

    expect(queued.purchaseId).toBe("purchase-910");
    expect(processed?.credited).toBe(true);
    expect(processed?.job.status).toBe("done");

    const updatedTicket = await ticketStore.getTicketById("req-910:ticket");
    expect(updatedTicket?.claimState).toBe("credited");

    const entries = await serviceDependencies(service).walletLedgerService.listEntries("seed-user");
    expect(entries).toEqual([
      expect.objectContaining({
        idempotencyKey: "purchase-910:winnings:purchase-910:credit",
        reference: {
          purchaseId: "purchase-910",
          requestId: "req-910",
          ticketId: "req-910:ticket",
          drawId: "draw-910"
        }
      })
    ]);
  });

  it("processes canonical-only jobs without requiring a legacy ticket row", async () => {
    const ticketStore = new InMemoryTicketStore([]);
    const jobStore = new InMemoryWinningsCreditJobStore();
    const service = createService({ ticketStore, jobStore });

    await service.enqueueCreditJob({
      requestId: "req-911",
      purchaseId: "purchase-911",
      ticketId: "canonical:purchase-911",
      userId: "seed-user",
      drawId: "draw-911",
      winningAmountMinor: 50_000,
      currency: "RUB"
    });
    const processed = await service.processNextCreditJob();

    expect(processed?.credited).toBe(true);
    expect(await ticketStore.getTicketById("canonical:purchase-911")).toBeNull();
    expect((await serviceDependencies(service).walletLedgerService.listEntries("seed-user"))[0]).toMatchObject({
      idempotencyKey: "purchase-911:winnings:purchase-911:credit",
      reference: {
        purchaseId: "purchase-911",
        requestId: "req-911",
        ticketId: "canonical:purchase-911",
        drawId: "draw-911"
      }
    });
  });
});

function createService(input?: {
  readonly ticketStore?: InMemoryTicketStore;
  readonly jobStore?: InMemoryWinningsCreditJobStore;
}): WinningsCreditService {
  const ticketStore = input?.ticketStore ?? new InMemoryTicketStore([]);
  const jobStore = input?.jobStore ?? new InMemoryWinningsCreditJobStore();
  const walletLedgerService = new WalletLedgerService({
    ledgerStore: new InMemoryLedgerStore(),
    timeSource: new FixedTimeSource("2026-04-21T09:00:00.000Z"),
    entryFactory: new SequentialEntryFactory()
  });

  const service = new WinningsCreditService({
    winningsCreditJobStore: jobStore,
    ticketStore,
    ticketClaimService: new TicketClaimService({ ticketStore }),
    walletLedgerService,
    timeSource: new FixedTimeSource("2026-04-21T09:05:00.000Z")
  });

  dependenciesByService.set(service, { walletLedgerService });
  return service;
}

function serviceDependencies(service: WinningsCreditService): {
  readonly walletLedgerService: WalletLedgerService;
} {
  const dependencies = dependenciesByService.get(service);
  if (!dependencies) {
    throw new Error("missing test dependencies");
  }
  return dependencies;
}

function createWinningTicket(requestId: string): TicketRecord {
  return applyTicketVerificationOutcome(
    createPurchasedTicketRecord({
      ticketId: `${requestId}:ticket`,
      requestId,
      userId: "seed-user",
      lotteryCode: "demo-lottery",
      drawId: `draw-${requestId.split("-").at(-1)}`,
      purchasedAt: "2026-04-21T08:55:00.000Z",
      externalReference: `ext-${requestId}`
    }),
    {
      verificationStatus: "verified",
      verificationEventId: `${requestId}:verify:1`,
      verifiedAt: "2026-04-21T08:59:00.000Z",
      rawTerminalOutput: "[terminal] win",
      winningAmountMinor: 4_500
    }
  );
}

const dependenciesByService = new WeakMap<
  WinningsCreditService,
  {
    readonly walletLedgerService: WalletLedgerService;
  }
>();

class InMemoryTicketStore implements TicketStore {
  private tickets: TicketRecord[];

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
    const filtered = this.tickets.filter((entry) => entry.ticketId !== ticket.ticketId);
    this.tickets = [...filtered, cloneTicket(ticket)];
  }

  async clearAll(): Promise<void> {}
}

class InMemoryWinningsCreditJobStore implements WinningsCreditJobStore {
  private jobs: WinningsCreditJob[] = [];

  async saveJob(job: WinningsCreditJob): Promise<void> {
    const filtered = this.jobs.filter((entry) => entry.jobId !== job.jobId);
    this.jobs = [...filtered, { ...job }];
  }

  async getJobByTicketId(ticketId: string): Promise<WinningsCreditJob | null> {
    return this.jobs.find((entry) => entry.ticketId === ticketId) ?? null;
  }

  async listJobs(): Promise<readonly WinningsCreditJob[]> {
    return this.jobs.map((job) => ({ ...job }));
  }

  async listQueuedJobs(): Promise<readonly WinningsCreditJob[]> {
    return this.jobs.filter((job) => job.status === "queued").map((job) => ({ ...job }));
  }

  async clearAll(): Promise<void> {
    this.jobs = [];
  }
}

class InMemoryLedgerStore implements LedgerStore {
  private entries: LedgerEntry[] = [];

  async listEntries(): Promise<readonly LedgerEntry[]> {
    return this.entries.map(cloneEntry);
  }

  async listEntriesByUser(userId: string): Promise<readonly LedgerEntry[]> {
    return this.entries.filter((entry) => entry.userId === userId).map(cloneEntry);
  }

  async appendEntry(entry: LedgerEntry): Promise<void> {
    this.entries = [...this.entries, cloneEntry(entry)];
  }

  async clearAll(): Promise<void> {}
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
