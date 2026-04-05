import type { TicketVerificationJob } from "@lottery/domain";

export interface TicketVerificationJobStore {
  listJobs(): Promise<readonly TicketVerificationJob[]>;
  getJobById(jobId: string): Promise<TicketVerificationJob | null>;
  getJobByTicketId(ticketId: string): Promise<TicketVerificationJob | null>;
  saveJob(job: TicketVerificationJob): Promise<void>;
}
