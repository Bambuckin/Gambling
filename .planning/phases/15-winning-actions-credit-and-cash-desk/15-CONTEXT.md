# Phase 15: Winning Actions, Credit, and Cash Desk - Context

**Gathered:** 2026-04-16  
**Status:** Ready for execution

<domain>
## Phase Boundary

Phase 15 turns a resolved winning ticket into exactly one follow-up fulfillment path:

- hidden internal credit job for `Зачислить на баланс`;
- visible admin cash-desk request for `Получить в кассе`.

This phase does not redesign the entire scheduler.
</domain>

<decisions>
## Implementation Decisions

### Locked
- Winning actions are mutually exclusive.
- Hidden credit jobs run only when purchase queue is empty.
- Cash-desk flow is only `pending -> paid`.
- No ledger credit is written for the cash-desk path.

### the agent's Discretion
- Exact queue implementation for hidden credit jobs, as long as it stays separate from normal purchase requests and preserves idempotency.
</decisions>

<canonical_refs>
## Canonical References

- `docs/handoff/big8-current-wave/README.md`
- `docs/handoff/big8-current-wave/phase-15.md`
- `.planning/phases/14-admin-driven-draw-emulation-and-notifications/14-CONTEXT.md`
- `packages/domain/src/ticket.ts`
- `packages/domain/src/ledger.ts`
- `packages/application/src/services/wallet-ledger-service.ts`
- `apps/terminal-worker/src/main.ts`
- `apps/web/src/app/admin/page.tsx`
- `apps/web/src/app/lottery/[lotteryCode]/page.tsx`
</canonical_refs>

<code_context>
## Existing Code Insights

- Current winnings path is not split into explicit user choices.
- Purchase queue priority rules already exist and should remain canonical for purchase work.
- Admin UI already has queue/ops visibility that can host the cash-desk view.
</code_context>

<deferred>
## Deferred Ideas

- Generic multi-queue scheduler redesign.
- Multi-stage cashier approval.
- Real terminal payout scripts beyond the hidden job boundary.
</deferred>

---

*Phase: 15-winning-actions-credit-and-cash-desk*  
*Context gathered: 2026-04-16*
