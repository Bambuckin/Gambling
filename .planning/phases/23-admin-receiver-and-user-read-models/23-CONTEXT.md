# Phase 23: Admin, Receiver, and User Read Models - Context

**Gathered:** 2026-04-21  
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 23 moves the current admin console, terminal receiver, and user-facing read contours off legacy write-model tables and onto canonical projections plus audit-backed runtime views:

- admin monitoring, problem triage, and queue-adjacent status must be readable from canonical `purchase`, `draw`, and `purchase_attempt` truth;
- terminal receiver must stop pretending the legacy `purchase_request` journal is the main inbox source;
- current user request/ticket/history views must remain readable even when only canonical purchase truth exists;
- projection lag, stale execution, and operational incidents must be visible without forcing the UI to inspect legacy internals.

This phase does **not** replace queue transport or TTL execution locking. It also does **not** remove legacy `purchase_request`, `ticket`, or `ticket_verification_job` storage yet.
</domain>

<decisions>
## Locked

- Phase 22 already moved winning fulfillment and ledger idempotency onto canonical purchase identity. Phase 23 must make the read layer follow that truth instead of continuing to treat legacy ticket/request rows as the main surface.
- Keep the current UI routes and operator workflow understandable. The cutover should happen under existing pages and API shapes where practical.
- Do not introduce a second persistence architecture for read models in this phase. Prefer canonical-first query services and thin projections over existing stores.
- Legacy request/ticket rows may remain fallback compatibility inputs when canonical state is absent, but they are no longer allowed to be the default source of truth for read surfaces that already have canonical equivalents.
- Operations audit already exists in infrastructure/runtime and should be surfaced where it helps explain stale execution, queue anomalies, and terminal incidents instead of leaving the admin blind.

### the agent's Discretion

- Whether receiver/admin read cutover is done by extending existing query services or by adding a thin dedicated read service where the current logic only exists in web-layer helpers.
- Whether user cabinet stats are rebased directly inside `UserCabinetStatsService` or by delegating to existing canonical-first request/ticket query services, as long as logic is not duplicated.
</decisions>

<canonical_refs>
## Canonical References

- `.planning/STATE.md`
- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- `ARCHITECTURE.md`
- `.planning/phases/22-winning-fulfillment-and-ledger-rebase/22-CONTEXT.md`
- `.planning/phases/22-winning-fulfillment-and-ledger-rebase/22-01-SUMMARY.md`
- `apps/web/src/app/admin/page.tsx`
- `apps/web/src/app/terminal/receiver/page.tsx`
- `apps/web/src/app/api/terminal/receiver/inbox/route.ts`
- `apps/web/src/app/api/debug/mock-terminal/inbox/route.ts`
- `apps/web/src/app/lottery/[lotteryCode]/page.tsx`
- `apps/web/src/lib/purchase/mock-terminal-inbox.ts`
- `apps/web/src/lib/purchase/purchase-runtime.ts`
- `apps/web/src/lib/observability/operations-runtime.ts`
- `packages/application/src/services/admin-operations-query-service.ts`
- `packages/application/src/services/admin-queue-service.ts`
- `packages/application/src/services/purchase-request-query-service.ts`
- `packages/application/src/services/ticket-query-service.ts`
- `packages/application/src/services/user-cabinet-stats-service.ts`
- `packages/application/src/services/operations-audit-service.ts`
- `packages/application/src/services/canonical-compatibility.ts`
- `packages/domain/src/purchase-request.ts`
- `packages/domain/src/ticket.ts`
- `packages/domain/src/ledger.ts`
</canonical_refs>

<code_context>
## Existing Code Insights

- `PurchaseRequestQueryService` and `TicketQueryService` already project some canonical truth, but they still anchor their main list shape to legacy `requestStore` / `ticketStore` and then overlay canonical state on top.
- `UserCabinetStatsService` still reads only `ticketStore`, `ledgerStore`, and `requestStore`, so canonical-only purchases or compatibility-synthetic tickets are invisible to cabinet stats.
- Terminal receiver UI and both receiver/debug inbox APIs still read `listMockTerminalInboxRows()`, which is implemented directly in the web layer against legacy `requestStore` journal notes.
- `AdminOperationsQueryService` already knows about canonical purchases and attempts for problem detection, but admin page data is still split across legacy queue snapshot helpers, mock receiver rows, and direct store reads.
- `OperationsAuditService` plus in-memory/Postgres audit logs already exist and are wired in web runtime, but the admin and receiver surfaces do not currently use them to explain incidents or projection lag.
</code_context>

<deferred>
## Deferred Ideas

- Replace TTL lock semantics and queue transport boundary (Phase 24)
- Remove legacy `purchase_request`, `ticket`, and verification write models after parity validation (Phase 25)
- Add persistent materialized read tables or async rebuild jobs only if canonical-first service projections prove insufficient later
</deferred>

---

*Phase: 23-admin-receiver-and-user-read-models*  
*Context gathered: 2026-04-21*
