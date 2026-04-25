import type { WinningsCreditJob } from "@lottery/domain";

export interface WinningsCreditJobStore {
  saveJob(job: WinningsCreditJob): Promise<void>;
  getJobByTicketId(ticketId: string): Promise<WinningsCreditJob | null>;
  listJobs(): Promise<readonly WinningsCreditJob[]>;
  listQueuedJobs(): Promise<readonly WinningsCreditJob[]>;
  clearAll(): Promise<void>;
}
