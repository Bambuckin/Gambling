---
phase: "11"
name: "big-8-terminal-cart-execution-and-realtime-status"
created: 2026-04-13
updated: 2026-04-13
---

# Phase 11: big-8-terminal-cart-execution-and-realtime-status - Context

## Decisions

- Do not treat terminal cart-add as purchased ticket success. Introduce dedicated request state `added_to_cart`.
- Preserve deterministic handler model: only pre-registered `bolshaya-8` runtime automation, no free-form runtime scripts.
- Keep payment finalization out of scope. Phase 11 stops at successful add-to-cart on real NLoto tab.
- Realtime status for cashier/admin uses polling API endpoints plus client widgets, not manual page reload loops.

## Discretion Areas

- Selector fallback strategy is heuristic-first to survive small DOM shifts, with known need for further hardening from additional artifacts.
- Keep non-Big8 lotteries on stub purchase handlers for now to avoid accidental partial integrations.
- Use server-side authenticated route handlers for realtime JSON snapshots; no anonymous status APIs.

## Deferred Ideas

- Move from polling to push model (SSE/websocket) if queue throughput justifies it.
- Introduce explicit cart token/session identifiers from NLoto UI once stable DOM/API source is confirmed.
- Add checkout stage transitions (`added_to_cart -> success/error`) when payment automation enters scope.
