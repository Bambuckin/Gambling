import type { Pool } from "pg";

export const LOTTERY_POSTGRES_SCHEMA_SQL = `
create table if not exists lottery_identities (
  identity_id text primary key,
  login text not null unique,
  password_hash text not null,
  role text not null,
  status text not null,
  display_name text not null,
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

create table if not exists lottery_terminal_execution_locks (
  lock_name text primary key,
  owner_id text not null,
  acquired_at timestamptz not null,
  expires_at timestamptz not null
);
`;

export async function initializeLotteryPostgresSchema(pool: Pool): Promise<void> {
  await pool.query(LOTTERY_POSTGRES_SCHEMA_SQL);
}
