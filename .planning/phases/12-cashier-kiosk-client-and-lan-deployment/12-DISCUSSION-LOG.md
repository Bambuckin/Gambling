# Phase 12: Cashier Kiosk Client and LAN Deployment - Discussion Log

> **Audit trail only.** Do not use as input to planning or implementation agents.
> Locked decisions are captured in `12-CONTEXT.md`.

**Date:** 2026-04-14
**Phase:** 12-cashier-kiosk-client-and-lan-deployment
**Areas discussed:** machine topology, client runtime, terminal runtime, payload proof

---

## Machine Topology

**User inputs captured**
- All target machines are Windows.
- Current machine remains the central machine with the database.
- Provided LAN map:
  - client: `DESKTOP-HT0U9M8`, `192.168.1.202`
  - terminal: `AMG-MANAGER3`, `192.168.1.82`

**Decision captured**
- Build two copyable folders that both communicate with the current central machine over LAN.

---

## Client Runtime

**User inputs captured**
- Google Chrome is installed on the client workstation.
- Stability of data exchange matters more than browser-brand details.

**Decision captured**
- Client package can stay lightweight and launch the existing web UI through Chrome on the LAN address of the central machine.

---

## Terminal Runtime

**User inputs captured**
- Do not touch the real terminal flow yet.
- Terminal package only needs to receive data and change statuses so it is clear the exchange is correct.

**Decision captured**
- Terminal package stays in receiver/mock mode and proves end-to-end payload arrival instead of automating the real NLoto page.

---

## Payload Proof

**User inputs captured**
- The important thing is that the filled Big 8 ticket arrives correctly and can be trusted.

**Decision captured**
- Reuse the existing validated Big 8 payload and request status pipeline instead of inventing a separate fake message format.

---

## the agent's Discretion

- Exact launcher implementation on Windows.
- Exact folder assembly flow for the two copyable bundles.
- Exact presentation of the terminal-side monitor page.
