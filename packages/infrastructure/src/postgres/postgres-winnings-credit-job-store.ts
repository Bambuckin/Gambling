import type { WinningsCreditJob } from "@lottery/domain";
import type { WinningsCreditJobStore } from "@lottery/application";
import type { Pool } from "pg";
import { deepClone, normalizeText } from "../postgres/utils.js";

export class PostgresWinningsCreditJobStore implements WinningsCreditJobStore {
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async saveJob(job: WinningsCreditJob): Promise<void> {
    const normalizedJob = {
      ...deepClone(job),
      jobId: normalizeText(job.jobId, "job.jobId"),
      ticketId: normalizeText(job.ticketId, "job.ticketId"),
      userId: normalizeText(job.userId, "job.userId")
    };

    await this.pool.query(
      `
        insert into lottery_winnings_credit_jobs (
          job_id,
          ticket_id,
          user_id,
          status,
          created_at,
          job
        ) values ($1, $2, $3, $4, $5, $6::jsonb)
        on conflict (job_id)
        do update
          set ticket_id = excluded.ticket_id,
              user_id = excluded.user_id,
              status = excluded.status,
              created_at = excluded.created_at,
              job = excluded.job
      `,
      [
        normalizedJob.jobId,
        normalizedJob.ticketId,
        normalizedJob.userId,
        normalizedJob.status,
        normalizedJob.createdAt,
        JSON.stringify(normalizedJob)
      ]
    );
  }

  async getJobByTicketId(ticketId: string): Promise<WinningsCreditJob | null> {
    const normalizedTicketId = normalizeText(ticketId, "ticketId");
    const result = await this.pool.query(
      `
        select job
        from lottery_winnings_credit_jobs
        where ticket_id = $1
        limit 1
      `,
      [normalizedTicketId]
    );

    const row = result.rows[0];
    return row ? deepClone(row.job as WinningsCreditJob) : null;
  }

  async listJobs(): Promise<readonly WinningsCreditJob[]> {
    const result = await this.pool.query(
      `
        select job
        from lottery_winnings_credit_jobs
        order by created_at desc, job_id desc
      `
    );

    return result.rows.map((row: { job: WinningsCreditJob }) => deepClone(row.job));
  }

  async listQueuedJobs(): Promise<readonly WinningsCreditJob[]> {
    const result = await this.pool.query(
      `
        select job
        from lottery_winnings_credit_jobs
        where status = 'queued'
        order by created_at asc, job_id asc
      `
    );

    return result.rows.map((row: { job: WinningsCreditJob }) => deepClone(row.job));
  }

  async clearAll(): Promise<void> {
    await this.pool.query("delete from lottery_winnings_credit_jobs");
  }
}
