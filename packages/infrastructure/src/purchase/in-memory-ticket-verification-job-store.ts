import type { TicketVerificationJobStore } from "@lottery/application";
import type { TicketVerificationJob } from "@lottery/domain";

export class InMemoryTicketVerificationJobStore implements TicketVerificationJobStore {
  private jobs: TicketVerificationJob[];

  constructor(initialJobs: readonly TicketVerificationJob[] = []) {
    this.jobs = initialJobs.map(cloneJob);
  }

  async listJobs(): Promise<readonly TicketVerificationJob[]> {
    return this.jobs
      .map(cloneJob)
      .sort((left, right) => compareJobs(left, right));
  }

  async getJobById(jobId: string): Promise<TicketVerificationJob | null> {
    const normalized = jobId.trim();
    const job = this.jobs.find((entry) => entry.jobId === normalized) ?? null;
    return job ? cloneJob(job) : null;
  }

  async getJobByTicketId(ticketId: string): Promise<TicketVerificationJob | null> {
    const normalized = ticketId.trim();
    const job = this.jobs.find((entry) => entry.ticketId === normalized) ?? null;
    return job ? cloneJob(job) : null;
  }

  async saveJob(job: TicketVerificationJob): Promise<void> {
    const filtered = this.jobs.filter((entry) => entry.jobId !== job.jobId);
    this.jobs = [...filtered, cloneJob(job)];
  }
}

function compareJobs(left: TicketVerificationJob, right: TicketVerificationJob): number {
  const byTime = left.enqueuedAt.localeCompare(right.enqueuedAt);
  if (byTime !== 0) {
    return byTime;
  }
  return left.jobId.localeCompare(right.jobId);
}

function cloneJob(job: TicketVerificationJob): TicketVerificationJob {
  return {
    ...job
  };
}
