import {
  completeTicketVerificationJob,
  createTicketVerificationJob,
  failTicketVerificationJob,
  isTicketPendingVerification,
  reserveTicketVerificationJob,
  type TicketVerificationJob
} from "@lottery/domain";
import type { TicketStore } from "../ports/ticket-store.js";
import type { TicketVerificationJobStore } from "../ports/ticket-verification-job-store.js";
import type { TimeSource } from "../ports/time-source.js";

export interface TicketVerificationQueueServiceDependencies {
  readonly ticketStore: TicketStore;
  readonly jobStore: TicketVerificationJobStore;
  readonly timeSource: TimeSource;
}

export interface EnqueuePendingVerificationTicketsResult {
  readonly pendingCount: number;
  readonly enqueuedCount: number;
  readonly skippedCount: number;
}

export interface ReserveNextVerificationJobInput {
  readonly workerId: string;
}

export class TicketVerificationQueueService {
  private readonly ticketStore: TicketStore;
  private readonly jobStore: TicketVerificationJobStore;
  private readonly timeSource: TimeSource;

  constructor(dependencies: TicketVerificationQueueServiceDependencies) {
    this.ticketStore = dependencies.ticketStore;
    this.jobStore = dependencies.jobStore;
    this.timeSource = dependencies.timeSource;
  }

  async enqueuePendingVerificationTickets(): Promise<EnqueuePendingVerificationTicketsResult> {
    const tickets = await this.ticketStore.listTickets();
    const pendingTickets = tickets.filter((ticket) => isTicketPendingVerification(ticket));
    let enqueuedCount = 0;
    let skippedCount = 0;

    for (const ticket of pendingTickets) {
      const existing = await this.jobStore.getJobByTicketId(ticket.ticketId);
      if (existing) {
        skippedCount += 1;
        continue;
      }

      const nowIso = this.timeSource.nowIso();
      const job = createTicketVerificationJob({
        ticketId: ticket.ticketId,
        requestId: ticket.requestId,
        lotteryCode: ticket.lotteryCode,
        drawId: ticket.drawId,
        externalReference: ticket.externalReference,
        enqueuedAt: nowIso
      });
      await this.jobStore.saveJob(job);
      enqueuedCount += 1;
    }

    return {
      pendingCount: pendingTickets.length,
      enqueuedCount,
      skippedCount
    };
  }

  async reserveNextVerificationJob(input: ReserveNextVerificationJobInput): Promise<TicketVerificationJob | null> {
    normalizeWorkerId(input.workerId);
    const jobs = await this.jobStore.listJobs();
    const nextQueuedJob = jobs
      .filter((job) => job.status === "queued")
      .sort((left, right) => compareJobs(left, right))
      .at(0);
    if (!nextQueuedJob) {
      return null;
    }

    const reserved = reserveTicketVerificationJob(nextQueuedJob, this.timeSource.nowIso());
    await this.jobStore.saveJob(reserved);
    return reserved;
  }

  async markVerificationJobDone(
    jobId: string,
    input: {
      readonly rawTerminalOutput: string;
    }
  ): Promise<TicketVerificationJob | null> {
    const normalizedJobId = normalizeJobId(jobId);
    const existing = await this.jobStore.getJobById(normalizedJobId);
    if (!existing) {
      return null;
    }

    const completed = completeTicketVerificationJob(existing, {
      updatedAt: this.timeSource.nowIso(),
      rawTerminalOutput: input.rawTerminalOutput
    });
    await this.jobStore.saveJob(completed);
    return completed;
  }

  async markVerificationJobError(
    jobId: string,
    input: {
      readonly error: string;
      readonly rawTerminalOutput?: string | null;
    }
  ): Promise<TicketVerificationJob | null> {
    const normalizedJobId = normalizeJobId(jobId);
    const existing = await this.jobStore.getJobById(normalizedJobId);
    if (!existing) {
      return null;
    }

    const failed = failTicketVerificationJob(existing, {
      updatedAt: this.timeSource.nowIso(),
      error: input.error,
      rawTerminalOutput: input.rawTerminalOutput ?? null
    });
    await this.jobStore.saveJob(failed);
    return failed;
  }
}

function compareJobs(left: TicketVerificationJob, right: TicketVerificationJob): number {
  const byTime = left.enqueuedAt.localeCompare(right.enqueuedAt);
  if (byTime !== 0) {
    return byTime;
  }

  return left.jobId.localeCompare(right.jobId);
}

function normalizeWorkerId(workerId: string): string {
  const normalized = workerId.trim();
  if (!normalized) {
    throw new Error("workerId is required");
  }
  return normalized;
}

function normalizeJobId(jobId: string): string {
  const normalized = jobId.trim();
  if (!normalized) {
    throw new Error("jobId is required");
  }
  return normalized;
}
