# Phase 26.01 Summary: Client Purchase UI and Ledger Truth

## What Changed

- Wired the live purchase payload to include wallet snapshot and current draw facts, not just requests and tickets.
- Added a live purchase facts panel so the cashier-facing page now reflects reserve/debit and winnings changes instead of holding onto the first server-rendered wallet snapshot.
- Finished the purchase-side layout against `111.png`: removed the duplicate server-rendered wallet/draw block instead of hiding it, restored the minimal intro copy in the live facts panel, and kept only sale-relevant stats there.
- Tightened the Big 8 purchase form by keeping the draw selector live on a 20-second refresh cadence, surfacing explicit `Активно` / `Блок` state under the selector, and stabilizing the ticket counter width.
- Finished the next UI pass against `222.png`: removed low-value helper copy from account summary and request status surfaces, collapsed live sync into the request panel, removed the request id / amount / created columns from the cashier view, and moved notifications lower so the top purchase contour matches the requested order.
- Replaced raw request status/result internals with cashier-facing labels through a dedicated presenter, including collapsing `terminal_attempt ...` and `canonical result:*` request outcomes into short visible summaries before they reach the purchase UI surface.
- Removed the remaining source-level tail in the purchase contour by making both the SSR page and the live `/api/lottery/[lotteryCode]/requests` endpoint emit presented request rows instead of raw `status` / `finalResult` internals.
- Fixed the root `start:web` / `dev:web` runtime path to preload the root `.env`, so local smoke and normal operator startup now use the same repo-level command instead of an ad-hoc workaround.
- Kept the reserve/debit/winnings mechanics grounded in the existing audited application flow instead of introducing a UI-only illusion.

## Files Changed

- `apps/web/src/app/api/lottery/[lotteryCode]/requests/route.ts`
- `apps/web/src/app/lottery/[lotteryCode]/page.tsx`
- `apps/web/src/app/styles.css`
- `apps/web/src/lib/lottery-form/big8-purchase-form.tsx`
- `apps/web/src/lib/purchase/lottery-live-cabinet.tsx`
- `apps/web/src/lib/purchase/lottery-live-request-presenter.ts`
- `apps/web/src/lib/purchase/__tests__/lottery-live-request-presenter.test.ts`
- `scripts/run-package-script-with-root-env.ts`
- `package.json`
- `.planning/STATE.md`
- `.planning/phases/26-client-purchase-ui-and-ledger-truth/26-01-PLAN.md`
- `.planning/phases/26-client-purchase-ui-and-ledger-truth/26-01-SUMMARY.md`

## Validation

- `corepack pnpm --filter @lottery/application test -- terminal-execution-attempt-service wallet-ledger-service winnings-credit-service`
- `corepack pnpm --filter @lottery/web test -- lottery-live-request-presenter`
- `corepack pnpm --filter @lottery/web typecheck`
- `corepack pnpm --filter @lottery/web build`
- `corepack pnpm runtime:preflight`
- `corepack pnpm db:seed`
- local production web smoke via repo-level `corepack pnpm start:web`, authenticated `operator` session, `/lottery/bolshaya-8` HTML assertions, and `/api/lottery/bolshaya-8/requests` payload contract checks

## Result

- Purchase UI now has a live wallet/draw truth path, so reserve disappearing after successful debit and winnings appearing in available funds no longer depends on a manual page reload or stale side panel state.
- Big 8 purchase form now matches the requested top contour more closely: the draw area shows the active draw and block state directly, and the right panel stays minimal without freshness/service noise.
- Account summary and request status blocks now match the requested cashier contour more closely: no helper chatter, no long request ids, and no raw internal result strings in the visible table.
- The purchase contour no longer leaks raw request state/result internals through its own SSR or live API path: the page HTML and `/api/lottery/[lotteryCode]/requests` now carry presenter-shaped `statusLabel` / `resultLabel` rows instead of `status` / `finalResult`.
- Local runtime smoke now runs through the standard root web command, so the validated contour matches the real repo startup path instead of a one-off shell wrapper.

## Remaining Gaps

- Real terminal LAN smoke is still separate from this local web/runtime smoke.
