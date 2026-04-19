import type { WinningsCreditJob } from "@lottery/domain";
import type { WinningsCreditJobStore } from "@lottery/application";

export class InMemoryWinningsCreditJobStore implements WinningsCreditJobStore {
  private jobs: WinningsCreditJob[] = [];

  async saveJob(job: WinningsCreditJob): Promise<void> {
    const filtered = this.jobs.filter((j) => j.jobId !== job.jobId);
    this.jobs = [...filtered, { ...job }];
  }

  async getJobByTicketId(ticketId: string): Promise<WinningsCreditJob | null> {
    return this.jobs.find((j) => j.ticketId === ticketId) ?? null;
  }

  async listQueuedJobs(): Promise<readonly WinningsCreditJob[]> {
    return this.jobs.filter((j) => j.status === "queued");
  }

  async clearAll(): Promise<void> {
    this.jobs = [];
  }
}
