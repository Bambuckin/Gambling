# @lottery/domain

Pure domain contracts and lifecycle rules.

## What This Package Owns

- access identity/session types and normalization;
- access audit event shapes;
- draw freshness contracts;
- ledger entry rules and balance aggregation;
- lottery registry metadata contracts;
- purchase draft validation and quoting primitives;
- purchase request snapshots and journal transitions;
- request state transition rules;
- retry policy decisions;
- terminal attempt normalization;
- ticket and verification job contracts.

This package must stay free of runtime side effects, storage code, UI code, and browser automation.

## File Map

- `access.ts` - identities, sessions, normalization, session validity
- `access-audit.ts` - audit event schema for login/logout outcomes
- `draw.ts` - draw snapshots, options, freshness state
- `ledger.ts` - immutable ledger operations and balance math
- `lottery-registry.ts` - registry entry, form field, pricing, handler binding metadata
- `purchase-draft.ts` - form validation, Big 8 payload validation, quote helpers
- `purchase-request.ts` - request snapshot and journal append helpers
- `request-state.ts` - allowed request transitions and cancel rules
- `retry-policy.ts` - retry vs final-error decision
- `terminal-attempt.ts` - normalized attempt record and journal note formatting
- `terminal-execution.ts` - queue item priority/ranking shape
- `ticket.ts` - purchased ticket and verification job lifecycle

## Consumers

- `@lottery/application` uses these contracts as the language of all use cases.
- `apps/web` and `apps/terminal-worker` should reach domain logic indirectly through application services wherever possible.

## Validation

Run from repo root:

```powershell
corepack pnpm --filter @lottery/domain test
corepack pnpm --filter @lottery/domain typecheck
```

## Related Docs

- `ARCHITECTURE.md`
- `docs/modules/boundary-catalog.md`
- `packages/application/README.md`
