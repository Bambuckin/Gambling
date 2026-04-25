# Lottery Terminal Operations System

## What This Is

Локальная веб-система для работы с лотерейными билетами через клиентские компьютеры и один главный терминал исполнения. Пользователь выбирает лотерею, проходит авторизацию, видит актуальные тиражи, формирует билет, подтверждает покупку и получает статусы покупки и проверки билета; администратор управляет доступностью лотерей, очередью, ошибками и состоянием терминала.

## Core Value

Каждая подтвержденная покупка должна предсказуемо пройти путь от веб-интерфейса до единственного главного терминала с корректным резервированием и списанием денег, понятным статусом и полным журналом событий.

## Current State

- Shipped milestone: `v1.1 Domain Consolidation and Truth Model` on `2026-04-22`.
- Текущий runtime покрывает рабочий контур кассира и администратора: авторизация, выбор лотереи, отправка покупки, строго одиночное terminal execution, закрытие и расчёт тиража, видимость результата билета и выплата выигрыша.
- Операционная truth-модель стала canonical-first на `purchase`, `draw` и `purchase_attempt`; legacy request/ticket storage больше не является активным источником runtime-истины.
- Архив milestone лежит в `.planning/milestones/v1.1-ROADMAP.md` и `.planning/milestones/v1.1-REQUIREMENTS.md`.

## Known Gaps

- Live target-LAN NLoto selector/session smoke всё ещё нужно зафиксировать на реальной terminal-машине.
- Compatibility tables физически ещё существуют; удалять их нужно только в отдельное миграционное окно.
- Формальная verification-дисциплина неполная для фаз `1-17` и `22-25`; детали зафиксированы в `.planning/v1.1-MILESTONE-AUDIT.md`.

## Next Milestone Goals

- Подтвердить реальный NLoto flow на целевой LAN-топологии и дожать recovery селекторов или сессии там, где это всплывёт.
- Решить, идёт ли destructive cleanup compatibility storage в следующий milestone или в отдельное maintenance-окно.
- Сформулировать новый активный набор требований вместо протаскивания архивных предпосылок `v1` и `v1.1`.

## Archived Milestone Context: v1.1 Domain Consolidation and Truth Model

**Goal:** Collapse split runtime truth into canonical `purchase` and `draw` models without breaking the working Big 8 contour.

**Target features:**

- canonical `purchase` aggregate with separate execution, result, and visibility axes;
- canonical `draw` lifecycle with explicit `open -> closed -> settled` control;
- additive storage migration with compatibility read models for current web/admin surfaces;
- durable `purchase_attempt` history plus worker and lock hardening before transport replacement.

## Requirements

### Validated

- Базовый `v1`/`v1.1` контур shipped и архивирован; актуальный снимок требований лежит в `.planning/milestones/v1.1-REQUIREMENTS.md`.

### Active

- Активного milestone сейчас нет. Следующий входной шаг: `/gsd-new-milestone`.

### Out of Scope

- Несколько одновременно активных главных терминалов.
- Прямой доступ пользователя к браузеру или автоматизации главного терминала.
- Генерация произвольного исполняемого кода из пользовательских параметров билета.
- Публичные интернет-сценарии пополнения или вывода средств.
- Нативные мобильные приложения.

## Context

- Система остаётся локальной и LAN-ориентированной вокруг одного терминала исполнения.
- Финансовые операции должны оставаться трассируемыми и идемпотентными по ссылкам на request и ticket.
- Лотерейно-специфическая автоматизация остаётся за подготовленными handler-ами и registry.
- Доставка изменений остаётся фазовой: малыми срезами, с локальной проверкой и с письменными артефактами.

## Constraints

- **Topology**: один главный терминал, параллельное активное исполнение покупок недопустимо.
- **Network**: пользователь работает только через веб-интерфейс в локальной сети.
- **Automation**: только заранее подготовленные lottery handlers, без runtime-генерации сценариев из пользовательского ввода.
- **Reliability**: заявки, тиражи, билеты и баланс должны переживать ошибки, retry и перезапуски без потери состояния.
- **Financial Integrity**: любые денежные операции должны быть аудируемыми и идемпотентными.
- **Documentation**: архитектурные границы, operator flow и сценарии проверки должны жить рядом с кодом.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Общий каркас + подключаемые lottery adapters | Позволяет держать единый UX и добавлять новые лотереи без переписывания ядра | shipped |
| Очередь и worker как единственная точка terminal execution | Убирает гонки и удерживает one-terminal topology | shipped |
| Canonical-first truth на `purchase`, `draw`, `purchase_attempt` | Упрощает статусную модель и убирает зависимость от legacy write-path как operational truth | shipped |
| Additive migration до отдельного destructive window | Снижает риск регрессий в живом контуре | active constraint |

## Evolution

Этот документ обновляется на границе milestone-ов. Когда активный milestone не открыт, он должен честно фиксировать текущее shipped-состояние, известные дыры и первый следующий шаг.

---
*Last updated: 2026-04-22 after archiving milestone v1.1*
