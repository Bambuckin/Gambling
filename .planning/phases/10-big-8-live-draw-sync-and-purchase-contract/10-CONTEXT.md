# Phase 10: Big 8 Live Draw Sync and Purchase Contract - Context

**Gathered:** 2026-04-13  
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 10 establishes the first live production slice for `Большая 8` before terminal cart execution:

- replace seeded draw data with live draw ingestion from the terminal interface;
- remodel the purchase draft/request contract for real Big 8 tickets;
- expose the live draw list in the cashier client with nearest-draw default selection;
- pull the terminal phone number from the authenticated user account instead of manual entry.

Terminal execution up to cart addition is intentionally deferred to Phase 11.  
Cashier workstation lockdown and rollout packaging are deferred to Phase 12.
</domain>

<decisions>
## Implementation Decisions

### Locked
- Scope is limited to one real lottery: `bolshaya-8`.
- Live draw source of truth is the National Lottery terminal web UI at `https://webapp.cloud.nationallottery.ru/`.
- Draw refresh cadence target is every 20 seconds.
- Cashier client must display the live draw list, default to the nearest draw, and still allow manual selection.
- Current live slice stops after tickets are added to cart. Final checkout/payment is out of scope.
- Phone for terminal purchase comes from the authenticated user account record, not from ad-hoc cashier input.
- One purchase must support multiple Big 8 tickets, matching the repeated-ticket-card model visible on the real site.
- Current deployment target is a single host running web, worker, and Postgres, but the design must keep host boundaries portable.
- Kiosk workstation lockdown is a separate follow-up phase and must not distort the purchase/domain model for Phase 10.

### the agent's Discretion
- Exact domain payload shape for multi-ticket Big 8 drafts and immutable request snapshots.
- Exact transport used for low-latency client status updates in later phases (`SSE` preferred, short polling fallback acceptable).
- Exact browser automation stack for terminal-side draw scraping and later cart execution (`Playwright`-style managed browser is the expected default).
- Whether live draw sync runs inside the worker process or in a dedicated terminal integration module invoked by the worker runtime.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and continuity
- `.planning/ROADMAP.md` - Phases 10-12 goals, order, and success criteria
- `.planning/STATE.md` - project continuity and roadmap evolution notes
- `.planning/PROJECT.md` - overall product constraints and LAN operating model

### Existing architecture anchors
- `docs/modules/boundary-catalog.md` - ownership boundaries for web, worker, domain, and infrastructure
- `docs/modules/system-architecture.md` - current module/data-flow map
- `docs/modules/lottery-handler-extension.md` - existing handler boundary and rollout expectations

### Current implementation anchors
- `apps/web/src/app/lottery/[lotteryCode]/page.tsx` - current synthetic lottery purchase flow
- `apps/web/src/lib/draw/draw-runtime.ts` - current draw refresh runtime composition
- `apps/web/src/lib/purchase/purchase-runtime.ts` - request/orchestration runtime composition
- `apps/web/src/lib/lottery-form/render-lottery-form-fields.tsx` - current registry-driven field renderer
- `packages/domain/src/access.ts` - current identity/session model
- `packages/domain/src/lottery-registry.ts` - registry/form metadata contracts
- `packages/domain/src/purchase-draft.ts` - current draft payload validation/pricing path
- `packages/application/src/services/draw-refresh-service.ts` - draw ingestion and freshness boundary
- `packages/application/src/services/purchase-draft-service.ts` - current draft validation/quote boundary
- `packages/application/src/services/purchase-orchestration-service.ts` - queue + reserve orchestration
- `apps/terminal-worker/src/lib/terminal-handler-runtime.ts` - current demo-only terminal runtime
- `apps/terminal-worker/src/main.ts` - worker polling/execution loop

### Live terminal behavior notes
- `docs/modules/big8-terminal-integration.md` - captured UI behavior, script findings, and network constraints for the real Big 8 integration
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `DrawRefreshService` already supports provider-based live refresh; only a real provider is missing.
- `PurchaseDraftService` and `PurchaseOrchestrationService` already centralize validation, snapshot creation, reserve, and queue insertion.
- Worker runtime already has one-active-request semantics, retry service wiring, and attempt journaling.

### Established Patterns
- Runtime apps compose services; they do not own business rules.
- Registry metadata currently drives lottery UI, but the existing metadata model is too shallow for real Big 8 ticket boards.
- Shared state is already designed to run on PostgreSQL for web + worker separation.

### Integration Points
- Big 8 live draws should enter through draw runtime/application service, not route-level scraping.
- User phone must become part of access identity/profile data before purchase snapshot creation.
- Multi-ticket Big 8 request payload must flow through domain/application boundaries and arrive intact to the Phase 11 handler.
</code_context>

<specifics>
## Specific Ideas

- Treat the real Big 8 ticket as a structured board array, not as loose registry key/value pairs.
- Preserve operator knowledge from screenshots/bookmarklets in repo docs so planning and implementation do not depend on the Downloads folder.
- Keep Phase 10 focused on data truth and request shape; do not drag kiosk-shell work into the purchase slice.
</specifics>

<deferred>
## Deferred Ideas

- Real cart automation and terminal attempt normalization live in Phase 11.
- Cashier workstation kiosk restrictions and launcher packaging live in Phase 12.
- Payment finalization remains out of scope until cart-add flow is stable.
</deferred>

---

*Phase: 10-big-8-live-draw-sync-and-purchase-contract*  
*Context gathered: 2026-04-13*
