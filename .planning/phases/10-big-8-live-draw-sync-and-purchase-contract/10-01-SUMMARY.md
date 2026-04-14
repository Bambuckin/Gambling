# Phase 10.01 Summary

## Delivered

- Added normalized user phone storage to the identity model and both access stores.
- Extended purchase draft payloads from flat scalar fields to nested JSON so `Big 8` can carry multiple tickets in one request.
- Introduced a structured `Big 8` draft contract:
  - `schema: "big8-v1"`
  - `contactPhone`
  - `tickets[]`
  - each ticket contains `boardNumbers`, `extraNumber`, `multiplier`
- Reworked `Big 8` pricing to use the total multiplier sum across tickets.
- Extended draw snapshots to carry `availableDraws[]` instead of a single current draw only.
- Added a terminal-backed live draw provider that attaches to the already-open National Lottery browser tab through Chrome remote debugging and refreshes draw options every 20 seconds.
- Added `/api/lottery/[lotteryCode]/draws` so the web client can poll fresh draw choices.
- Replaced the generic `Big 8` form with a dedicated multi-ticket client UI:
  - selectable live draw list
  - default nearest draw
  - multiple ticket cards
  - 8-of-20 primary board
  - 1-of-4 extra board
  - per-ticket multiplier
  - random fill and clear
  - account phone shown read-only
- Cleaned the `Big 8` lottery page text and confirmation flow so the user sees a coherent cashier-facing screen instead of the previous broken strings.
- Updated runtime env templates, preflight validation, and deployment docs for terminal-browser attachment.

## Verified

- `corepack pnpm install`
- `corepack pnpm --filter @lottery/domain test`
- `corepack pnpm --filter @lottery/application test`
- `corepack pnpm --filter @lottery/infrastructure typecheck`
- `corepack pnpm --filter @lottery/infrastructure test`
- `corepack pnpm --filter @lottery/terminal-worker typecheck`
- `corepack pnpm --filter @lottery/web build`

## Important Constraint

Phase 10 stops at a truthful contract boundary:

- the web client now creates a valid `Big 8` request draft against live terminal draws;
- the worker now syncs live draws from the real terminal tab;
- the system **does not yet execute real add-to-cart automation**.

That gap is intentional. The current purchase-request lifecycle still treats a successful terminal handler result as a purchased ticket. Wiring a real add-to-cart click into that path today would lie about state and create false ticket records. Phase 11 must introduce cart-stage execution semantics before terminal cart automation is turned on.

## Operator Setup Required For Live Draw Sync

- Keep the cashier browser tab open on `https://webapp.cloud.nationallottery.ru/`.
- Launch Chrome/Chromium with remote debugging, for example:

```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" `
  --remote-debugging-port=9222 `
  --user-data-dir="C:\LotteryTerminalChrome" `
  https://webapp.cloud.nationallottery.ru/
```

- Worker env must include:
  - `LOTTERY_BIG8_LIVE_DRAW_SYNC_ENABLED=true`
  - `LOTTERY_BIG8_DRAW_SYNC_INTERVAL_MS=20000`
  - `LOTTERY_TERMINAL_BROWSER_URL=http://127.0.0.1:9222`
  - `LOTTERY_TERMINAL_PAGE_URL=https://webapp.cloud.nationallottery.ru/`

## Phase 11 Entry Condition

Phase 11 should start from:

- `apps/terminal-worker/src/lib/terminal-handler-runtime.ts`
- `apps/terminal-worker/src/lib/big8-live-draw-provider.ts`
- `packages/application/src/services/terminal-execution-attempt-service.ts`
- `packages/domain/src/purchase-request.ts`

The first mandatory step is to introduce a cart-stage result model instead of reusing the current purchased-ticket success path.
