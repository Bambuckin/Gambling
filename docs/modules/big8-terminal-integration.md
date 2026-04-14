# Big 8 Terminal Integration Notes

## Purpose

This document captures the live National Lottery terminal behavior for `Большая 8`
so future work does not depend on screenshots or local bookmarklet files.

Primary target URL:

- `https://webapp.cloud.nationallottery.ru/`

Observed terminal machine:

- Hostname: `K-000160`
- IP: `192.168.1.102`
- MAC: `54:EF:92:C0:7E:31`
- LAN notes: host responds to ping, SMB (`445`) is open, no public HTTP endpoint is exposed on the LAN host itself.

## Source Evidence

The notes below were derived from:

- terminal screenshots provided by the operator (`Терминал №1..4.png`)
- Big 8 purchase screenshot (`Покупка БОльшая 8.png`)
- local bookmarklet scripts:
  - `Покупка касса 13.04.2026.txt`
  - `Свои числа Касса 13.04.2026.txt`

These source files are operator-provided reference material, not repository-owned runtime assets.

## Terminal UI Structure

### Lottery list

The terminal home screen shows a grid of lottery cards. `Большая 8` is selectable from that grid.

### Big 8 purchase screen

Observed fields on the terminal UI:

- top draw selector with visible draw date/time and superprize
- ticket count control with `-` and `+`
- repeated ticket cards on one page
- each ticket card contains:
  - `Выберите минимум 8 чисел` from `1..20`
  - `Выберите минимум 1 число` from `1..4`
  - `Случайные числа`
  - `Множитель`
- cart interaction exists before final purchase

### Phone and cart flow

Observed/cart-related screens show:

- phone entry keypad
- reuse of a previous phone number shortcut
- cart view with editable items
- final checkout buttons

Current project scope stops at **add to cart**. Payment finalization is explicitly out of scope for the first live slice.

## DOM and Automation Hints From Existing Scripts

The provided bookmarklet scripts reveal useful integration behavior.

### Draw extraction

Existing script logic attempts to read draws from React props first:

- walks DOM nodes looking for `__reactFiber*`
- searches memoized props for `draws` and `onUpdateDraws`
- if found, can read draw list directly without opening modal

Fallback logic:

- opens draw dialog from the page
- reads checkbox ids that look like draw numbers
- extracts visible label text from dialog rows
- confirms selected draw through dialog action button

Implication:

- the live draw sync provider should first try React prop extraction
- modal scraping should remain as fallback when prop shape changes

### Big 8 ticket filling

The number-loading script confirms the Big 8 payload shape:

- one board requires `8` numbers from the first grid
- one control number from the second grid
- file lines can represent repeated tickets
- multiple ticket cards are supported on one page

### Useful terminal selectors/buttons already discovered

The operator scripts reference these elements:

- draw trigger heuristics based on visible draw text
- draw modal checkboxes with numeric ids
- confirm button for draw modal
- fill button / random pick button
- add-to-cart button ids like `add-to-cart-button` / `btn-buy`
- cart button found via SVG/icon heuristics
- phone keypad group buttons

These heuristics are brittle but immediately useful for Phase 11 bootstrap.

## Integration Decisions For Current Roadmap Extension

- `Большая 8` is the first production lottery integration.
- Draw list source of truth must come from the live terminal web UI, not seeded snapshots.
- Shared state between web UI and terminal worker remains PostgreSQL-backed.
- Worker should run on the terminal machine or in the same user session context as the browser it automates.
- Initial production handler stops after tickets are added to cart.
- The customer-facing web client must support multiple Big 8 tickets in one request, mirroring the terminal page concept.

## Phase 11 Implementation Status (2026-04-13)

Phase 11 is now wired with a real terminal cart path for `bolshaya-8`:

- worker handler `apps/terminal-worker/src/lib/big8-terminal-cart-handler.ts` attaches to the existing authenticated browser tab via Chrome remote debugging;
- purchase payload from web request snapshot is used directly (`draw + tickets[] + contactPhone`);
- draw is selected in the terminal modal and ticket data is applied ticket-by-ticket;
- flow advances to phone step, enters account phone from payload, and clicks **add to cart**;
- payment/checkout is intentionally not executed in this phase.

Lifecycle semantics were split so cart is no longer treated as purchased:

- new request state: `added_to_cart`;
- terminal attempt outcome supports `added_to_cart`;
- queue item is removed after successful cart add;
- ticket persistence still happens only for real `success` purchase outcomes.

This prevents false ticket records when execution only reaches cart.

## Implemented Terminal Flow (Current Handler)

Current deterministic flow implemented in worker:

1. attach to `https://webapp.cloud.nationallottery.ru/` page;
2. ensure `Большая 8` purchase screen is open (`#button-select-draw`);
3. open draw selector, select requested draw, confirm via `#button-modal-select-draws`;
4. sync ticket count and fill each ticket:
   - board: 8 numbers from 1..20
   - extra: 1 number from 1..4
   - multiplier is applied per ticket on terminal controls before cart add;
5. continue to phone step via `#to-add-phone` / text fallback;
6. enter phone from payload;
7. click add to cart (`#add-to-cart-button` / `#btn-buy` / text fallback);
8. return handler result with `executionOutcome=added_to_cart`.

## Worker Environment Flags For Cart Automation

Required for live cart automation:

- `LOTTERY_BIG8_CART_AUTOMATION_ENABLED=true`
- `LOTTERY_BIG8_TERMINAL_MODE=real`
- `LOTTERY_TERMINAL_BROWSER_URL=http://127.0.0.1:9222`
- `LOTTERY_TERMINAL_PAGE_URL=https://webapp.cloud.nationallottery.ru/`

Optional tuning:

- `LOTTERY_BIG8_ACTION_TIMEOUT_MS=8000`
- `LOTTERY_BIG8_DRAW_MODAL_WAIT_MS=2500`
- `LOTTERY_BIG8_RELOAD_BEFORE_PURCHASE=true`

## Local Mock Terminal Mode (Web -> Worker Pipeline Check)

For single-machine verification without touching live NL checkout:

- set `LOTTERY_BIG8_TERMINAL_MODE=mock`;
- worker uses deterministic `Big8MockTerminalHandler` for `bolshaya-8`;
- request still goes through normal queue/execution lifecycle and ends in `added_to_cart`;
- open `/debug/mock-terminal` to inspect payload snapshot + worker raw output.

This mode is verification-only and does not replace live terminal integration.

## Cashier/Admin Realtime Status

Near-real-time status paths were added:

- cashier route: `/api/lottery/[lotteryCode]/requests` + `LotteryLiveMonitor` polling widget;
- admin route: `/api/admin/operations` + `AdminLiveMonitor` polling widget.

This removes manual reload loops for observing queue/execution progression.

## Risks

- Terminal site DOM may change, especially class names and button structure.
- If the National Lottery session expires, draw sync and cart automation both fail.
- The current repo now stores a user phone number in the access identity model, but seeded/demo data still needs production values.
- Current phase models the first board as exactly 8 numbers for deterministic pricing. If the real rules allow more than 8 with different pricing, Phase 11 must extend the contract before checkout automation is finished.

## Recommended Technical Direction

### Phase 10

- extend identity/profile data with normalized phone number
- replace synthetic Big 8 form metadata with a structured multi-ticket payload
- build a terminal-backed draw provider that refreshes every 20 seconds

### Phase 11

- implement a managed browser automation runtime on the terminal machine
- attach to the existing authenticated browser tab via Chrome remote debugging
- scrape/select draws from the live site
- fill multiple Big 8 tickets and add them to the cart
- persist raw attempt outputs and expose near-real-time status back to clients

### Phase 12

- wrap cashier runtime in OS-level kiosk restrictions
- ship documented install/start scripts for one-host LAN deployment
- keep host/env boundaries explicit so web and DB can move later
