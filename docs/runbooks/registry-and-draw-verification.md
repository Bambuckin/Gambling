# Registry And Draw Verification Runbook

Manual verification procedure for Phase 3 registry controls and draw gating.

## Preconditions

1. Dependencies are installed (`corepack pnpm install`).
2. Web app is running (`corepack pnpm --filter @lottery/web dev`).
3. You can access `http://localhost:3000`.

## Test Accounts

- `admin` / `admin`
- `operator` / `operator`
- `tester` / `tester`

## Step 1: Verify Admin Registry Controls

1. Open `http://localhost:3000/admin`.
2. Sign in with `admin` / `admin`.
3. Confirm table contains lottery code, enabled status, display order, draw state, and purchase state.
4. Click `Disable` for one enabled lottery.
5. Confirm success message `Action [ok]` appears and row status switches to `no`.
6. Click `Enable` to revert and confirm status switches back to `yes`.

Expected outcome:
- Visibility can be toggled without deleting the lottery row.
- Handler references remain available through registry/debug screens.

## Step 2: Verify Reorder Flow

1. In `/admin`, click `Move Up` and `Move Down` for at least one lottery.
2. Confirm display order values are rebalanced to `10, 20, 30...`.
3. Open `http://localhost:3000/` in a separate tab.
4. Confirm main shell lottery list reflects admin-defined order and only enabled entries.

Expected outcome:
- Reordering is applied through registry service path.
- Home shell order follows registry order, not hardcoded route order.

## Step 3: Verify Draw Freshness Badges And Purchase Gating

1. Open `http://localhost:3000/lottery/demo-lottery` with `tester` / `tester`.
2. Confirm draw state is `fresh` and purchase control is active.
3. Open `http://localhost:3000/lottery/gosloto-6x45`.
4. Confirm draw state is `stale` and purchase control is blocked.
5. In `/admin`, enable `archive-lottery` if disabled.
6. Open `http://localhost:3000/lottery/archive-lottery`.
7. Confirm draw state is `missing` and purchase control is blocked.

Expected outcome:
- UI explicitly shows `fresh|stale|missing`.
- Stale or missing draw state blocks purchase initiation.

## Step 4: Verify Dedicated Test UI Layer

1. Open `http://localhost:3000/debug/registry-lab`.
2. Confirm registry debug table still shows full entry set, including disabled records.
3. Use this screen for manual inspection only; use `/admin` for real admin mutations.

Expected outcome:
- Debug UI remains a verification contour, separate from core admin controls.

## Troubleshooting

- If `/admin` returns denied, verify role cookie/session points to admin identity.
- If draw states look unexpected, inspect seed logic in `apps/web/src/lib/draw/draw-runtime.ts`.
- If shell order does not change, inspect `LotteryRegistryService.moveLottery` and runtime singleton in `apps/web/src/lib/registry/registry-runtime.ts`.
