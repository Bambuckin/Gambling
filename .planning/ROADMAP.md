# Roadmap: Lottery Terminal Operations System

## Overview

Этот roadmap режет систему на девять вертикальных фаз: от фундаментальных контрактов и архитектуры к доступу, реестру лотерей, финансам, оркестрации покупки, терминальному исполнению, сверке билетов, операционному администрированию и финальной документации/усилению качества. Такой порядок держит главный риск под контролем: на каждом шаге появляется частично работоспособный, проверяемый кусок, а не мертвый слой “на будущее”.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation Contracts** - Зафиксировать каркас проекта, модульные границы, ADR и тестовый bootstrap.
- [x] **Phase 2: Access and Unified Shell** - Поднять авторизацию, роли и общий интерфейсный shell с возвратом в выбранную лотерею. (completed 2026-04-05)
- [ ] **Phase 3: Lottery Registry and Draw Pipeline** - Реализовать реестр лотерей, управление доступностью и поток актуальных тиражей.
- [ ] **Phase 4: Internal Ledger and Wallet Views** - Собрать внутренний ledger баланса, резервы и пользовательское отображение движения средств.
- [ ] **Phase 5: Purchase Request Orchestration** - Построить подтверждение покупки, создание заявки, очередь и пользовательские статусы.
- [ ] **Phase 6: Main Terminal Execution Engine** - Подключить последовательное исполнение на терминале, retry и нормализацию результата.
- [ ] **Phase 7: Ticket Verification and Winnings** - Добавить хранение билетов, сверку после розыгрыша и начисление выигрыша.
- [ ] **Phase 8: Admin Operations and Observability** - Дать администратору полный операционный контур: очередь, ошибки, лотереи, терминал, алерты.
- [ ] **Phase 9: Hardening, Extension Docs, and Release Readiness** - Закрыть документацию, расширяемость, регрессионные проверки и готовность к изменению системы.

## Phase Details

### Phase 1: Foundation Contracts
**Goal**: Create the project skeleton, module contracts, ADR trail, developer bootstrap, and stubbed verification path so later phases can be built and tested independently.
**Depends on**: Nothing (first phase)
**Requirements**: [PLAT-01, PLAT-02, PLAT-03]
**Canonical refs**: [.planning/PROJECT.md, .planning/REQUIREMENTS.md, .planning/research/STACK.md, .planning/research/ARCHITECTURE.md, .planning/research/SUMMARY.md]
**UI hint**: no
**Success Criteria** (what must be TRUE):
  1. Application workspace boots with explicit modules for access, registry, draws, balance, purchase orchestration, terminal integration, admin, and audit.
  2. Shared contracts exist for lottery adapters, queue execution, ledger operations, and result parsing with stub implementations for local verification.
  3. Development bootstrap and smoke checks run without access to the production terminal.
  4. ADR and module responsibility docs explain where future changes belong.
**Plans**: 4 plans

Plans:
- [x] 01-01: Create repository skeleton, workspace conventions, and baseline bootstrap.
- [x] 01-02: Scaffold runtime apps and shared packages, then wire workspace tooling.
- [x] 01-03: Define core domain contracts, application ports, fake adapters, and state-machine checks.
- [x] 01-04: Finalize module/runbook docs and refresh repository entrypoints.

### Phase 2: Access and Unified Shell
**Goal**: Deliver the first usable web shell with login, session handling, role separation, and return-to-lottery behavior.
**Depends on**: Phase 1
**Requirements**: [AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05]
**Canonical refs**: [.planning/PROJECT.md, .planning/REQUIREMENTS.md, .planning/research/FEATURES.md, .planning/research/SUMMARY.md]
**UI hint**: yes
**Success Criteria** (what must be TRUE):
  1. Unauthenticated user selecting a lottery is redirected through login and returned to the chosen lottery after successful authentication.
  2. User and administrator see role-appropriate navigation and are blocked from unauthorized actions.
  3. Session survives normal page navigation and refresh until logout or expiry.
  4. Login, logout, and denied access events are visible in logs.
**Plans**: 5 plans

Plans:
- [x] 02-01: Implement access domain, identity storage, and session lifecycle.
- [x] 02-02: Build unified shell routes, lottery entry flow, and post-login redirection.
- [x] 02-03: Add role guards for UI and server boundaries.
- [x] 02-04: Add access-related logs and verification scenarios.
- [x] 02-05: Add test UI harness for post-implementation access verification.

### Phase 3: Lottery Registry and Draw Pipeline
**Goal**: Make lotteries configurable entities with per-lottery forms, visibility controls, and scheduled draw data freshness.
**Depends on**: Phase 2
**Requirements**: [LOTR-01, LOTR-02, LOTR-03, LOTR-04, LOTR-05, DRAW-01, DRAW-02, DRAW-03, DRAW-04]
**Canonical refs**: [.planning/PROJECT.md, .planning/REQUIREMENTS.md, .planning/research/FEATURES.md, .planning/research/ARCHITECTURE.md, .planning/research/PITFALLS.md]
**UI hint**: yes
**Success Criteria** (what must be TRUE):
  1. Only enabled lotteries appear on the main screen and their display order is administratively controlled.
  2. Lottery pages share a shell but render lottery-specific forms from registry metadata.
  3. Draw data is stored per lottery with freshness timestamps and clearly visible stale-state indicators.
  4. Purchase initiation is blocked when required draw data is missing or stale.
**Plans**: 1/4 plans executed

Plans:
- [x] 03-01: Implement lottery registry storage, ordering, visibility, and handler references.
- [x] 03-02: Build dynamic lottery form rendering from registry metadata.
- [ ] 03-03: Implement draw refresh ingestion and freshness model.
- [ ] 03-04: Add admin controls and verification coverage for registry/draw behavior.

### Phase 4: Internal Ledger and Wallet Views
**Goal**: Deliver the internal money model with reserve/debit/release flows, immutable ledger entries, and wallet visibility.
**Depends on**: Phase 3
**Requirements**: [BAL-01, BAL-02, BAL-03, BAL-05, BAL-06]
**Canonical refs**: [.planning/PROJECT.md, .planning/REQUIREMENTS.md, .planning/research/ARCHITECTURE.md, .planning/research/PITFALLS.md]
**UI hint**: yes
**Success Criteria** (what must be TRUE):
  1. Ledger operations support reserve, final debit, and release transitions with immutable history.
  2. Each balance mutation is linked to a request or ticket reference and can be audited.
  3. User-facing wallet view shows available funds, reserved funds, and movement history.
  4. Ledger flows can be verified locally through integration tests without the production terminal.
**Plans**: 4 plans

Plans:
- [ ] 04-01: Implement user wallet aggregates and immutable ledger entry model.
- [ ] 04-02: Add reserve/debit/release transaction rules and idempotency guards.
- [ ] 04-03: Build wallet and balance history views for the user area.
- [ ] 04-04: Add financial verification scenarios and operator notes for ledger debugging.

### Phase 5: Purchase Request Orchestration
**Goal**: Turn user ticket input into a confirmable, cancelable, traceable purchase request ready for terminal execution.
**Depends on**: Phase 4
**Requirements**: [PURC-01, PURC-02, PURC-03, PURC-04, PURC-05, PURC-06]
**Canonical refs**: [.planning/PROJECT.md, .planning/REQUIREMENTS.md, .planning/research/FEATURES.md, .planning/research/PITFALLS.md]
**UI hint**: yes
**Success Criteria** (what must be TRUE):
  1. Ticket parameters are validated and priced according to the selected lottery before confirmation.
  2. Confirmation dialog presents the final purchase snapshot before request creation.
  3. Request creation writes immutable request data, reserves funds, and adds the request to the queue.
  4. User can cancel a queued request before terminal execution starts and see current statuses and attempt counts.
**Plans**: 5 plans

Plans:
- [ ] 05-01: Implement lottery-specific validation and pricing pipeline.
- [ ] 05-02: Build confirmation dialog and immutable request snapshot creation.
- [ ] 05-03: Connect request creation to ledger reserve and queue insertion.
- [ ] 05-04: Add cancelability rules and request state machine transitions.
- [ ] 05-05: Build user request history/status views and verification coverage.

### Phase 6: Main Terminal Execution Engine
**Goal**: Execute queued requests on the single main terminal with deterministic handlers, retries, and normalized results.
**Depends on**: Phase 5
**Requirements**: [TERM-01, TERM-02, TERM-03, TERM-04, TERM-05, TERM-06]
**Canonical refs**: [.planning/PROJECT.md, .planning/REQUIREMENTS.md, .planning/research/STACK.md, .planning/research/ARCHITECTURE.md, .planning/research/PITFALLS.md]
**UI hint**: no
**Success Criteria** (what must be TRUE):
  1. Only one request is actively executed on the terminal at any moment.
  2. Regular requests respect sequential queue order while administrator priority requests jump ahead of non-started regular items.
  3. Terminal execution uses predefined handlers by lottery code and captures raw terminal text for every attempt.
  4. Retry policy handles transient failures and moves exhausted requests to final error without losing auditability.
  5. Administrator can observe terminal state as idle, busy, degraded, or offline.
**Plans**: 5 plans

Plans:
- [ ] 06-01: Implement durable queue worker and exclusive terminal execution lock.
- [ ] 06-02: Add handler registry and deterministic terminal adapter boundary.
- [ ] 06-03: Capture raw terminal outputs and normalize execution outcomes.
- [ ] 06-04: Implement retry policy, failure classification, and final error handling.
- [ ] 06-05: Expose terminal health/state and add terminal-focused verification scenarios.

### Phase 7: Ticket Verification and Winnings
**Goal**: Persist purchased tickets, verify them after the draw through the terminal, and apply winnings to balance.
**Depends on**: Phase 6
**Requirements**: [TICK-01, TICK-02, TICK-03, TICK-04, BAL-04]
**Canonical refs**: [.planning/PROJECT.md, .planning/REQUIREMENTS.md, .planning/research/ARCHITECTURE.md, .planning/research/PITFALLS.md, .planning/research/SUMMARY.md]
**UI hint**: yes
**Success Criteria** (what must be TRUE):
  1. Successful purchases create persistent ticket records linked to request and draw.
  2. Post-draw verification reads ticket results through the terminal without extra manual steps once started.
  3. Ticket records store verification status, raw result text, and winning amount.
  4. Winning verification credits user balance and the user sees updated ticket/result data.
**Plans**: 4 plans

Plans:
- [ ] 07-01: Persist ticket records and connect them to successful purchase outcomes.
- [ ] 07-02: Implement scheduled or triggered ticket verification flow through the terminal.
- [ ] 07-03: Normalize verification results and apply winnings to the ledger.
- [ ] 07-04: Build user-facing ticket result views and verification coverage.

### Phase 8: Admin Operations and Observability
**Goal**: Provide administrators with queue control visibility, problem triage, terminal awareness, and actionable audits/alerts.
**Depends on**: Phase 7
**Requirements**: [ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04, AUDT-01, AUDT-02, AUDT-03]
**Canonical refs**: [.planning/PROJECT.md, .planning/REQUIREMENTS.md, .planning/research/FEATURES.md, .planning/research/PITFALLS.md, .planning/research/SUMMARY.md]
**UI hint**: yes
**Success Criteria** (what must be TRUE):
  1. Administrator sees live queue order, priority flags, and the currently executing request.
  2. Administrator can create priority requests without interrupting active terminal work.
  3. Failed requests, financial anomalies, and terminal problems are visible with actionable detail.
  4. Audit trails cover user, admin, request, terminal, and balance events with enough context for investigation.
  5. Critical failures trigger visible operational alerts.
**Plans**: 4 plans

Plans:
- [ ] 08-01: Build admin queue and priority request management screens.
- [ ] 08-02: Build lottery controls, terminal status, and problem request dashboards.
- [ ] 08-03: Implement structured audit/event logging and alert aggregation.
- [ ] 08-04: Add admin verification paths and operational troubleshooting notes.

### Phase 9: Hardening, Extension Docs, and Release Readiness
**Goal**: Make the system easier to change by finalizing living documentation, extension guides, and regression safety nets across modules.
**Depends on**: Phase 8
**Requirements**: [DOCS-01, DOCS-02, DOCS-03]
**Canonical refs**: [.planning/PROJECT.md, .planning/REQUIREMENTS.md, .planning/research/STACK.md, .planning/research/ARCHITECTURE.md, .planning/research/SUMMARY.md]
**UI hint**: yes
**Success Criteria** (what must be TRUE):
  1. Architecture, module responsibility, and data flow docs match the implemented system.
  2. Each module has explicit local verification guidance for partial delivery and regression checks.
  3. Adding or changing a lottery handler is documented through extension points and operator runbooks.
  4. Cross-module regression checks cover the critical user/admin flows before release.
**Plans**: 4 plans

Plans:
- [ ] 09-01: Reconcile architecture/module docs with the built codebase.
- [ ] 09-02: Write per-module verification guides and partial regression recipes.
- [ ] 09-03: Document lottery handler extension workflow and operator runbooks.
- [ ] 09-04: Add final regression suite and release-readiness checklist.

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation Contracts | 4/4 | Complete | 2026-04-05 |
| 2. Access and Unified Shell | 5/5 | Complete   | 2026-04-05 |
| 3. Lottery Registry and Draw Pipeline | 2/4 | In Progress|  |
| 4. Internal Ledger and Wallet Views | 0/4 | Not started | - |
| 5. Purchase Request Orchestration | 0/5 | Not started | - |
| 6. Main Terminal Execution Engine | 0/5 | Not started | - |
| 7. Ticket Verification and Winnings | 0/4 | Not started | - |
| 8. Admin Operations and Observability | 0/4 | Not started | - |
| 9. Hardening, Extension Docs, and Release Readiness | 0/4 | Not started | - |
