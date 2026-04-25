import type { Pool } from "pg";

export const LOTTERY_POSTGRES_SCHEMA_SQL = `
create table if not exists lottery_identities (
  identity_id text primary key,
  login text not null unique,
  password_hash text not null,
  role text not null,
  status text not null,
  display_name text not null,
  phone text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists lottery_sessions (
  session_id text primary key,
  identity_id text not null,
  role text not null,
  issued_at timestamptz not null,
  expires_at timestamptz not null,
  last_seen_at timestamptz not null,
  return_to_lottery_code text null,
  revoked_at timestamptz null
);
create index if not exists lottery_sessions_identity_id_idx on lottery_sessions(identity_id);

create table if not exists lottery_access_audit_events (
  id bigserial primary key,
  occurred_at timestamptz not null,
  event jsonb not null
);
create index if not exists lottery_access_audit_events_occurred_at_idx on lottery_access_audit_events(occurred_at);

create table if not exists lottery_registry_entries (
  lottery_code text primary key,
  display_order integer not null,
  enabled boolean not null,
  entry jsonb not null
);
create index if not exists lottery_registry_entries_display_order_idx on lottery_registry_entries(display_order);

create table if not exists lottery_draw_snapshots (
  lottery_code text primary key,
  fetched_at timestamptz not null,
  snapshot jsonb not null
);
create table if not exists lottery_draw_closures (
  lottery_code text not null,
  draw_id text not null,
  status text not null,
  closed_at timestamptz null,
  record jsonb not null,
  primary key (lottery_code, draw_id)
);
create index if not exists lottery_draw_closures_status_idx on lottery_draw_closures(status);
create index if not exists lottery_draw_closures_closed_at_idx on lottery_draw_closures(closed_at);

create table if not exists lottery_draws (
  lottery_code text not null,
  draw_id text not null,
  draw_at timestamptz not null,
  status text not null,
  result_visibility text not null,
  opened_at timestamptz not null,
  closed_at timestamptz null,
  settled_at timestamptz null,
  updated_at timestamptz not null,
  record jsonb not null,
  primary key (lottery_code, draw_id)
);
create index if not exists lottery_draws_status_idx on lottery_draws(status);
create index if not exists lottery_draws_draw_at_idx on lottery_draws(draw_at);
create index if not exists lottery_draws_updated_at_idx on lottery_draws(updated_at);

create table if not exists lottery_ledger_entries (
  entry_id text primary key,
  user_id text not null,
  created_at timestamptz not null,
  idempotency_key text not null unique,
  entry jsonb not null
);
create index if not exists lottery_ledger_entries_user_id_idx on lottery_ledger_entries(user_id);
create index if not exists lottery_ledger_entries_created_at_idx on lottery_ledger_entries(created_at);

create table if not exists lottery_purchase_requests (
  request_id text primary key,
  user_id text not null,
  state text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  record jsonb not null
);
create index if not exists lottery_purchase_requests_user_id_idx on lottery_purchase_requests(user_id);
create index if not exists lottery_purchase_requests_state_idx on lottery_purchase_requests(state);
create index if not exists lottery_purchase_requests_created_at_idx on lottery_purchase_requests(created_at);

create table if not exists lottery_purchases (
  purchase_id text primary key,
  legacy_request_id text null unique,
  user_id text not null,
  lottery_code text not null,
  draw_id text not null,
  status text not null,
  result_status text not null,
  result_visibility text not null,
  submitted_at timestamptz not null,
  updated_at timestamptz not null,
  purchased_at timestamptz null,
  settled_at timestamptz null,
  record jsonb not null
);
create index if not exists lottery_purchases_user_id_idx on lottery_purchases(user_id);
create index if not exists lottery_purchases_status_idx on lottery_purchases(status);
create index if not exists lottery_purchases_draw_idx on lottery_purchases(lottery_code, draw_id);
create index if not exists lottery_purchases_updated_at_idx on lottery_purchases(updated_at);

create table if not exists lottery_purchase_queue_items (
  request_id text primary key,
  status text not null,
  priority text not null,
  enqueued_at timestamptz not null,
  item jsonb not null
);
create index if not exists lottery_purchase_queue_items_status_idx on lottery_purchase_queue_items(status);
create index if not exists lottery_purchase_queue_items_priority_idx on lottery_purchase_queue_items(priority);
create index if not exists lottery_purchase_queue_items_enqueued_at_idx on lottery_purchase_queue_items(enqueued_at);

create table if not exists lottery_purchase_attempts (
  attempt_id text primary key,
  purchase_id text not null,
  legacy_request_id text null,
  attempt_number integer not null,
  outcome text not null,
  started_at timestamptz not null,
  finished_at timestamptz not null,
  external_ticket_reference text null,
  error_message text null,
  record jsonb not null,
  unique (purchase_id, attempt_number)
);
create index if not exists lottery_purchase_attempts_purchase_id_idx on lottery_purchase_attempts(purchase_id);
create index if not exists lottery_purchase_attempts_legacy_request_id_idx on lottery_purchase_attempts(legacy_request_id);
create index if not exists lottery_purchase_attempts_outcome_idx on lottery_purchase_attempts(outcome);
create index if not exists lottery_purchase_attempts_finished_at_idx on lottery_purchase_attempts(finished_at);

create table if not exists lottery_tickets (
  ticket_id text primary key,
  request_id text not null unique,
  user_id text not null,
  verification_status text not null,
  purchased_at timestamptz not null,
  ticket jsonb not null
);
create index if not exists lottery_tickets_user_id_idx on lottery_tickets(user_id);
create index if not exists lottery_tickets_verification_status_idx on lottery_tickets(verification_status);
create index if not exists lottery_tickets_purchased_at_idx on lottery_tickets(purchased_at);

create table if not exists lottery_ticket_verification_jobs (
  job_id text primary key,
  ticket_id text not null unique,
  status text not null,
  enqueued_at timestamptz not null,
  updated_at timestamptz not null,
  job jsonb not null
);
create index if not exists lottery_ticket_verification_jobs_status_idx on lottery_ticket_verification_jobs(status);
create index if not exists lottery_ticket_verification_jobs_enqueued_at_idx on lottery_ticket_verification_jobs(enqueued_at);

create table if not exists lottery_operations_audit_events (
  event_id text primary key,
  occurred_at timestamptz not null,
  severity text not null,
  domain text not null,
  event jsonb not null
);
create index if not exists lottery_operations_audit_events_occurred_at_idx on lottery_operations_audit_events(occurred_at);
create index if not exists lottery_operations_audit_events_severity_idx on lottery_operations_audit_events(severity);

create table if not exists lottery_notifications (
  notification_id text primary key,
  user_id text not null,
  type text not null,
  read boolean not null,
  created_at timestamptz not null,
  notification jsonb not null
);
create index if not exists lottery_notifications_user_id_idx on lottery_notifications(user_id);
create index if not exists lottery_notifications_created_at_idx on lottery_notifications(created_at);
create index if not exists lottery_notifications_read_idx on lottery_notifications(read);

create table if not exists lottery_cash_desk_requests (
  cash_desk_request_id text primary key,
  ticket_id text not null unique,
  user_id text not null,
  lottery_code text not null,
  draw_id text not null,
  status text not null,
  created_at timestamptz not null,
  request jsonb not null
);
create index if not exists lottery_cash_desk_requests_user_id_idx on lottery_cash_desk_requests(user_id);
create index if not exists lottery_cash_desk_requests_status_idx on lottery_cash_desk_requests(status);
create index if not exists lottery_cash_desk_requests_created_at_idx on lottery_cash_desk_requests(created_at);

create table if not exists lottery_winnings_credit_jobs (
  job_id text primary key,
  ticket_id text not null,
  user_id text not null,
  status text not null,
  created_at timestamptz not null,
  job jsonb not null
);
create index if not exists lottery_winnings_credit_jobs_ticket_id_idx on lottery_winnings_credit_jobs(ticket_id);
create index if not exists lottery_winnings_credit_jobs_status_idx on lottery_winnings_credit_jobs(status);
`;

export async function initializeLotteryPostgresSchema(pool: Pool): Promise<void> {
  await pool.query(LOTTERY_POSTGRES_SCHEMA_SQL);
  await pool.query(`
    drop table if exists lottery_terminal_execution_locks;
  `);
  await pool.query(`
    alter table lottery_identities
    add column if not exists phone text;
  `);
  await pool.query(`
    update lottery_identities
    set phone = '79990000000'
    where phone is null or btrim(phone) = '';
  `);
  await pool.query(`
    alter table lottery_identities
    alter column phone set not null;
  `);
}
