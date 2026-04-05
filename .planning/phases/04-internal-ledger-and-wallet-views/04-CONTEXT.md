# Phase 4: Internal Ledger and Wallet Views - Context

**Gathered:** 2026-04-05  
**Status:** Ready for execution  
**Source:** Resume state + roadmap + requirements

<domain>
## Phase Boundary

Phase 4 introduces the internal money model used by purchase and ticket flows:
- immutable ledger entries for all balance mutations;
- deterministic wallet aggregates (`available` + `reserved`) derived from ledger history;
- reserve/debit/release behavior as explicit domain transitions;
- user-visible wallet status and movement history, while keeping operational and verification UI separated.
</domain>

<decisions>
## Implementation Decisions

### Locked
- Ledger stays lottery-agnostic and is linked only through request/ticket/draw references.
- Every balance mutation is append-only and must keep idempotency metadata.
- Wallet aggregate is computed from ledger events, not stored as mutable single source of truth.
- Reserve/debit/release flow is implemented in application services through explicit rules, not ad-hoc route logic.
- User-facing wallet and debug verification UI are separate surfaces.

### the agent's Discretion
- Concrete naming of ledger ports/services/adapters and their module file layout.
- Exact shape of validation errors and invariant helper functions.
- Scope of first wallet UI in `04-03` (table layout vs compact summary).
</decisions>

<canonical_refs>
## Canonical References

**Downstream work must read these before editing.**

### Scope and requirements
- `.planning/ROADMAP.md` - Phase 4 goals, plan order, success criteria
- `.planning/REQUIREMENTS.md` - `BAL-01`, `BAL-02`, `BAL-03`, `BAL-05`, `BAL-06`
- `.planning/STATE.md` - continuity and current phase position

### Architecture and boundary rules
- `docs/modules/boundary-catalog.md` - module ownership and forbidden crossings
- `.planning/codebase/STRUCTURE.md` - current runtime/package map
- `.planning/research/ARCHITECTURE.md` - target system shape and ledger placement
- `.planning/research/PITFALLS.md` - balance/request drift risk and prevention expectations

### Existing implementation anchors
- `packages/domain/src/ledger.ts`
- `apps/web/src/app/lottery/[lotteryCode]/page.tsx`
- `apps/web/src/lib/access/access-runtime.ts`
- `packages/application/src/services/access-service.ts`
</canonical_refs>

<specifics>
## Specific Ideas

- Keep ledger adapters in `@lottery/infrastructure` and compose runtime wiring in `apps/web/src/lib/ledger/*`.
- Extend current lottery page from fake balance preview to real aggregate snapshot read path.
- Reserve dedicated debug contour for wallet verification (`/debug/wallet-lab`) rather than mixing it into operator screens.
</specifics>

<deferred>
## Deferred Ideas

- Purchase request orchestration coupling (`PURC-*`) remains in Phase 5.
- Ticket winnings credit (`BAL-04`) remains in Phase 7.
</deferred>

---

*Phase: 04-internal-ledger-and-wallet-views*  
*Context gathered: 2026-04-05*
