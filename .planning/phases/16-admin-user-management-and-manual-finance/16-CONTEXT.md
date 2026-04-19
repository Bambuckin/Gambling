# Phase 16: Admin User Management and Manual Finance - Context

**Gathered:** 2026-04-16  
**Status:** Ready for execution

<domain>
## Phase Boundary

Phase 16 extends the admin console from operational monitoring into direct user administration:

- user list and drill-down;
- full business-field editing;
- block/unblock and password changes;
- manual balance credit/debit with audit.

This phase is admin-only surface area.
</domain>

<decisions>
## Implementation Decisions

### Locked
- Admin can edit all business user fields.
- `identityId` remains immutable and read-only.
- Manual balance changes require a reason and immutable audit trail.
- User history must be visible from the drill-down screen.

### the agent's Discretion
- Exact UI layout of the user detail screen, as long as edits and history are available without leaving admin context.
</decisions>

<canonical_refs>
## Canonical References

- `docs/handoff/big8-current-wave/README.md`
- `docs/handoff/big8-current-wave/phase-16.md`
- `.planning/phases/15-winning-actions-credit-and-cash-desk/15-CONTEXT.md`
- `packages/domain/src/access.ts`
- `packages/domain/src/ledger.ts`
- `packages/infrastructure/src/postgres/postgres-access-store.ts`
- `packages/application/src/services/wallet-ledger-service.ts`
- `apps/web/src/app/admin/page.tsx`
</canonical_refs>

<code_context>
## Existing Code Insights

- Current admin surface does not yet expose user management.
- Current ledger model does not distinguish manual credit/debit operation types.
- Access storage already provides the right place to add admin-facing read/write operations.
</code_context>

<deferred>
## Deferred Ideas

- Multi-admin permission matrix.
- Bulk user operations.
</deferred>

---

*Phase: 16-admin-user-management-and-manual-finance*  
*Context gathered: 2026-04-16*
