# @lottery/infrastructure

Concrete adapter layer for storage, schema/bootstrap, and default seed data.

## What This Package Owns

- in-memory adapters for development/runtime composition;
- Postgres adapters for shared runtime;
- Postgres schema creation;
- backend selection helpers;
- default lottery catalog, draw, and handler-code seeds.

It does not own domain decisions or UI behavior.

## Directory Map

- `src/access/` - in-memory access identity/session/audit adapters and password hashing
- `src/draw/` - in-memory draw store
- `src/ledger/` - in-memory ledger store
- `src/observability/` - in-memory operations audit log
- `src/purchase/` - in-memory request/queue/ticket/lock adapters
- `src/registry/` - in-memory lottery registry store
- `src/postgres/` - Postgres pool helpers, schema SQL, and concrete stores
- `src/seeds/` - default lottery registry, draw snapshots, default handler-code list

## Important Files

- `src/postgres/postgres-schema.ts` - authoritative table creation SQL
- `src/postgres/postgres-client.ts` - connection pool helper and env parsing
- `src/postgres/storage-backend.ts` - `in-memory` vs `postgres` selection
- `src/seeds/default-lottery-catalog.ts` - default lottery codes, titles, forms, pricing, and draw seeds

## Postgres Tables

Main runtime tables:

- identities and sessions;
- access audit events;
- registry entries and draw snapshots;
- ledger entries;
- purchase requests and queue items;
- tickets and verification jobs;
- operations audit events;
- terminal execution locks.

The exact DDL lives in `src/postgres/postgres-schema.ts`.

## Consumers

- `apps/web` runtime composition files instantiate these adapters directly.
- `apps/terminal-worker` runtime composition files instantiate worker-side adapters directly.
- `scripts/postgres-init-and-seed.ts` uses this package for schema/bootstrap.

## Validation

Run from repo root:

```powershell
corepack pnpm --filter @lottery/infrastructure test
corepack pnpm --filter @lottery/infrastructure typecheck
```

Because automated coverage is still limited, pair adapter changes with the relevant manual runbooks.

## Related Docs

- `docs/CONFIGURATION.md`
- `docs/DEVELOPMENT.md`
- `docs/runbooks/deployment-bootstrap.md`
