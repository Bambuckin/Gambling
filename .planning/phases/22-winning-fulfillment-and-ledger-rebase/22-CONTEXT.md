# Phase 22: Winning Fulfillment and Ledger Rebase - Context

**Gathered:** 2026-04-21  
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 22 moves money-side winning fulfillment onto canonical `purchase` and canonical `draw` result truth:

- balance credit and cash-desk eligibility must derive from canonical purchase result state plus canonical draw settlement visibility;
- ledger credit idempotency must stop depending on legacy verification-job event ids;
- winning follow-up actions must stay mutually exclusive even when the current UI still reads through compatibility ticket shapes;
- current operator and user surfaces must remain understandable while this cutover happens underneath them.

This phase does **not** rebuild the whole admin/user read model layer. It also does **not** remove legacy `ticket`, `ticket_verification_job`, or TTL execution lock tables yet.
</domain>

<decisions>
## Locked

- Phase 21 already made canonical draw settlement the publication gate. Phase 22 must treat canonical visible `purchase.resultStatus` as the fulfillment truth instead of reusing legacy verification state as a money trigger.
- Compatibility-first still applies: existing lottery/admin surfaces may keep their current shapes, but the fulfillment decision and ledger effect must come from canonical identifiers.
- Explicit winning actions remain the intended business flow: a win must not auto-credit merely because a legacy verification result was recorded.
- Legacy `ticket.claimState` may remain as a compatibility mirror when a legacy ticket row exists, but it is no longer allowed to be the only source of fulfillment state.
- The current tree no longer exposes the Phase 15 user/admin fulfillment controls promised by the phase docs; Phase 22 must restore a minimal working operator/user path instead of assuming those controls already exist.

### the agent's Discretion

- Whether canonical fulfillment is coordinated through one new application service or by a small set of local service refactors, as long as the change stays local and avoids parallel architectures.
- Whether compatibility claim state is projected from cash-desk / credit-job stores directly in the query layer or synchronized back into legacy ticket rows, as long as canonical purchase identity remains primary truth.
</decisions>

<canonical_refs>
## Canonical References

- `.planning/STATE.md`
- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- `ARCHITECTURE.md`
- `.planning/phases/15-winning-actions-credit-and-cash-desk/15-CONTEXT.md`
- `.planning/phases/15-winning-actions-credit-and-cash-desk/15-SUMMARY.md`
- `.planning/phases/21-draw-closure-settlement-and-result-publication/21-CONTEXT.md`
- `.planning/phases/21-draw-closure-settlement-and-result-publication/21-01-SUMMARY.md`
- `.planning/phases/21-draw-closure-settlement-and-result-publication/21-VERIFICATION.md`
- `apps/web/src/app/admin/page.tsx`
- `apps/web/src/app/lottery/[lotteryCode]/page.tsx`
- `apps/web/src/lib/purchase/purchase-runtime.ts`
- `apps/web/src/lib/ticket/ticket-runtime.ts`
- `apps/terminal-worker/src/main.ts`
- `packages/application/src/services/ticket-query-service.ts`
- `packages/application/src/services/ticket-verification-result-service.ts`
- `packages/application/src/services/ticket-claim-service.ts`
- `packages/application/src/services/winnings-credit-service.ts`
- `packages/application/src/services/cash-desk-service.ts`
- `packages/application/src/services/wallet-ledger-service.ts`
- `packages/application/src/ports/canonical-purchase-store.ts`
- `packages/application/src/ports/cash-desk-request-store.ts`
- `packages/application/src/ports/winnings-credit-job-store.ts`
- `packages/domain/src/purchase-request.ts`
- `packages/domain/src/draw.ts`
- `packages/domain/src/ticket.ts`
- `packages/domain/src/cash-desk.ts`
- `packages/domain/src/ledger.ts`
</canonical_refs>

<code_context>
## Existing Code Insights

- `TicketQueryService` already overlays canonical result visibility onto current ticket views, but claim state still comes from legacy ticket rows or defaults to synthetic `unclaimed`.
- `TicketVerificationResultService` still auto-credits winnings through `WalletLedgerService.creditWinnings`, which conflicts with the explicit fulfillment path introduced in Phase 15 and keeps money flow tied to legacy verification events.
- `CashDeskService` and `WinningsCreditService` exist, but their orchestration still assumes a legacy `ticket` row is the primary fulfillment anchor.
- Worker idle-loop already knows how to process queued credit jobs, so the missing cut is truth selection and surface wiring, not queue infrastructure.
- Current lottery/admin pages show result state but do not currently expose the fulfillment actions or admin payout controls needed for an operator-safe Phase 22 contour.
</code_context>

<deferred>
## Deferred Ideas

- Rebuild admin, receiver, and user reads onto canonical projections instead of legacy write models (Phase 23)
- Replace TTL lock semantics and current queue transport boundary (Phase 24)
- Remove legacy ticket / verification-job write models after parity validation (Phase 25)
</deferred>

---

*Phase: 22-winning-fulfillment-and-ledger-rebase*  
*Context gathered: 2026-04-21*
