# Handoff: Remaining Product Gaps

This file is intentionally short and explicit for another model/account.

## Already Prepared

- Shared Postgres runtime path for web + terminal worker.
- Runtime mode switch via `LOTTERY_STORAGE_BACKEND`.
- Database schema bootstrap and seed script.
- Deployment templates for server/terminal/client IP mapping.
- Runtime preflight validator for `.env` (`scripts/runtime-preflight.ts`).

## Remaining Gaps (Expected)

1. Final customer-facing purchase UI implementation in:
   - `apps/web/src/app/lottery/[lotteryCode]/page.tsx`
2. Terminal integration logic for real operator flow:
   - `apps/terminal-worker/src/lib/terminal-handler-runtime.ts`
3. Optional security hardening (password hashing algorithm upgrade, TLS/proxy, RBAC expansion).

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
