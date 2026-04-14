# Handoff: Remaining Product Gaps

This file is intentionally short and explicit for another model/account.

## Already Prepared

- Shared Postgres runtime path for web + terminal worker.
- Runtime mode switch via `LOTTERY_STORAGE_BACKEND`.
- Database schema bootstrap and seed script.
- Deployment templates for server/terminal/client IP mapping.
- Runtime preflight validator for `.env` (`scripts/runtime-preflight.ts`).
- Big 8 live draw sync from National Lottery tab (Chrome remote debugging).
- Big 8 real add-to-cart handler in worker (`apps/terminal-worker/src/lib/big8-terminal-cart-handler.ts`).
- Honest cart-stage request lifecycle (`added_to_cart`), preventing false ticket persistence.
- Realtime polling APIs/widgets for cashier and admin execution visibility.

## Remaining Gaps (Expected)

1. Final checkout/payment stage is not automated yet (Phase 12+ scope).
2. Optional security hardening (password hashing algorithm upgrade, TLS/proxy, RBAC expansion).
3. If NLoto active catalog changes, refresh seed list in:
   - `packages/infrastructure/src/seeds/default-lottery-catalog.ts`
   - `apps/web/src/lib/ui/lottery-presentation.ts`
4. Selector hardening with additional terminal artifacts (HAR/DOM dumps) for long-term DOM drift resistance.

## Minimal Input Needed From Operator

- Server IP and web port.
- Database IP/port and credentials.
- Main terminal IP and execution constraints.
- List of client workstation IPs (for network policy/firewall).
- Lottery codes that must be executable at launch.

## Fast Start Commands

```powershell
# server
.\scripts\bootstrap-runtime.ps1 -EnvFile .env -SeedMode if-empty
.\scripts\start-web-runtime.ps1 -EnvFile .env

# terminal machine
.\scripts\start-worker-runtime.ps1 -EnvFile .env
```

## Primary Launch Checklist

- `docs/runbooks/launch-readiness-checklist.md`
