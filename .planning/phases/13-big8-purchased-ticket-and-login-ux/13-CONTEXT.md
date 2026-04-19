# Phase 13: Big 8 Purchase Completion and Login UX - Context

**Gathered:** 2026-04-16  
**Status:** Ready for execution

<domain>
## Phase Boundary

Phase 13 finishes the first missing gap between the current real Big 8 cart flow and a truthful purchased ticket:

- route regular users directly into `bolshaya-8`;
- centralize and expose demo accounts for testing;
- keep the real cart handler honest at `added_to_cart`;
- synthesize final purchase success after cart stage through runtime/application logic;
- let the ticket appear through the existing success persistence path.

This phase does not implement real checkout/payment automation.
</domain>

<decisions>
## Implementation Decisions

### Locked
- `bolshaya-8` is the only lottery that gets `emulate_after_cart`.
- `added_to_cart` remains the canonical cart-stage outcome and is not renamed away.
- Final ticket persistence must still happen through the existing success path.
- Big 8 stale draw is `warn_only` in this wave.
- Demo accounts must come from one source of truth and be copyable from the login page.

### the agent's Discretion
- Exact UI treatment of the copy buttons.
- Exact place where `purchaseCompletionMode` and `drawFreshnessMode` live, as long as they are registry-driven rather than hardcoded in scattered UI branches.
</decisions>

<canonical_refs>
## Canonical References

- `docs/handoff/big8-current-wave/README.md`
- `docs/handoff/big8-current-wave/phase-13.md`
- `.planning/phases/11-big-8-terminal-cart-execution-and-realtime-status/11-CONTEXT.md`
- `apps/web/src/app/login/page.tsx`
- `apps/web/src/lib/access/entry-flow.ts`
- `apps/terminal-worker/src/lib/terminal-handler-runtime.ts`
- `packages/application/src/services/terminal-execution-attempt-service.ts`
- `packages/application/src/services/ticket-persistence-service.ts`
</canonical_refs>

<code_context>
## Existing Code Insights

- Current login page hardcodes demo credentials in UI.
- Current regular-user landing route is not Big 8 by default.
- Current Big 8 live flow truthfully stops at `added_to_cart`.
- Ticket persistence is currently tied to final success, not cart addition.
</code_context>

<deferred>
## Deferred Ideas

- Real checkout/payment automation after cart stage.
- Any rollout/kiosk packaging changes from Phase 12.
</deferred>

---

*Phase: 13-big8-purchased-ticket-and-login-ux*  
*Context gathered: 2026-04-16*
