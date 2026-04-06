import type {
  PurchaseQueueItem,
  PurchaseQueueStore,
  PurchaseRequestStore,
  TerminalExecutionLock,
  TicketStore,
  TicketVerificationJobStore
} from "@lottery/application";
import {
  normalizeLotteryCode,
  type PurchaseRequestRecord,
  type TicketRecord,
  type TicketVerificationJob
} from "@lottery/domain";
import type { Pool } from "pg";
import { deepClone, last, normalizeText } from "./utils.js";

export class PostgresPurchaseRequestStore implements PurchaseRequestStore {
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async listRequests(): Promise<readonly PurchaseRequestRecord[]> {
    const result = await this.pool.query(
      `
        select record
        from lottery_purchase_requests
        order by created_at asc, request_id asc
      `
    );

    return result.rows.map((row: { record: PurchaseRequestRecord }) => deepClone(row.record));
  }

  async getRequestById(requestId: string): Promise<PurchaseRequestRecord | null> {
    const normalizedRequestId = normalizeText(requestId, "requestId");
    const result = await this.pool.query(
      `
        select record
        from lottery_purchase_requests
        where request_id = $1
        limit 1
      `,
      [normalizedRequestId]
    );

    const row = result.rows[0];
    return row ? deepClone(row.record as PurchaseRequestRecord) : null;
  }

  async saveRequest(record: PurchaseRequestRecord): Promise<void> {
    const normalizedRecord = normalizePurchaseRequestRecord(record);
    const updatedAt = last(normalizedRecord.journal)?.occurredAt ?? normalizedRecord.snapshot.createdAt;

    await this.pool.query(
      `
        insert into lottery_purchase_requests (
          request_id,
          user_id,
          state,
          created_at,
          updated_at,
          record
        ) values ($1, $2, $3, $4, $5, $6::jsonb)
        on conflict (request_id)
        do update
          set user_id = excluded.user_id,
              state = excluded.state,
              created_at = excluded.created_at,
              updated_at = excluded.updated_at,
              record = excluded.record
      `,
      [
        normalizedRecord.snapshot.requestId,
        normalizedRecord.snapshot.userId,
        normalizedRecord.state,
        normalizedRecord.snapshot.createdAt,
        updatedAt,
        JSON.stringify(normalizedRecord)
      ]
    );
  }
}

export class PostgresPurchaseQueueStore implements PurchaseQueueStore {
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async listQueueItems(): Promise<readonly PurchaseQueueItem[]> {
    const result = await this.pool.query(
      `
        select item
        from lottery_purchase_queue_items
        order by enqueued_at asc, request_id asc
      `
    );

    return result.rows.map((row: { item: PurchaseQueueItem }) => deepClone(row.item));
  }

  async getQueueItemByRequestId(requestId: string): Promise<PurchaseQueueItem | null> {
    const normalizedRequestId = normalizeText(requestId, "requestId");
    const result = await this.pool.query(
      `
        select item
        from lottery_purchase_queue_items
        where request_id = $1
        limit 1
      `,
      [normalizedRequestId]
    );

    const row = result.rows[0];
    return row ? deepClone(row.item as PurchaseQueueItem) : null;
  }

  async saveQueueItem(item: PurchaseQueueItem): Promise<void> {
    const normalizedItem = normalizeQueueItem(item);

    await this.pool.query(
      `
        insert into lottery_purchase_queue_items (
          request_id,
          status,
          priority,
          enqueued_at,
          item
        ) values ($1, $2, $3, $4, $5::jsonb)
        on conflict (request_id)
        do update
          set status = excluded.status,
              priority = excluded.priority,
              enqueued_at = excluded.enqueued_at,
              item = excluded.item
      `,
      [
        normalizedItem.requestId,
        normalizedItem.status,
        normalizedItem.priority,
        normalizedItem.enqueuedAt,
        JSON.stringify(normalizedItem)
      ]
    );
  }

  async removeQueueItem(requestId: string): Promise<void> {
    const normalizedRequestId = normalizeText(requestId, "requestId");
    await this.pool.query(
      `
        delete from lottery_purchase_queue_items
        where request_id = $1
      `,
      [normalizedRequestId]
    );
  }
}

export class PostgresTicketStore implements TicketStore {
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async listTickets(): Promise<readonly TicketRecord[]> {
    const result = await this.pool.query(
      `
        select ticket
        from lottery_tickets
        order by purchased_at asc, ticket_id asc
      `
    );

    return result.rows.map((row: { ticket: TicketRecord }) => deepClone(row.ticket));
  }

  async getTicketById(ticketId: string): Promise<TicketRecord | null> {
    const normalizedTicketId = normalizeText(ticketId, "ticketId");
    const result = await this.pool.query(
      `
        select ticket
        from lottery_tickets
        where ticket_id = $1
        limit 1
      `,
      [normalizedTicketId]
    );

    const row = result.rows[0];
    return row ? deepClone(row.ticket as TicketRecord) : null;
  }

  async getTicketByRequestId(requestId: string): Promise<TicketRecord | null> {
    const normalizedRequestId = normalizeText(requestId, "requestId");
    const result = await this.pool.query(
      `
        select ticket
        from lottery_tickets
        where request_id = $1
        limit 1
      `,
      [normalizedRequestId]
    );

    const row = result.rows[0];
    return row ? deepClone(row.ticket as TicketRecord) : null;
  }

  async saveTicket(ticket: TicketRecord): Promise<void> {
    const normalizedTicket = normalizeTicketRecord(ticket);

    await this.pool.query(
      `
        insert into lottery_tickets (
          ticket_id,
          request_id,
          user_id,
          verification_status,
          purchased_at,
          ticket
        ) values ($1, $2, $3, $4, $5, $6::jsonb)
        on conflict (ticket_id)
        do update
          set request_id = excluded.request_id,
              user_id = excluded.user_id,
              verification_status = excluded.verification_status,
              purchased_at = excluded.purchased_at,
              ticket = excluded.ticket
      `,
      [
        normalizedTicket.ticketId,
        normalizedTicket.requestId,
        normalizedTicket.userId,
        normalizedTicket.verificationStatus,
        normalizedTicket.purchasedAt,
        JSON.stringify(normalizedTicket)
      ]
    );
  }
}

export class PostgresTicketVerificationJobStore implements TicketVerificationJobStore {
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async listJobs(): Promise<readonly TicketVerificationJob[]> {
    const result = await this.pool.query(
      `
        select job
        from lottery_ticket_verification_jobs
        order by enqueued_at asc, job_id asc
      `
    );

    return result.rows.map((row: { job: TicketVerificationJob }) => deepClone(row.job));
  }

  async getJobById(jobId: string): Promise<TicketVerificationJob | null> {
    const normalizedJobId = normalizeText(jobId, "jobId");
    const result = await this.pool.query(
      `
        select job
        from lottery_ticket_verification_jobs
        where job_id = $1
        limit 1
      `,
      [normalizedJobId]
    );

    const row = result.rows[0];
    return row ? deepClone(row.job as TicketVerificationJob) : null;
  }

  async getJobByTicketId(ticketId: string): Promise<TicketVerificationJob | null> {
    const normalizedTicketId = normalizeText(ticketId, "ticketId");
    const result = await this.pool.query(
      `
        select job
        from lottery_ticket_verification_jobs
        where ticket_id = $1
        limit 1
      `,
      [normalizedTicketId]
    );

    const row = result.rows[0];
    return row ? deepClone(row.job as TicketVerificationJob) : null;
  }

  async saveJob(job: TicketVerificationJob): Promise<void> {
    const normalizedJob = normalizeTicketVerificationJob(job);

    await this.pool.query(
      `
        insert into lottery_ticket_verification_jobs (
          job_id,
          ticket_id,
          status,
          enqueued_at,
          updated_at,
          job
        ) values ($1, $2, $3, $4, $5, $6::jsonb)
        on conflict (job_id)
        do update
          set ticket_id = excluded.ticket_id,
              status = excluded.status,
              enqueued_at = excluded.enqueued_at,
              updated_at = excluded.updated_at,
              job = excluded.job
      `,
      [
        normalizedJob.jobId,
        normalizedJob.ticketId,
        normalizedJob.status,
        normalizedJob.enqueuedAt,
        normalizedJob.updatedAt,
        JSON.stringify(normalizedJob)
      ]
    );
  }
}

export interface PostgresTerminalExecutionLockOptions {
  readonly lockName?: string;
  readonly ttlSeconds?: number;
}

export class PostgresTerminalExecutionLock implements TerminalExecutionLock {
  private readonly pool: Pool;
  private readonly lockName: string;
  private readonly ttlSeconds: number;

  constructor(pool: Pool, options: PostgresTerminalExecutionLockOptions = {}) {
    this.pool = pool;
    this.lockName = normalizeText(options.lockName ?? "main-terminal", "lockName");
    const rawTtl = Math.trunc(options.ttlSeconds ?? 30);
    this.ttlSeconds = Number.isFinite(rawTtl) ? Math.max(5, rawTtl) : 30;
  }

  async acquire(ownerId: string): Promise<boolean> {
    const normalizedOwnerId = normalizeText(ownerId, "ownerId");

    const result = await this.pool.query(
      `
        insert into lottery_terminal_execution_locks (
          lock_name,
          owner_id,
          acquired_at,
          expires_at
        )
        values (
          $1,
          $2,
          now(),
          now() + make_interval(secs => $3)
        )
        on conflict (lock_name)
        do update
          set owner_id = excluded.owner_id,
              acquired_at = excluded.acquired_at,
              expires_at = excluded.expires_at
          where lottery_terminal_execution_locks.owner_id = excluded.owner_id
             or lottery_terminal_execution_locks.expires_at < now()
        returning owner_id
      `,
      [this.lockName, normalizedOwnerId, this.ttlSeconds]
    );

    return result.rowCount === 1;
  }

  async release(ownerId: string): Promise<void> {
    const normalizedOwnerId = normalizeText(ownerId, "ownerId");

    await this.pool.query(
      `
        delete from lottery_terminal_execution_locks
        where lock_name = $1 and owner_id = $2
      `,
      [this.lockName, normalizedOwnerId]
    );
  }
}

function normalizePurchaseRequestRecord(record: PurchaseRequestRecord): PurchaseRequestRecord {
  const cloned = deepClone(record);
  return {
    ...cloned,
    snapshot: {
      ...cloned.snapshot,
      requestId: normalizeText(cloned.snapshot.requestId, "record.snapshot.requestId"),
      userId: normalizeText(cloned.snapshot.userId, "record.snapshot.userId"),
      lotteryCode: normalizeLotteryCode(cloned.snapshot.lotteryCode),
      drawId: normalizeText(cloned.snapshot.drawId, "record.snapshot.drawId"),
      currency: normalizeText(cloned.snapshot.currency, "record.snapshot.currency").toUpperCase(),
      createdAt: toIsoString(cloned.snapshot.createdAt),
      payload: deepClone(cloned.snapshot.payload)
    },
    journal: cloned.journal.map((entry) => ({
      ...entry,
      eventId: normalizeText(entry.eventId, "record.journal.eventId"),
      occurredAt: toIsoString(entry.occurredAt)
    }))
  };
}

function normalizeQueueItem(item: PurchaseQueueItem): PurchaseQueueItem {
  return {
    ...deepClone(item),
    requestId: normalizeText(item.requestId, "queueItem.requestId"),
    lotteryCode: normalizeLotteryCode(item.lotteryCode),
    userId: normalizeText(item.userId, "queueItem.userId"),
    drawId: normalizeText(item.drawId, "queueItem.drawId"),
    attemptCount: Math.max(0, Math.trunc(item.attemptCount)),
    priority: item.priority,
    enqueuedAt: toIsoString(item.enqueuedAt),
    status: item.status
  };
}

function normalizeTicketRecord(ticket: TicketRecord): TicketRecord {
  return {
    ...deepClone(ticket),
    ticketId: normalizeText(ticket.ticketId, "ticket.ticketId"),
    requestId: normalizeText(ticket.requestId, "ticket.requestId"),
    userId: normalizeText(ticket.userId, "ticket.userId"),
    lotteryCode: normalizeLotteryCode(ticket.lotteryCode),
    drawId: normalizeText(ticket.drawId, "ticket.drawId"),
    purchasedAt: toIsoString(ticket.purchasedAt)
  };
}

function normalizeTicketVerificationJob(job: TicketVerificationJob): TicketVerificationJob {
  return {
    ...deepClone(job),
    jobId: normalizeText(job.jobId, "job.jobId"),
    ticketId: normalizeText(job.ticketId, "job.ticketId"),
    requestId: normalizeText(job.requestId, "job.requestId"),
    lotteryCode: normalizeLotteryCode(job.lotteryCode),
    drawId: normalizeText(job.drawId, "job.drawId"),
    externalReference: normalizeText(job.externalReference, "job.externalReference"),
    enqueuedAt: toIsoString(job.enqueuedAt),
    updatedAt: toIsoString(job.updatedAt)
  };
}

function toIsoString(value: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new Error(`Invalid ISO timestamp: ${value}`);
  }

  return new Date(timestamp).toISOString();
}
