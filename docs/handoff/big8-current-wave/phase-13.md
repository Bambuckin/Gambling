# Phase 13: Big 8 Purchase Completion and Login UX

## Goal

Take the existing Big 8 flow from `added_to_cart` to a real persisted purchased ticket while also fixing the login/demo-user UX for testing.

## Locked Decisions

- Regular user always lands on `/lottery/bolshaya-8` after login.
- Admin still lands on `/admin`.
- Homepage stays unchanged.
- Demo credentials must come from one shared source, not from hardcoded text inside the login page.
- Add 2 new demo users for testing. Default values:
  - `cashier1 / cashier1`
  - `cashier2 / cashier2`
- Login page needs temporary copy buttons for each demo account.
- Big 8 purchase completion mode is `emulate_after_cart`.
- Current handler output `added_to_cart` remains truthful and preserved.
- Final purchase success must be synthesized after cart stage by runtime/application logic, not by lying in the handler itself.
- Big 8 draw freshness in this wave is `warn_only`.

## Required Implementation

1. Fix post-login routing.
   - Move the default regular-user destination from the current lottery route to `/lottery/bolshaya-8`.
   - Preserve explicit `returnTo` behavior when it is present and valid.

2. Centralize demo identities.
   - One source of truth must feed:
     - identity storage/seed,
     - login-page demo account list,
     - any test bootstrap relying on those users.
   - Do not keep duplicate credential lists in UI and storage.

3. Add login-page copy UX.
   - Each demo account block should expose quick copy for login and password.
   - This is temporary test UX; keep it simple.

4. Add purchase-completion policy to the registry/runtime path.
   - Introduce a per-lottery mode such as `purchaseCompletionMode`.
   - Set `bolshaya-8` to `emulate_after_cart` in this wave.

5. Finish Big 8 request after cart stage.
   - Keep `big8-terminal-cart-handler` focused on real cart automation only.
   - After a successful `added_to_cart`, runtime/application logic must:
     - synthesize a deterministic final purchase success,
     - mint a deterministic external reference,
     - pass that final outcome through the existing success/ticket-persistence path.
   - Do not add a second special-case ticket write service just for Big 8.

6. Reconcile stale-draw behavior.
   - Current code is inconsistent between domain and UI/API.
   - Add explicit per-lottery freshness handling so Big 8 can warn instead of block in this wave.

## Likely Touch Points

- `apps/web/src/lib/access/entry-flow.ts`
- `apps/web/src/app/login/page.tsx`
- `packages/domain/src/access.ts`
- `packages/infrastructure/src/postgres/postgres-access-store.ts`
- `packages/infrastructure/src/seeds/default-lottery-catalog.ts`
- `packages/domain/src/draw.ts`
- `apps/web/src/app/lottery/[lotteryCode]/page.tsx`
- `apps/terminal-worker/src/lib/terminal-handler-runtime.ts`
- `packages/application/src/services/terminal-execution-attempt-service.ts`
- `packages/application/src/services/ticket-persistence-service.ts`

## Acceptance Scenarios

- Regular user logs in with a demo account and lands on `/lottery/bolshaya-8`.
- Admin logs in and still lands on `/admin`.
- Login screen shows all demo users and lets the operator copy credentials without typing.
- A Big 8 request reaches `added_to_cart`, then is finalized to `success`, and the purchased ticket appears in the lottery page history.
- Ticket persistence still happens through the canonical success flow.
- Big 8 stale draw produces a visible warning but does not block purchase in this wave.

## Out Of Scope

- Real payment automation after cart stage.
- Any redesign of the homepage or broader login UI.
- Adding the same completion mode to other lotteries.
