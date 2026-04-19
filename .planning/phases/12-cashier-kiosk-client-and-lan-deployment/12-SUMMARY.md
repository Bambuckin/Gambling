# Phase 12: Cashier Kiosk Client and LAN Deployment - Summary

**Completed:** 2026-04-16 (retrospective reconciliation)
**Status:** Complete

## What Was Done

### LAN Bundle Builder
- `scripts/build-lan-bundles.ps1` (918 lines) — produces two self-contained folders:
  - `client-workstation/` — one-click kiosk launcher with Chrome/Edge `--kiosk` mode, isolated browser profile, PID tracking.
  - `terminal-receiver/` — portable `node.exe` + bundled `terminal-worker.cjs`, no Node.js install needed on terminal machine.
- `bin/Build LAN Bundles.cmd` — one-click wrapper.
- `corepack pnpm bundle:lan` wired in root `package.json`.

### Server Launcher
- `scripts/start-main-server.ps1` (443 lines) — auto-starts Postgres, auto-configures Windows Firewall for LAN, auto-configures `pg_hba.conf`.
- `bin/Start Main Server.cmd` — one-click wrapper.

### Terminal Receiver
- `apps/web/src/app/terminal/receiver/page.tsx` — receiver monitor page.
- `apps/web/src/app/api/terminal/receiver/inbox/route.ts` — receiver inbox API endpoint.
- `apps/terminal-worker/README.md` — worker documentation.

### Deployment Documentation
- `docs/runbooks/deployment-bootstrap.md` (294 lines) — full LAN deployment guide covering:
  - Section A: Web server setup (Postgres + web app).
  - Section B: Terminal worker setup (bundle path + repo path).
  - Section C: Client kiosk setup.
  - Section 9: Handoff notes for moving DB/web to another machine.
- `ops/runtime/hosts.template.json` — IP/hostname mapping template.
- `ops/runtime/.env.web.template` and `.env.worker.template` — env templates.

### Runtime Infrastructure
- `scripts/runtime-preflight.ts` — env validation for web/worker roles.
- `scripts/prepare-worker-runtime.ps1` / `prepare-web-runtime.ps1` — setup wrappers.
- `scripts/bootstrap-runtime.ps1` — schema init + seeding.
- Stop scripts: `bin/Stop Server.cmd`, `bin/Stop Worker.cmd`.

## Success Criteria Verification

1. **Kiosk launcher** ✅ — Chrome/Edge `--kiosk` mode, blocks browser navigation, supervised exit via Alt+F4 or `Stop Client.cmd`.
2. **LAN deployment documentation** ✅ — 294-line runbook, clean env templates, one-click start scripts.
3. **Terminal machine re-install steps** ✅ — two explicit paths (bundle copy + repo clone).
4. **Handoff docs** ✅ — deployment-bootstrap.md Section 9 covers DB/web/worker/kiosk machine moves.

## Key Files

- `scripts/build-lan-bundles.ps1`
- `scripts/start-main-server.ps1`
- `scripts/open-main-client.ps1`
- `scripts/runtime-preflight.ts`
- `docs/runbooks/deployment-bootstrap.md`
- `ops/runtime/hosts.template.json`
- `ops/runtime/.env.web.template`
- `ops/runtime/.env.worker.template`

---

*Phase: 12-cashier-kiosk-client-and-lan-deployment*
*Summary created: 2026-04-16*
