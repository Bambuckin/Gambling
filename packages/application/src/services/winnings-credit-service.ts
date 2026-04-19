import {
  completeWinningsCreditJob,
  createWinningsCreditJob,
  failWinningsCreditJob,
  startWinningsCreditJob,
  type WinningsCreditJob
} from "@lottery/domain";
import type { TicketClaimService } from "./ticket-claim-service.js";
import type { WinningsCreditJobStore } from "../ports/winnings-credit-job-store.js";
import type { WalletLedgerService } from "./wallet-ledger-service.js";
import type { TicketStore } from "../ports/ticket-store.js";
import type { TimeSource } from "../ports/time-source.js";

export interface WinningsCreditServiceDependencies {
  readonly winningsCreditJobStore: WinningsCreditJobStore;
  readonly ticketStore: TicketStore;
  readonly ticketClaimService: TicketClaimService;
  readonly walletLedgerService: WalletLedgerService;
  readonly timeSource: TimeSource;
}

export class WinningsCreditService {
  private readonly winningsCreditJobStore: WinningsCreditJobStore;
  private readonly ticketStore: TicketStore;
  private readonly ticketClaimService: TicketClaimService;
  private readonly walletLedgerService: WalletLedgerService;
  private readonly timeSource: TimeSource;

  constructor(dependencies: WinningsCreditServiceDependencies) {
    this.winningsCreditJobStore = dependencies.winningsCreditJobStore;
    this.ticketStore = dependencies.ticketStore;
    this.ticketClaimService = dependencies.ticketClaimService;
    this.walletLedgerService = dependencies.walletLedgerService;
    this.timeSource = dependencies.timeSource;
  }

  async enqueueCreditJob(input: {
    readonly ticketId: string;
    readonly userId: string;
    readonly winningAmountMinor: number;
    readonly currency: string;
  }): Promise<WinningsCreditJob> {
    const existing = await this.winningsCreditJobStore.getJobByTicketId(input.ticketId);
    if (existing) {
      return existing;
    }

    await this.ticketClaimService.startCreditClaim(input.ticketId);

    const nowIso = this.timeSource.nowIso();
    const job = createWinningsCreditJob({
      jobId: `${input.ticketId}:credit`,
      ticketId: input.ticketId,
      userId: input.userId,
      winningAmountMinor: input.winningAmountMinor,
      currency: input.currency,
      createdAt: nowIso
    });

    await this.winningsCreditJobStore.saveJob(job);
    return job;
  }

  async processNextCreditJob(): Promise<{
    readonly job: WinningsCreditJob;
    readonly credited: boolean;
  } | null> {
    const queued = await this.winningsCreditJobStore.listQueuedJobs();
    if (queued.length === 0) {
      return null;
    }

    const job = queued[0]!;
    const started = startWinningsCreditJob(job);
    await this.winningsCreditJobStore.saveJob(started);

    try {
      const ticket = await this.ticketStore.getTicketById(job.ticketId);
      if (!ticket) {
        throw new Error(`ticket "${job.ticketId}" not found for credit job`);
      }

      await this.walletLedgerService.creditWinnings({
        userId: job.userId,
        requestId: ticket.requestId,
        ticketId: job.ticketId,
        verificationEventId: `${job.ticketId}:admin-resolve`,
        amountMinor: job.winningAmountMinor,
        currency: job.currency,
        drawId: ticket.drawId
      });

      const nowIso = this.timeSource.nowIso();
      const completed = completeWinningsCreditJob(started, nowIso);
      await this.winningsCreditJobStore.saveJob(completed);

      await this.ticketClaimService.markTicketCredited(job.ticketId);

      return { job: completed, credited: true };
    } catch (error) {
      const nowIso = this.timeSource.nowIso();
      const message = error instanceof Error ? error.message : String(error);
      const failed = failWinningsCreditJob(started, message, nowIso);
      await this.winningsCreditJobStore.saveJob(failed);
      return { job: failed, credited: false };
    }
  }

  async listQueuedJobs(): Promise<readonly WinningsCreditJob[]> {
    return this.winningsCreditJobStore.listQueuedJobs();
  }
}
