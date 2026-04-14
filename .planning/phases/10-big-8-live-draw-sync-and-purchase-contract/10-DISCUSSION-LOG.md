# Phase 10: Big 8 Live Draw Sync and Purchase Contract - Discussion Log

> **Audit trail only.** Decisions are captured in `10-CONTEXT.md`.

**Date:** 2026-04-13  
**Areas discussed:** draw source, purchase boundary, phone source, multi-ticket shape, deployment topology, kiosk split

---

## Draw Source

| Option | Description | Selected |
|--------|-------------|----------|
| Seeded snapshots | Keep synthetic draw data in repo/runtime | |
| Live terminal UI | Fetch draws from the National Lottery terminal interface | yes |

**User's choice:** Draw list must come from the terminal interface and be shown in the client UI with nearest-draw default.

## Purchase Boundary

| Option | Description | Selected |
|--------|-------------|----------|
| Full checkout | Add to cart and finalize payment | |
| Cart only | Stop after adding requested tickets to the cart | yes |

**User's choice:** Initial live slice ends at cart addition only.

## Phone Source

| Option | Description | Selected |
|--------|-------------|----------|
| Manual cashier entry | Enter phone on every purchase | |
| Account profile | Read phone from the authenticated user account | yes |

**User's choice:** Terminal phone must come from the existing user account data.

## Ticket Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Single ticket per request | One board only | |
| Multiple tickets per purchase | Support repeated Big 8 ticket cards in one request | yes |

**User's choice:** Purchase flow must support multiple tickets similarly to the real site layout.

## Deployment Topology

| Option | Description | Selected |
|--------|-------------|----------|
| Split infra immediately | Separate hosts now | |
| Single host now, portable later | Keep one-host deployment first but preserve portability | yes |

**User's choice:** Use one computer for infra now, but keep the design portable to another host later.

## Kiosk Direction

| Option | Description | Selected |
|--------|-------------|----------|
| Open browser only | No workstation lockdown | |
| Locked cashier client | Launch web UI in a mode that blocks general workstation actions | yes |

**User's choice:** Cashier workstation should run a locked client mode; detailed OS lockdown is deferred to Phase 12.
