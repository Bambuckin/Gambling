# Research Summary: Lottery Terminal Operations System

## Stack Direction

Системе нужен типизированный модульный backend с транзакционной БД, durable queue/worker слоем и изолированным terminal automation adapter. Выбор конкретных технологий надо закрепить в Phase 1 через ADR, а не откладывать до середины проекта.

## Table Stakes

- Авторизация с возвратом в выбранную лотерею.
- Общий веб-shell + реестр лотерей с lottery-specific параметрами.
- Актуальные тиражи с freshness.
- Подтверждение покупки, очередь, один активный terminal execution.
- Внутренний ledger с резервом/списанием/возвратом/начислением.
- Пост-розыгрышная сверка билетов и админская операционка.

## Architecture Direction

Правильная форма проекта: `UI shell` + `access/session` + `registry/draws` + `ledger` + `purchase orchestrator` + `queue/terminal gateway` + `ticket results` + `admin/ops` + `audit`. Главный терминал должен быть адаптером системы, а не ее центром принятия бизнес-решений.

## Watch Out For

1. Расхождение состояний между заявкой и балансом.
2. Гонки отмены/захвата заявки в очереди.
3. Хрупкость browser automation.
4. Размазывание конфигурации лотерей по нескольким слоям.
5. Отсутствие операционной наблюдаемости.
6. Отставание документации от реальных модульных границ.

## Roadmap Implication

Проект надо вести не “сначала весь backend, потом весь frontend”, а вертикальными модулями:

1. foundation contracts;
2. access + shell;
3. registry + draws;
4. ledger;
5. purchase orchestration;
6. terminal execution;
7. ticket verification;
8. admin/ops;
9. hardening + docs.

Именно такая нарезка даст частично работоспособные куски, которые можно проверять и менять без массового передела.
