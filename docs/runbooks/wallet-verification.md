# Wallet Verification Runbook

Manual verification procedure for Phase 4 wallet snapshot and movement history views.

## Preconditions

1. Dependencies are installed (`corepack pnpm install`).
2. Web app is running (`corepack pnpm --filter @lottery/web dev`).
3. You can access `http://localhost:3000`.

## Test Accounts

- `operator` / `operator`
- `tester` / `tester`
- `admin` / `admin`

## Step 1: Verify User Wallet Snapshot In Lottery Area

1. Open `http://localhost:3000/lottery/demo-lottery`.
2. Sign in as `tester` / `tester` if prompted.
3. Confirm the `Wallet Snapshot` table is visible.
4. Confirm `Currency`, `Available (minor)`, and `Reserved (minor)` are present.
5. Confirm `Latest Wallet Movements` table is visible and contains `operation`, `amount`, `reference`, and `created at`.

Expected outcome:
- User area always shows available and reserved balances.
- Movement history is visible without debug routes.

## Step 2: Verify Movement Ordering And Seeded Values In Wallet Lab

1. Open `http://localhost:3000/debug/wallet-lab`.
2. Confirm page text explicitly marks this route as verification-only contour.
3. Confirm seeded wallets are listed (`seed-user`, `seed-admin`, `seed-tester`).
4. Confirm `seed-tester` has both `credit` and `reserve` entries.
5. Confirm movement rows are ordered newest first (latest event at top).

Expected outcome:
- Wallet Lab exposes seeded wallet snapshots for manual checks.
- Latest movement ordering is deterministic and repeatable.

## Step 3: Verify Reserve/Debit/Release Transition Expectations

1. In local test setup, append entries for one request in this order: `reserve`, `debit`, `release`.
2. Reload `http://localhost:3000/debug/wallet-lab`.
3. Confirm movement table includes `request:<requestId>` metadata on all three entries.
4. Confirm amounts display reserve/debit as outgoing and release as incoming.
5. Confirm wallet snapshot reflects net change:
   - reserve decreases available and increases reserved;
   - debit decreases reserved;
   - release increases available and decreases reserved.

Expected outcome:
- reserve/debit/release transitions stay traceable by request reference.
- Snapshot math remains consistent with immutable ledger history.

## Troubleshooting

- If wallet tables are empty, inspect seed parsing in `apps/web/src/lib/ledger/ledger-runtime.ts`.
- If a seeded wallet is missing, check `LOTTERY_LEDGER_ENTRIES_JSON` for malformed entries.
- If movement references show `n/a`, inspect ledger entry references and requestId requirements in `packages/domain/src/ledger.ts`.
