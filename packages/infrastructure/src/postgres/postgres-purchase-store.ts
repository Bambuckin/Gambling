import type {
  CanonicalDrawStore,
  CanonicalPurchaseStore,
  CashDeskRequestStore,
  NotificationStore,
  PurchaseAttemptStore,
  PurchaseQueueItem,
  PurchaseQueueStore,
  PurchaseRequestStore,
  TerminalExecutionLock,
  TicketStore,
  TicketVerificationJobStore
} from "@lottery/application";
import {
  type CanonicalDrawRecord,
  type CanonicalPurchaseJournalEntry,
  type CanonicalPurchaseRecord,
  normalizeLotteryCode,
  type CashDeskRequest,
  type NotificationRecord,
  type PurchaseAttemptRecord,
  type PurchaseRequestRecord,
  type TicketRecord,
  type TicketVerificationJob
} from "@lottery/domain";
import type { Pool } from "pg";
import { deepClone, last, normalizeText, optionalNormalizedText } from "./utils.js";

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

  async clearAll(): Promise<void> {
    await this.pool.query("delete from lottery_purchase_requests");
  }
}

export class PostgresCanonicalPurchaseStore implements CanonicalPurchaseStore {
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async listPurchases(): Promise<readonly CanonicalPurchaseRecord[]> {
    const result = await this.pool.query(
      `
        select record
        from lottery_purchases
        order by submitted_at asc, purchase_id asc
      `
    );

    return result.rows.map((row: { record: CanonicalPurchaseRecord }) => deepClone(row.record));
  }

  async getPurchaseById(purchaseId: string): Promise<CanonicalPurchaseRecord | null> {
    const normalizedPurchaseId = normalizeText(purchaseId, "purchaseId");
    const result = await this.pool.query(
      `
        select record
        from lottery_purchases
        where purchase_id = $1
        limit 1
      `,
      [normalizedPurchaseId]
    );

    const row = result.rows[0];
    return row ? deepClone(row.record as CanonicalPurchaseRecord) : null;
  }

  async getPurchaseByLegacyRequestId(legacyRequestId: string): Promise<CanonicalPurchaseRecord | null> {
    const normalizedLegacyRequestId = normalizeText(legacyRequestId, "legacyRequestId");
    const result = await this.pool.query(
      `
        select record
        from lottery_purchases
        where legacy_request_id = $1
        limit 1
      `,
      [normalizedLegacyRequestId]
    );

    const row = result.rows[0];
    return row ? deepClone(row.record as CanonicalPurchaseRecord) : null;
  }

  async savePurchase(record: CanonicalPurchaseRecord): Promise<void> {
    const normalizedRecord = normalizeCanonicalPurchaseRecord(record);
    const updatedAt =
      last(normalizedRecord.journal)?.occurredAt ??
      normalizedRecord.settledAt ??
      normalizedRecord.purchasedAt ??
      normalizedRecord.snapshot.submittedAt;

    await this.pool.query(
      `
        insert into lottery_purchases (
          purchase_id,
          legacy_request_id,
          user_id,
          lottery_code,
          draw_id,
          status,
          result_status,
          result_visibility,
          submitted_at,
          updated_at,
          purchased_at,
          settled_at,
          record
        ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb)
        on conflict (purchase_id)
        do update
          set legacy_request_id = excluded.legacy_request_id,
              user_id = excluded.user_id,
              lottery_code = excluded.lottery_code,
              draw_id = excluded.draw_id,
              status = excluded.status,
              result_status = excluded.result_status,
              result_visibility = excluded.result_visibility,
              submitted_at = excluded.submitted_at,
              updated_at = excluded.updated_at,
              purchased_at = excluded.purchased_at,
              settled_at = excluded.settled_at,
              record = excluded.record
      `,
      [
        normalizedRecord.snapshot.purchaseId,
        normalizedRecord.snapshot.legacyRequestId,
        normalizedRecord.snapshot.userId,
        normalizedRecord.snapshot.lotteryCode,
        normalizedRecord.snapshot.drawId,
        normalizedRecord.status,
        normalizedRecord.resultStatus,
        normalizedRecord.resultVisibility,
        normalizedRecord.snapshot.submittedAt,
        updatedAt,
        normalizedRecord.purchasedAt,
        normalizedRecord.settledAt,
        JSON.stringify(normalizedRecord)
      ]
    );
  }

  async clearAll(): Promise<void> {
    await this.pool.query("delete from lottery_purchases");
  }
}

export class PostgresCanonicalDrawStore implements CanonicalDrawStore {
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async listDraws(lotteryCode?: string): Promise<readonly CanonicalDrawRecord[]> {
    if (typeof lotteryCode === "string" && lotteryCode.trim()) {
      const normalizedLotteryCode = normalizeLotteryCode(lotteryCode);
      const result = await this.pool.query(
        `
          select record
          from lottery_draws
          where lottery_code = $1
          order by draw_at asc, draw_id asc
        `,
        [normalizedLotteryCode]
      );

      return result.rows.map((row: { record: CanonicalDrawRecord }) => deepClone(row.record));
    }

    const result = await this.pool.query(
      `
        select record
        from lottery_draws
        order by draw_at asc, lottery_code asc, draw_id asc
      `
    );

    return result.rows.map((row: { record: CanonicalDrawRecord }) => deepClone(row.record));
  }

  async getDraw(lotteryCode: string, drawId: string): Promise<CanonicalDrawRecord | null> {
    const normalizedLotteryCode = normalizeLotteryCode(lotteryCode);
    const normalizedDrawId = normalizeText(drawId, "drawId");
    const result = await this.pool.query(
      `
        select record
        from lottery_draws
        where lottery_code = $1 and draw_id = $2
        limit 1
      `,
      [normalizedLotteryCode, normalizedDrawId]
    );

    const row = result.rows[0];
    return row ? deepClone(row.record as CanonicalDrawRecord) : null;
  }

  async saveDraw(record: CanonicalDrawRecord): Promise<void> {
    const normalizedRecord = normalizeCanonicalDrawRecord(record);
    const updatedAt = normalizedRecord.settledAt ?? normalizedRecord.closedAt ?? normalizedRecord.openedAt;

    await this.pool.query(
      `
        insert into lottery_draws (
          lottery_code,
          draw_id,
          draw_at,
          status,
          result_visibility,
          opened_at,
          closed_at,
          settled_at,
          updated_at,
          record
        ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
        on conflict (lottery_code, draw_id)
        do update
          set draw_at = excluded.draw_at,
              status = excluded.status,
              result_visibility = excluded.result_visibility,
              opened_at = excluded.opened_at,
              closed_at = excluded.closed_at,
              settled_at = excluded.settled_at,
              updated_at = excluded.updated_at,
              record = excluded.record
      `,
      [
        normalizedRecord.lotteryCode,
        normalizedRecord.drawId,
        normalizedRecord.drawAt,
        normalizedRecord.status,
        normalizedRecord.resultVisibility,
        normalizedRecord.openedAt,
        normalizedRecord.closedAt,
        normalizedRecord.settledAt,
        updatedAt,
        JSON.stringify(normalizedRecord)
      ]
    );
  }

  async clearAll(): Promise<void> {
    await this.pool.query("delete from lottery_draws");
  }
}

export class PostgresPurchaseAttemptStore implements PurchaseAttemptStore {
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async listAttemptsByPurchaseId(purchaseId: string): Promise<readonly PurchaseAttemptRecord[]> {
    const normalizedPurchaseId = normalizeText(purchaseId, "purchaseId");
    const result = await this.pool.query(
      `
        select record
        from lottery_purchase_attempts
        where purchase_id = $1
        order by attempt_number asc, attempt_id asc
      `,
      [normalizedPurchaseId]
    );

    return result.rows.map((row: { record: PurchaseAttemptRecord }) => deepClone(row.record));
  }

  async listAttemptsByLegacyRequestId(legacyRequestId: string): Promise<readonly PurchaseAttemptRecord[]> {
    const normalizedLegacyRequestId = normalizeText(legacyRequestId, "legacyRequestId");
    const result = await this.pool.query(
      `
        select record
        from lottery_purchase_attempts
        where legacy_request_id = $1
        order by attempt_number asc, attempt_id asc
      `,
      [normalizedLegacyRequestId]
    );

    return result.rows.map((row: { record: PurchaseAttemptRecord }) => deepClone(row.record));
  }

  async getAttemptById(attemptId: string): Promise<PurchaseAttemptRecord | null> {
    const normalizedAttemptId = normalizeText(attemptId, "attemptId");
    const result = await this.pool.query(
      `
        select record
        from lottery_purchase_attempts
        where attempt_id = $1
        limit 1
      `,
      [normalizedAttemptId]
    );

    const row = result.rows[0];
    return row ? deepClone(row.record as PurchaseAttemptRecord) : null;
  }

  async saveAttempt(record: PurchaseAttemptRecord): Promise<void> {
    const normalizedRecord = normalizePurchaseAttemptRecord(record);

    await this.pool.query(
      `
        insert into lottery_purchase_attempts (
          attempt_id,
          purchase_id,
          legacy_request_id,
          attempt_number,
          outcome,
          started_at,
          finished_at,
          external_ticket_reference,
          error_message,
          record
        ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
        on conflict (attempt_id)
        do update
          set purchase_id = excluded.purchase_id,
              legacy_request_id = excluded.legacy_request_id,
              attempt_number = excluded.attempt_number,
              outcome = excluded.outcome,
              started_at = excluded.started_at,
              finished_at = excluded.finished_at,
              external_ticket_reference = excluded.external_ticket_reference,
              error_message = excluded.error_message,
              record = excluded.record
      `,
      [
        normalizedRecord.attemptId,
        normalizedRecord.purchaseId,
        normalizedRecord.legacyRequestId,
        normalizedRecord.attemptNumber,
        normalizedRecord.outcome,
        normalizedRecord.startedAt,
        normalizedRecord.finishedAt,
        normalizedRecord.externalTicketReference,
        normalizedRecord.errorMessage,
        JSON.stringify(normalizedRecord)
      ]
    );
  }

  async clearAll(): Promise<void> {
    await this.pool.query("delete from lottery_purchase_attempts");
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

  async clearAll(): Promise<void> {
    await this.pool.query("delete from lottery_purchase_queue_items");
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

  async clearAll(): Promise<void> {
    await this.pool.query("delete from lottery_tickets");
  }
}

export class PostgresNotificationStore implements NotificationStore {
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async saveNotification(notification: NotificationRecord): Promise<void> {
    const normalizedNotification = normalizeNotificationRecord(notification);

    await this.pool.query(
      `
        insert into lottery_notifications (
          notification_id,
          user_id,
          type,
          read,
          created_at,
          notification
        ) values ($1, $2, $3, $4, $5, $6::jsonb)
        on conflict (notification_id)
        do update
          set user_id = excluded.user_id,
              type = excluded.type,
              read = excluded.read,
              created_at = excluded.created_at,
              notification = excluded.notification
      `,
      [
        normalizedNotification.notificationId,
        normalizedNotification.userId,
        normalizedNotification.type,
        normalizedNotification.read,
        normalizedNotification.createdAt,
        JSON.stringify(normalizedNotification)
      ]
    );
  }

  async listUserNotifications(userId: string): Promise<readonly NotificationRecord[]> {
    const normalizedUserId = normalizeText(userId, "userId");
    const result = await this.pool.query(
      `
        select notification
        from lottery_notifications
        where user_id = $1
        order by created_at desc, notification_id desc
      `,
      [normalizedUserId]
    );

    return result.rows.map((row: { notification: NotificationRecord }) => deepClone(row.notification));
  }

  async getNotificationById(notificationId: string): Promise<NotificationRecord | null> {
    const normalizedNotificationId = normalizeText(notificationId, "notificationId");
    const result = await this.pool.query(
      `
        select notification
        from lottery_notifications
        where notification_id = $1
        limit 1
      `,
      [normalizedNotificationId]
    );

    const row = result.rows[0];
    return row ? deepClone(row.notification as NotificationRecord) : null;
  }

  async markNotificationRead(notificationId: string): Promise<void> {
    const normalizedNotificationId = normalizeText(notificationId, "notificationId");
    const existing = await this.getNotificationById(normalizedNotificationId);
    if (!existing || existing.read) {
      return;
    }

    const nextNotification: NotificationRecord = {
      ...existing,
      read: true
    };

    await this.saveNotification(nextNotification);
  }

  async clearAll(): Promise<void> {
    await this.pool.query("delete from lottery_notifications");
  }
}

export class PostgresCashDeskRequestStore implements CashDeskRequestStore {
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async saveCashDeskRequest(request: CashDeskRequest): Promise<void> {
    const normalizedRequest = normalizeCashDeskRequest(request);

    await this.pool.query(
      `
        insert into lottery_cash_desk_requests (
          cash_desk_request_id,
          ticket_id,
          user_id,
          lottery_code,
          draw_id,
          status,
          created_at,
          request
        ) values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
        on conflict (cash_desk_request_id)
        do update
          set ticket_id = excluded.ticket_id,
              user_id = excluded.user_id,
              lottery_code = excluded.lottery_code,
              draw_id = excluded.draw_id,
              status = excluded.status,
              created_at = excluded.created_at,
              request = excluded.request
      `,
      [
        normalizedRequest.cashDeskRequestId,
        normalizedRequest.ticketId,
        normalizedRequest.userId,
        normalizedRequest.lotteryCode,
        normalizedRequest.drawId,
        normalizedRequest.status,
        normalizedRequest.createdAt,
        JSON.stringify(normalizedRequest)
      ]
    );
  }

  async getCashDeskRequestById(cashDeskRequestId: string): Promise<CashDeskRequest | null> {
    const normalizedRequestId = normalizeText(cashDeskRequestId, "cashDeskRequestId");
    const result = await this.pool.query(
      `
        select request
        from lottery_cash_desk_requests
        where cash_desk_request_id = $1
        limit 1
      `,
      [normalizedRequestId]
    );

    const row = result.rows[0];
    return row ? deepClone(row.request as CashDeskRequest) : null;
  }

  async getCashDeskRequestByTicketId(ticketId: string): Promise<CashDeskRequest | null> {
    const normalizedTicketId = normalizeText(ticketId, "ticketId");
    const result = await this.pool.query(
      `
        select request
        from lottery_cash_desk_requests
        where ticket_id = $1
        limit 1
      `,
      [normalizedTicketId]
    );

    const row = result.rows[0];
    return row ? deepClone(row.request as CashDeskRequest) : null;
  }

  async listCashDeskRequests(): Promise<readonly CashDeskRequest[]> {
    const result = await this.pool.query(
      `
        select request
        from lottery_cash_desk_requests
        order by created_at desc, cash_desk_request_id desc
      `
    );

    return result.rows.map((row: { request: CashDeskRequest }) => deepClone(row.request));
  }

  async clearAll(): Promise<void> {
    await this.pool.query("delete from lottery_cash_desk_requests");
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

  async clearAll(): Promise<void> {
    await this.pool.query(
      `
        delete from lottery_terminal_execution_locks
        where lock_name = $1
      `,
      [this.lockName]
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

function normalizeCanonicalPurchaseRecord(record: CanonicalPurchaseRecord): CanonicalPurchaseRecord {
  const cloned = deepClone(record);

  return {
    ...cloned,
    snapshot: {
      ...cloned.snapshot,
      purchaseId: normalizeText(cloned.snapshot.purchaseId, "record.snapshot.purchaseId"),
      legacyRequestId: optionalNormalizedText(cloned.snapshot.legacyRequestId) ?? null,
      userId: normalizeText(cloned.snapshot.userId, "record.snapshot.userId"),
      lotteryCode: normalizeLotteryCode(cloned.snapshot.lotteryCode),
      drawId: normalizeText(cloned.snapshot.drawId, "record.snapshot.drawId"),
      currency: normalizeText(cloned.snapshot.currency, "record.snapshot.currency").toUpperCase(),
      submittedAt: toIsoString(cloned.snapshot.submittedAt),
      payload: deepClone(cloned.snapshot.payload)
    },
    purchasedAt: optionalNormalizedText(cloned.purchasedAt) ? toIsoString(cloned.purchasedAt!) : null,
    settledAt: optionalNormalizedText(cloned.settledAt) ? toIsoString(cloned.settledAt!) : null,
    externalTicketReference: optionalNormalizedText(cloned.externalTicketReference) ?? null,
    journal: cloned.journal.map(normalizeCanonicalPurchaseJournalEntry)
  };
}

function normalizeCanonicalPurchaseJournalEntry(entry: CanonicalPurchaseJournalEntry): CanonicalPurchaseJournalEntry {
  const nextValue = normalizeText(entry.nextValue, "record.journal.nextValue");
  const previousValue = optionalNormalizedText(entry.previousValue) ?? null;
  const note = optionalNormalizedText(entry.note);

  return {
    eventId: normalizeText(entry.eventId, "record.journal.eventId"),
    kind: entry.kind,
    previousValue,
    nextValue,
    occurredAt: toIsoString(entry.occurredAt),
    ...(note ? { note } : {})
  };
}

function normalizeCanonicalDrawRecord(record: CanonicalDrawRecord): CanonicalDrawRecord {
  const cloned = deepClone(record);

  return {
    ...cloned,
    lotteryCode: normalizeLotteryCode(cloned.lotteryCode),
    drawId: normalizeText(cloned.drawId, "record.drawId"),
    drawAt: toIsoString(cloned.drawAt),
    openedAt: toIsoString(cloned.openedAt),
    closedAt: optionalNormalizedText(cloned.closedAt) ? toIsoString(cloned.closedAt!) : null,
    settledAt: optionalNormalizedText(cloned.settledAt) ? toIsoString(cloned.settledAt!) : null,
    closedBy: optionalNormalizedText(cloned.closedBy) ?? null,
    settledBy: optionalNormalizedText(cloned.settledBy) ?? null
  };
}

function normalizePurchaseAttemptRecord(record: PurchaseAttemptRecord): PurchaseAttemptRecord {
  const cloned = deepClone(record);

  return {
    ...cloned,
    attemptId: normalizeText(cloned.attemptId, "record.attemptId"),
    purchaseId: normalizeText(cloned.purchaseId, "record.purchaseId"),
    legacyRequestId: optionalNormalizedText(cloned.legacyRequestId) ?? null,
    attemptNumber: Math.max(1, Math.trunc(cloned.attemptNumber)),
    startedAt: toIsoString(cloned.startedAt),
    finishedAt: toIsoString(cloned.finishedAt),
    externalTicketReference: optionalNormalizedText(cloned.externalTicketReference) ?? null,
    errorMessage: optionalNormalizedText(cloned.errorMessage) ?? null
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

function normalizeNotificationRecord(notification: NotificationRecord): NotificationRecord {
  return {
    ...deepClone(notification),
    notificationId: normalizeText(notification.notificationId, "notification.notificationId"),
    userId: normalizeText(notification.userId, "notification.userId"),
    type: notification.type,
    title: normalizeText(notification.title, "notification.title"),
    body: normalizeText(notification.body, "notification.body"),
    read: notification.read,
    createdAt: toIsoString(notification.createdAt),
    referenceTicketId: optionalNormalizedText(notification.referenceTicketId) ?? null,
    referenceDrawId: optionalNormalizedText(notification.referenceDrawId) ?? null,
    referenceLotteryCode: optionalNormalizedText(notification.referenceLotteryCode)
      ? normalizeLotteryCode(notification.referenceLotteryCode!)
      : null
  };
}

function normalizeCashDeskRequest(request: CashDeskRequest): CashDeskRequest {
  return {
    ...deepClone(request),
    cashDeskRequestId: normalizeText(request.cashDeskRequestId, "request.cashDeskRequestId"),
    ticketId: normalizeText(request.ticketId, "request.ticketId"),
    userId: normalizeText(request.userId, "request.userId"),
    lotteryCode: normalizeLotteryCode(request.lotteryCode),
    drawId: normalizeText(request.drawId, "request.drawId"),
    winningAmountMinor: Math.max(0, Math.trunc(request.winningAmountMinor)),
    currency: normalizeText(request.currency, "request.currency").toUpperCase(),
    status: request.status,
    createdAt: toIsoString(request.createdAt),
    paidAt: optionalNormalizedText(request.paidAt) ? toIsoString(request.paidAt!) : null,
    paidBy: optionalNormalizedText(request.paidBy) ?? null
  };
}

function toIsoString(value: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new Error(`Invalid ISO timestamp: ${value}`);
  }

  return new Date(timestamp).toISOString();
}
