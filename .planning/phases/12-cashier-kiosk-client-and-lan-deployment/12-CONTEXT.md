# Phase 12: Cashier Kiosk Client and LAN Deployment - Context

**Gathered:** 2026-04-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 12 packages the already-built Big 8 client/server flow into a simple LAN runtime for the current topology:

- the current machine remains the central host for web + shared PostgreSQL;
- one copyable folder is produced for the cashier workstation;
- one copyable folder is produced for the terminal workstation;
- the terminal workstation does not automate the real National Lottery page yet and only acts as a receiver that proves request payload delivery and updates statuses;
- the cashier and terminal folders must each launch through a single Windows launcher inside the copied folder.

The phase does not add real checkout/payment automation or a third packaged server bundle.
</domain>

<decisions>
## Implementation Decisions

### LAN topology
- **D-01:** Keep the current machine as the central host for the shared web app and PostgreSQL runtime.
- **D-02:** Use the LAN address of the current machine as the server endpoint for both packaged folders. Current detected server IP: `192.168.1.187`.
- **D-03:** Use the provided machine map as the deployment baseline:
  - client workstation: `DESKTOP-HT0U9M8` / `192.168.1.202`
  - terminal workstation: `AMG-MANAGER3` / `192.168.1.82`

### Client workstation package
- **D-04:** The cashier package should stay lightweight and launch Google Chrome in app-style mode directly to the Big 8 client route on the central server.
- **D-05:** Open the cashier flow at `/lottery/bolshaya-8` so the existing login/return flow can take the user straight back into the Big 8 purchase screen.
- **D-06:** Persist Chrome profile data inside the copied client folder so session/cookies stay with that workstation package instead of the system-wide browser profile.

### Terminal receiver package
- **D-07:** The terminal package should run the existing worker in `mock` Big 8 mode, connected to the shared central PostgreSQL over LAN, so request claiming and status transitions remain truthful to the current queue model.
- **D-08:** The terminal package should open a dedicated terminal monitor page from the central web app to show received Big 8 payloads and request statuses locally on the terminal workstation.
- **D-09:** No manual accept/reject UI is needed in this slice. The receiver only has to prove that the filled Big 8 payload arrived intact and that statuses move accordingly.

### Payload truth and status proof
- **D-10:** The mock terminal path must validate the full Big 8 payload exactly through the existing domain validator before marking the request as processed.
- **D-11:** Terminal-visible evidence must include enough detail to verify that draw id, phone, ticket count, board numbers, extra number, and multiplier arrived correctly.
- **D-12:** Reuse the existing request states (`executing`, `added_to_cart`, `error`) instead of introducing a parallel status model just for the LAN packaging slice.

### the agent's Discretion
- Exact launcher implementation format on Windows (`.cmd` + PowerShell is the default unless a cleaner built-in approach works better).
- Exact terminal monitor page shape and whether it reuses the current mock-terminal monitor logic or wraps it in a cleaner route.
- Exact assembly script used to produce the two copyable folders from the main repository.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and continuity
- `.planning/ROADMAP.md` - Phase 12 goal and relationship to phases 10-11
- `.planning/STATE.md` - current project state and active focus
- `.planning/PROJECT.md` - central topology, single-terminal constraint, and LAN operating model
- `.planning/REQUIREMENTS.md` - platform, queue, and terminal execution requirements that packaging must preserve

### Prior phase decisions
- `.planning/phases/10-big-8-live-draw-sync-and-purchase-contract/10-CONTEXT.md` - locked Big 8 payload and live draw decisions
- `.planning/phases/11-big-8-terminal-cart-execution-and-realtime-status/11-CONTEXT.md` - request status semantics and realtime polling decisions

### Existing runtime and deployment anchors
- `docs/runbooks/deployment-bootstrap.md` - current web/worker/Postgres LAN bootstrap flow
- `docs/modules/big8-terminal-integration.md` - current Big 8 cart scope, mock/live split, and operator notes
- `ops/runtime/README.md` - host/env runtime placeholders
- `ops/runtime/hosts.template.json` - machine/IP mapping format
- `scripts/create-runtime-env.ps1` - env generation pattern for web/worker runtimes
- `scripts/prepare-web-runtime.ps1` - current web bootstrap/start wrapper
- `scripts/prepare-worker-runtime.ps1` - current worker bootstrap/start wrapper
- `scripts/start-worker-mock-terminal.ps1` - existing mock terminal entrypoint

### Current code anchors
- `apps/web/src/app/lottery/[lotteryCode]/page.tsx` - cashier Big 8 purchase flow and payload submission
- `apps/web/src/app/api/lottery/[lotteryCode]/requests/route.ts` - cashier request status polling endpoint
- `apps/web/src/app/api/debug/mock-terminal/inbox/route.ts` - current mock terminal inbox polling endpoint
- `apps/web/src/app/debug/mock-terminal/page.tsx` - existing mock terminal monitor page
- `apps/web/src/lib/purchase/mock-terminal-inbox.ts` - server-side projection of received Big 8 payloads
- `apps/web/src/lib/purchase/mock-terminal-live-monitor.tsx` - polling UI pattern for terminal inbox
- `apps/terminal-worker/src/main.ts` - queue reservation and attempt loop
- `apps/terminal-worker/src/lib/terminal-handler-runtime.ts` - runtime handler selection and mock/live split
- `apps/terminal-worker/src/lib/big8-mock-terminal-handler.ts` - current payload validation and mock terminal raw output contract
- `packages/domain/src/purchase-draft.ts` - exact Big 8 payload validation rules
- `packages/domain/src/request-state.ts` - request status model that must remain canonical
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- The current `Big8MockTerminalHandler` already validates the full Big 8 payload before returning `added_to_cart`.
- The current `MockTerminalLiveMonitor` and inbox projection already expose the payload and worker raw output in a polling UI.
- Existing runtime wrapper scripts already standardize env loading and Windows startup flow.

### Established Patterns
- Shared state is already designed around one central PostgreSQL instance and one worker claiming queue items.
- Cashier/admin realtime feedback already uses short polling rather than websockets.
- Big 8 processing already has a clean mock/live split through environment flags instead of branching business logic in the UI.

### Integration Points
- The terminal package can reuse the worker with a dedicated LAN `.env` pointing to the central host DB.
- The client package can remain browser-only and talk to the central web app over LAN.
- The central web app needs a cleaner terminal-facing monitor route for packaged terminal use.
</code_context>

<specifics>
## Specific Ideas

- Keep the whole rollout boring: one central machine, one client launcher, one terminal launcher, no extra orchestration layer if the current queue + shared DB already solves the exchange.
- The terminal package should prove correctness of the exact Big 8 ticket content, not just show that “some request” arrived.
- Self-sufficient on Windows means the terminal folder should carry its own runtime pieces; the client folder can rely on installed Google Chrome because that machine already has it.
</specifics>

<deferred>
## Deferred Ideas

- Packaging the central server into a third copyable folder.
- Full OS-level kiosk lockdown beyond browser app/kiosk launch.
- Real National Lottery terminal automation or final checkout from the packaged terminal folder.
- Switching the LAN exchange from shared PostgreSQL to a dedicated HTTP receiver protocol.
</deferred>

---

*Phase: 12-cashier-kiosk-client-and-lan-deployment*
*Context gathered: 2026-04-14*
