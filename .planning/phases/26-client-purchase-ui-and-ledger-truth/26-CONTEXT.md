# Phase 26 Context: Client Purchase UI and Ledger Truth

## Why This Phase Exists

The purchase contour works, but the user screen still exposes dead helper text, clutter, stale draw interaction, and wallet/draw details that do not match the intended cashier experience. At the same time, the money flow around reserve/debit/winnings must be rechecked while the UI is being tightened.

This phase is not allowed to finish as a cosmetic pass. The purchase page must become smaller and cleaner while preserving honest runtime truth.

## Scope Locked In

1. The draw area on the purchase form must refresh automatically; no extra user action should be needed to see the active draw.
2. Helper text near ticket count, purchase summary, and wallet/draw side blocks should be removed when it only explains technical or obvious UI behavior.
3. The ticket-count area should not grow awkwardly when the user adds more tickets.
4. The purchase page should keep only the wallet and draw facts that help the cashier complete the current sale.
5. The reserve/debit path must be revalidated against the current terminal purchase contour.
6. Winnings must still credit correctly after result publication.

## Concrete UI Changes

1. Keep the draw selector live and current without depending on a manual refresh action.
2. Remove redundant helper copy around the ticket-count control.
3. Remove non-essential helper text inside the purchase summary card.
4. Reduce the right-side wallet/draw panel so it stops showing technical freshness/service information that does not help the cashier sell a ticket.
5. Preserve the values the cashier still needs for the sale: available funds, reserve state if still relevant to the current purchase, current draw, and draw time.
6. Keep the visual layout stable when ticket count increases.

## Concrete Mechanics To Verify

1. Successful terminal purchase must clear reserve for that request and move the money path into final purchase accounting.
2. Wallet read models shown on the purchase page must stop displaying stale reserve after purchase success.
3. Winning publication must still credit the correct amount to the same user wallet.
4. Ledger transitions for reserve, debit, release, and winnings must remain auditable and idempotent.

## Files Most Likely Involved

- `apps/web/src/app/lottery/[lotteryCode]/page.tsx`
- `apps/web/src/lib/lottery-form/big8-purchase-form.tsx`
- `apps/web/src/lib/purchase/lottery-live-cabinet.tsx`
- `apps/web/src/lib/ledger/ledger-runtime.ts`
- `packages/application/src/services/purchase-completion-service.ts`
- `packages/application/src/services/wallet-ledger-service.ts`
- `packages/application/src/services/user-cabinet-stats-service.ts`

## Acceptance Criteria

1. The user sees current draw availability without manually poking the form.
2. The purchase page no longer shows redundant helper text in the ticket-count area, summary card, or wallet/draw side panel.
3. The ticket-count controls stay visually stable when ticket count changes.
4. The wallet/draw side panel is reduced to purchase-relevant information only.
5. After a successful terminal purchase, the wallet no longer shows stale reserved money for that request.
6. After a winning result, the credited amount is visible in the balance path and remains auditable in ledger state.

## Validation Plan

1. Targeted web typecheck for touched UI code.
2. Targeted application tests around purchase completion and ledger behavior.
3. Manual smoke on the purchase screen with a real request if the local runtime is available.
