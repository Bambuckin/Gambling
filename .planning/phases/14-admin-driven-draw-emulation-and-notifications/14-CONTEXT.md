# Phase 14: Admin-Driven Draw Emulation and Notifications - Context

**Gathered:** 2026-04-16  
**Status:** Ready for execution

<domain>
## Phase Boundary

Phase 14 replaces the current placeholder result story with an explicit admin-driven emulation loop:

- admin marks tickets as `win` or `lose`;
- admin manually closes the draw;
- unresolved tickets default to `lose`;
- user receives in-app result updates and winnings availability.

No external result provider is added in this phase.
</domain>

<decisions>
## Implementation Decisions

### Locked
- Result source is admin emulation, not NLoto integration.
- Closing a draw is idempotent.
- Fixed win amount is `50_000` minor units unless changed before execution.
- Notifications are persisted and shown in-app only.

### the agent's Discretion
- Whether admin result mark is stored directly on `TicketRecord` or via a small adjacent persistence model, as long as final resolved ticket state remains queryable without reconstruction gymnastics.
</decisions>

<canonical_refs>
## Canonical References

- `docs/handoff/big8-current-wave/README.md`
- `docs/handoff/big8-current-wave/phase-14.md`
- `.planning/phases/13-big8-purchased-ticket-and-login-ux/13-CONTEXT.md`
- `packages/domain/src/ticket.ts`
- `packages/domain/src/draw.ts`
- `packages/application/src/services/ticket-verification-result-service.ts`
- `apps/web/src/app/admin/page.tsx`
- `apps/web/src/app/lottery/[lotteryCode]/page.tsx`
</canonical_refs>

<code_context>
## Existing Code Insights

- Current verification logic is synthetic and not aligned with the required admin-controlled result loop.
- Admin page already has an operational surface that can host draw-close and ticket-mark controls.
- Client/admin live updates already use polling and should be extended instead of replaced.
</code_context>

<deferred>
## Deferred Ideas

- Official-site result checks.
- Automatic draw closure by time.
- Browser push notifications.
</deferred>

---

*Phase: 14-admin-driven-draw-emulation-and-notifications*  
*Context gathered: 2026-04-16*
