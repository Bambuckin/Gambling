---
phase: 32
title: Admin runtime ledger and notification hotfix
status: in_progress
created_at: "2026-04-24T17:20:00+05:00"
depends_on: [31]
---

# Context

The latest runtime pass exposed five concrete regressions in the v1.2 contour:

1. Native admin confirm dialog still shows question marks after "close draw".
2. "Reset whole runtime" must leave draws and queue empty.
3. Admin needs a user balance surface with available/reserved amounts and manual corrections.
4. Reserve debit and winnings credit must work for the purchase -> close -> result contour.
5. The client cabinet needs an actual push surface for win/lose ticket results.

## Acceptance

- Admin confirm text is safe from file/bundle encoding loss.
- Full runtime reset clears draw snapshots, canonical draws, closures, queue, tickets, notifications, credit jobs, and requests without restoring seed draws.
- Admin page shows user balances and supports manual credit/debit with an auditable ledger entry.
- Draw close auto-credit/notification side effects run even when the ticket was already resolved before close.
- Client notification polling shows an in-app push for new draw result / winning notifications and still uses desktop notifications when permission is granted.
