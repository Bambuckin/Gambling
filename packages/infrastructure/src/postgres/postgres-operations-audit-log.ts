import type { OperationsAuditEvent, OperationsAuditLog } from "@lottery/application";
import type { Pool } from "pg";
import { deepClone } from "./utils.js";

export class PostgresOperationsAuditLog implements OperationsAuditLog {
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async append(event: OperationsAuditEvent): Promise<void> {
    const clonedEvent = deepClone(event);

    await this.pool.query(
      `
        insert into lottery_operations_audit_events (
          event_id,
          occurred_at,
          severity,
          domain,
          event
        ) values ($1, $2, $3, $4, $5::jsonb)
        on conflict (event_id)
        do update
          set occurred_at = excluded.occurred_at,
              severity = excluded.severity,
              domain = excluded.domain,
              event = excluded.event
      `,
      [
        clonedEvent.eventId,
        clonedEvent.occurredAt,
        clonedEvent.severity,
        clonedEvent.domain,
        JSON.stringify(clonedEvent)
      ]
    );
  }

  async listEvents(): Promise<readonly OperationsAuditEvent[]> {
    const result = await this.pool.query(
      `
        select event
        from lottery_operations_audit_events
        order by occurred_at asc, event_id asc
      `
    );

    return result.rows.map((row: { event: OperationsAuditEvent }) => deepClone(row.event));
  }
}
