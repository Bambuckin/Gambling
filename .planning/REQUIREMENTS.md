# Requirements: Lottery Terminal Operations System

**Defined:** 2026-04-05
**Core Value:** Каждая подтвержденная покупка должна предсказуемо пройти путь от веб-интерфейса до единственного главного терминала с корректным резервированием/списанием денег, понятным статусом и полным журналом событий.

## v1 Requirements

### Platform

- [x] **PLAT-01**: System boots as a shared web platform with separate modules for access, lottery registry, draw data, balance, purchase orchestration, terminal integration, admin, and audit.
- [x] **PLAT-02**: Core module contracts allow stubs or mocks to replace concrete adapters during phased development and testing.
- [x] **PLAT-03**: Each delivered phase can be verified locally through smoke or integration checks without requiring the full production terminal.

### Authentication

- [x] **AUTH-01**: Unauthenticated user opening a lottery is prompted for login and password before continuing.
- [x] **AUTH-02**: After successful authentication the user returns to the lottery originally selected before login.
- [x] **AUTH-03**: UI and API enforce role-based permissions for user and administrator actions.
- [x] **AUTH-04**: User session persists across page navigation and browser refresh until logout or expiry.
- [x] **AUTH-05**: System logs login, logout, and denied access events with actor and timestamp.

### Lottery Registry

- [x] **LOTR-01**: Main screen shows only enabled lotteries in administrator-defined order.
- [ ] **LOTR-02**: Administrator can enable, disable, and reorder lotteries without deleting handlers or historical data.
- [x] **LOTR-03**: Every lottery page uses a common shell but renders lottery-specific purchase fields from registry metadata.
- [x] **LOTR-04**: Registry stores lottery code, title, visibility status, form schema, pricing rules, purchase handler, and result handler reference.
- [ ] **LOTR-05**: Lottery page shows lottery name, current balance, current draws, freshness status, and purchase controls.

### Draw Data

- [ ] **DRAW-01**: Main terminal fetches and stores current draws for each lottery on a scheduled basis.
- [ ] **DRAW-02**: Draw data is stored separately per lottery with freshness timestamp and actuality flag.
- [ ] **DRAW-03**: User interface clearly marks stale or missing draw data.
- [ ] **DRAW-04**: Purchase submission is blocked when required draw data is missing or inactive.

### Balance

- [ ] **BAL-01**: Confirmed purchase request creates a balance reserve instead of an immediate final debit.
- [ ] **BAL-02**: Successful purchase converts a reserve into a final debit linked to the originating request.
- [ ] **BAL-03**: Final failure or allowed cancellation releases the reserve and restores available funds.
- [ ] **BAL-04**: Winning ticket verification credits winnings to the user balance.
- [ ] **BAL-05**: Every balance mutation is stored as an immutable ledger entry linked to the related request or ticket.
- [ ] **BAL-06**: User can view available balance, reserved funds, and balance movement history.

### Purchase Requests

- [ ] **PURC-01**: System validates ticket parameters against lottery-specific rules before confirmation.
- [ ] **PURC-02**: System calculates ticket cost from lottery pricing rules before confirmation.
- [ ] **PURC-03**: User sees confirmation dialog with lottery, draw, parameters, and final cost before request creation.
- [ ] **PURC-04**: After confirmation system creates a purchase request with immutable ticket snapshot and status journal.
- [ ] **PURC-05**: User can cancel a request while it is queued or waiting between retries, but not after terminal execution starts.
- [ ] **PURC-06**: User can view a personal request list with current status, attempt count, and final result.

### Terminal Execution

- [ ] **TERM-01**: Only one purchase request can be actively executed on the main terminal at a time.
- [ ] **TERM-02**: Queue processes regular requests sequentially and inserts administrator priority requests ahead of non-started regular requests.
- [ ] **TERM-03**: Terminal executor selects deterministic prebuilt handler logic by lottery code rather than generating executable code from user input.
- [ ] **TERM-04**: Each execution attempt stores start time, end time, raw terminal text, normalized outcome, and retry metadata.
- [ ] **TERM-05**: Terminal worker applies configured retry policy and marks final failure when attempts are exhausted.
- [ ] **TERM-06**: System exposes terminal state as idle, busy, degraded, or offline to administrators.

### Tickets and Results

- [ ] **TICK-01**: Successful purchase stores a ticket record linked to the originating request and chosen draw.
- [ ] **TICK-02**: After draw availability, the terminal can read ticket results without additional manual steps after verification starts.
- [ ] **TICK-03**: Ticket stores purchase status, verification status, terminal result text, and winning amount.
- [ ] **TICK-04**: User sees updated ticket outcome and balance after verification completes.

### Administration

- [ ] **ADMIN-01**: Administrator can view queue contents, including priority flag, queue order, and current executing request.
- [ ] **ADMIN-02**: Administrator can create priority requests that enter the queue above regular requests without interrupting active execution.
- [ ] **ADMIN-03**: Administrator can view failed or problematic requests with last error, attempt count, and related lottery/user.
- [ ] **ADMIN-04**: Administrative interface shows lottery controls, terminal status, audit summaries, and financial exception events.

### Audit and Alerts

- [ ] **AUDT-01**: System logs key user, admin, request, terminal, and balance events with actor, timestamp, related entities, and outcome.
- [ ] **AUDT-02**: Each purchase request retains a state transition journal from creation through final status.
- [ ] **AUDT-03**: Critical purchase or terminal failures raise visible operational alerts for administrators.

### Documentation and Extension

- [x] **DOCS-01**: Repository includes living architecture, module responsibility, and data-flow documentation aligned with implemented modules.
- [x] **DOCS-02**: Each module has local verification guidance covering unit, integration, or smoke checks for partial delivery.
- [x] **DOCS-03**: Adding or changing a lottery handler is documented through clear extension points and operator runbooks.

## v2 Requirements

### Terminal Scaling

- **TERM-07**: System can support failover or multiple execution terminals with controlled ownership transfer.

### Finance

- **BAL-07**: Users can perform external top-up and withdrawal operations with reconciliation.

### Notifications

- **NOTF-01**: Users receive proactive notifications about purchase completion and ticket verification.

### Analytics

- **ANLY-01**: Administrators can view operational and financial analytics dashboards over time.

### Integration

- **API-01**: System exposes controlled external APIs for reporting or upstream integrations.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multiple active main terminals in v1 | Contradicts the current operational model and multiplies consistency risk |
| Direct user control over the terminal browser | Breaks centralized execution and security boundaries |
| Runtime-generated purchase code from user parameters | Handlers must stay predefined and auditable |
| Public payment gateway integration | Not part of the current technical specification |
| Native mobile clients | Web-first LAN workflow is sufficient for v1 |
| Real-time push notifications outside the web session | Valuable later, but not required to validate the core flow |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PLAT-01 | Phase 1 | Complete |
| PLAT-02 | Phase 1 | Complete |
| PLAT-03 | Phase 1 | Complete |
| AUTH-01 | Phase 2 | Complete |
| AUTH-02 | Phase 2 | Complete |
| AUTH-03 | Phase 2 | Complete |
| AUTH-04 | Phase 2 | Complete |
| AUTH-05 | Phase 2 | Complete |
| LOTR-01 | Phase 3 | Complete |
| LOTR-02 | Phase 3 | Pending |
| LOTR-03 | Phase 3 | Complete |
| LOTR-04 | Phase 3 | Complete |
| LOTR-05 | Phase 3 | Pending |
| DRAW-01 | Phase 3 | Pending |
| DRAW-02 | Phase 3 | Pending |
| DRAW-03 | Phase 3 | Pending |
| DRAW-04 | Phase 3 | Pending |
| BAL-01 | Phase 4 | Pending |
| BAL-02 | Phase 4 | Pending |
| BAL-03 | Phase 4 | Pending |
| BAL-05 | Phase 4 | Pending |
| BAL-06 | Phase 4 | Pending |
| PURC-01 | Phase 5 | Pending |
| PURC-02 | Phase 5 | Pending |
| PURC-03 | Phase 5 | Pending |
| PURC-04 | Phase 5 | Pending |
| PURC-05 | Phase 5 | Pending |
| PURC-06 | Phase 5 | Pending |
| TERM-01 | Phase 6 | Pending |
| TERM-02 | Phase 6 | Pending |
| TERM-03 | Phase 6 | Pending |
| TERM-04 | Phase 6 | Pending |
| TERM-05 | Phase 6 | Pending |
| TERM-06 | Phase 6 | Pending |
| TICK-01 | Phase 7 | Pending |
| TICK-02 | Phase 7 | Pending |
| TICK-03 | Phase 7 | Pending |
| TICK-04 | Phase 7 | Pending |
| BAL-04 | Phase 7 | Pending |
| ADMIN-01 | Phase 8 | Pending |
| ADMIN-02 | Phase 8 | Pending |
| ADMIN-03 | Phase 8 | Pending |
| ADMIN-04 | Phase 8 | Pending |
| AUDT-01 | Phase 8 | Pending |
| AUDT-02 | Phase 8 | Pending |
| AUDT-03 | Phase 8 | Pending |
| DOCS-01 | Phase 1 | Complete |
| DOCS-02 | Phase 1 | Complete |
| DOCS-03 | Phase 1 | Complete |

**Coverage:**
- v1 requirements: 49 total
- Mapped to phases: 49
- Unmapped: 0 ✅

---
*Requirements defined: 2026-04-05*
*Last updated: 2026-04-05 after 01-04 completion (documentation baseline advanced)*
