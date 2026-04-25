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

type WinningsLedgerWriter = Pick<WalletLedgerService, "creditWinnings">;

export interface WinningsCreditServiceDependencies {
  readonly winningsCreditJobStore: WinningsCreditJobStore;
  readonly ticketStore: TicketStore;
  readonly ticketClaimService: TicketClaimService;
  readonly walletLedgerService: WinningsLedgerWriter;
  readonly timeSource: TimeSource;
}

export class WinningsCreditService {
  private readonly winningsCreditJobStore: WinningsCreditJobStore;
  private readonly ticketStore: TicketStore;
  private readonly ticketClaimService: TicketClaimService;
  private readonly walletLedgerService: WinningsLedgerWriter;
  private readonly timeSource: TimeSource;

  constructor(dependencies: WinningsCreditServiceDependencies) {
    this.winningsCreditJobStore = dependencies.winningsCreditJobStore;
    this.ticketStore = dependencies.ticketStore;
    this.ticketClaimService = dependencies.ticketClaimService;
    this.walletLedgerService = dependencies.walletLedgerService;
    this.timeSource = dependencies.timeSource;
  }

  async enqueueCreditJob(input: {
    readonly requestId: string;
    readonly purchaseId: string;
    readonly ticketId: string;
    readonly userId: string;
    readonly drawId: string;
    readonly winningAmountMinor: number;
    readonly currency: string;
  }): Promise<WinningsCreditJob> {
    const existing = await this.winningsCreditJobStore.getJobByTicketId(input.ticketId);
    if (existing) {
      return existing;
    }

    await this.startCreditClaimIfLegacyTicketExists(input.ticketId);

    const nowIso = this.timeSource.nowIso();
    const job = createWinningsCreditJob({
      jobId: `${input.purchaseId}:credit`,
      requestId: input.requestId,
      purchaseId: input.purchaseId,
      ticketId: input.ticketId,
      userId: input.userId,
      drawId: input.drawId,
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

    return this.processCreditJob(queued[0]!);
  }

  async processCreditJobForTicket(ticketId: string): Promise<{
    readonly job: WinningsCreditJob;
    readonly credited: boolean;
  } | null> {
    const normalizedTicketId = ticketId.trim();
    if (!normalizedTicketId) {
      return null;
    }

    const job = await this.winningsCreditJobStore.getJobByTicketId(normalizedTicketId);
    if (!job || job.status !== "queued") {
      return null;
    }

    return this.processCreditJob(job);
  }

  private async processCreditJob(job: WinningsCreditJob): Promise<{
    readonly job: WinningsCreditJob;
    readonly credited: boolean;
  }> {
    const started = startWinningsCreditJob(job);
    await this.winningsCreditJobStore.saveJob(started);

    try {
      await this.walletLedgerService.creditWinnings({
        userId: job.userId,
        purchaseId: job.purchaseId,
        requestId: job.requestId,
        ticketId: job.ticketId,
        sourceEventId: job.jobId,
        verificationEventId: job.jobId,
        amountMinor: job.winningAmountMinor,
        currency: job.currency,
        drawId: job.drawId
      });

      const nowIso = this.timeSource.nowIso();
      const completed = completeWinningsCreditJob(started, nowIso);
      await this.winningsCreditJobStore.saveJob(completed);

      await this.markTicketCreditedIfLegacyTicketExists(job.ticketId);

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

  async listJobs(): Promise<readonly WinningsCreditJob[]> {
    return this.winningsCreditJobStore.listJobs();
  }

  private async startCreditClaimIfLegacyTicketExists(ticketId: string): Promise<void> {
    const ticket = await this.ticketStore.getTicketById(ticketId);
    if (!ticket) {
      return;
    }

    await this.ticketClaimService.startCreditClaim(ticketId);
  }

  private async markTicketCreditedIfLegacyTicketExists(ticketId: string): Promise<void> {
    const ticket = await this.ticketStore.getTicketById(ticketId);
    if (!ticket) {
      return;
    }

    await this.ticketClaimService.markTicketCredited(ticketId);
  }
}
