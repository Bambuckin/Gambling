# Phase 17: User Cabinet Stats and Test Reset Tools - Context

**Gathered:** 2026-04-16  
**Status:** Ready for execution

<domain>
## Phase Boundary

Phase 17 finishes the current working wave with:

- cross-lottery cabinet totals and filters for the user;
- practical admin summary metrics;
- explicit admin tools to clear queue state and reset the test runtime to baseline.

These reset tools are for test/runtime control, not production data administration.
</domain>

<decisions>
## Implementation Decisions

### Locked
- User cabinet filters: `lottery`, `status`, `period`.
- `Clear Queue` and `Reset Test Data` are both admin-only.
- Both reset actions are allowed only when terminal state is idle.
- Full reset preserves identities, credentials, lottery catalog, and seeded baseline config, but clears test-generated runtime data and active sessions.
- Reset implementation must stay inside the application/service layer; do not call shell scripts from the browser.

### the agent's Discretion
- Exact persistence/projection cleanup sequence, as long as final post-reset state is deterministic and auditable.
</decisions>

<canonical_refs>
## Canonical References

- `docs/handoff/big8-current-wave/README.md`
- `docs/handoff/big8-current-wave/phase-17.md`
- `.planning/phases/16-admin-user-management-and-manual-finance/16-CONTEXT.md`
- `packages/application/src/services/admin-operations-query-service.ts`
- `packages/application/src/services/admin-queue-service.ts`
- `packages/application/src/services/purchase-request-query-service.ts`
- `packages/application/src/services/wallet-ledger-service.ts`
- `apps/web/src/app/admin/page.tsx`
- `apps/web/src/lib/ledger/wallet-view.ts`
</canonical_refs>

<code_context>
## Existing Code Insights

- Cabinet data exists in pieces but not as a single cross-lottery summary surface.
- Current admin console already shows operational summaries and is the right place for the danger-zone controls.
- Existing repo scripts like `db:reset` are operator tools, not browser-triggered application actions.
</code_context>

<deferred>
## Deferred Ideas

- Predictive analytics and client hints.
- Production-grade destructive maintenance tooling.
</deferred>

---

*Phase: 17-user-cabinet-stats-and-test-reset-tools*  
*Context gathered: 2026-04-16*
