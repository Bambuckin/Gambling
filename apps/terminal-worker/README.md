# @lottery/terminal-worker

Single active execution worker for terminal-bound purchase requests and winnings-credit jobs.

## What This App Owns

- queue polling cadence;
- terminal execution lock acquisition/release;
- purchase handler resolution;
- terminal attempt execution and journaling;
- retry classification handoff;
- winnings-credit job processing;
- Big 8 live draw sync and Big 8 terminal purchase automation.

It does not own:

- request state rules;
- ledger business rules;
- direct web/UI behavior;
- long-lived persistence contracts.

## Key Files

- `src/main.ts` - boot sequence, queue polling loop, credit-job loop, draw sync loop
- `src/lib/terminal-handler-runtime.ts` - handler registry bootstrap and verify-result stub behavior
- `src/lib/big8-live-draw-provider.ts` - live draw extraction from the terminal page
- `src/lib/big8-terminal-cart-handler.ts` - real Big 8 terminal purchase automation via Puppeteer
- `src/lib/big8-mock-terminal-handler.ts` - mock Big 8 handler for payload verification
- `src/lib/runtime/postgres-runtime.ts` - backend and connection selection

## Worker Loop In Plain Terms

1. Reserve the next queued request through `PurchaseExecutionQueueService`.
2. Acquire the single-terminal execution lock.
3. Resolve the purchase handler for the lottery code.
4. Execute the attempt.
5. Persist the normalized outcome through `TerminalExecutionAttemptService`.
6. Release the lock.
7. Process pending winnings-credit jobs after queue work.

Main orchestration lives in `src/main.ts`.

## Current Handler Coverage

- `bolshaya-8`
  - `real` mode: `Big8TerminalCartHandler`
  - `mock` mode: `Big8MockTerminalHandler`
- all other handler codes currently map to `DemoLotteryPurchaseHandler`

Important implication:

- only Big 8 has a concrete browser automation path right now;
- other lotteries remain deterministic placeholders until real handlers are added.

## Configuration

Critical variables:

- `LOTTERY_STORAGE_BACKEND`
- `LOTTERY_POSTGRES_URL`
- `LOTTERY_TERMINAL_LOCK_TTL_SECONDS`
- `LOTTERY_TERMINAL_POLL_INTERVAL_MS`
- `LOTTERY_TERMINAL_HANDLER_CODES`
- `LOTTERY_BIG8_TERMINAL_MODE`
- `LOTTERY_TERMINAL_BROWSER_URL`
- `LOTTERY_TERMINAL_PAGE_URL`

See `docs/CONFIGURATION.md` for the full list and validation rules.

## Validation

Run from repo root:

```powershell
corepack pnpm --filter @lottery/terminal-worker typecheck
```

Meaningful runtime verification is currently manual:

- `docs/runbooks/fake-terminal-smoke.md`
- `docs/runbooks/purchase-request-verification.md`
- `docs/runbooks/ticket-persistence-verification.md`

## Related Docs

- `docs/CONFIGURATION.md`
- `docs/handoff-runtime.md`
- `docs/modules/big8-terminal-integration.md`
- `docs/runbooks/fake-terminal-smoke.md`
