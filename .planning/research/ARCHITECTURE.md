# Architecture Research: Lottery Terminal Operations System

## Major Components

1. **Web UI Shell**
   Общий интерфейс для пользователя и администратора: каталог лотерей, страницы лотерей, подтверждение покупки, личная зона, админские экраны.

2. **Access & Session Module**
   Авторизация, роли, возврат в выбранную лотерею, защита пользовательских и административных маршрутов.

3. **Lottery Registry Module**
   Описание лотерей, их доступности, порядка показа, схем форм, правил расчета стоимости и ссылок на terminal handlers.

4. **Draw Data Module**
   Хранение и актуализация тиражей по каждой лотерее, признаков freshness и служебных данных для покупки.

5. **Balance Ledger Module**
   Пользователи, доступный баланс, резерв, окончательное списание, возврат, начисление выигрыша, история операций.

6. **Purchase Orchestrator**
   Валидация билета, расчет стоимости, окно подтверждения, создание заявки, журнал состояний, отмена до допустимого момента, постановка в очередь.

7. **Queue & Terminal Gateway**
   Последовательная обработка заявок, приоритеты, terminal worker, запуск lottery-specific purchase/result handlers, retry policy.

8. **Ticket Result Module**
   Хранение купленных билетов, запуск сверки после розыгрыша, нормализация результата, запись суммы выигрыша.

9. **Admin & Operations Module**
   Управление доступностью лотерей, наблюдение за терминалом, очередь, ошибки, приоритетные действия, финансовые исключения.

10. **Audit/Logging Module**
    Системные журналы, журналы заявок и операций по балансу, события пользователя и администратора.

## Data Flow

### Purchase Flow

`Web UI` → `Access` → `Lottery Registry + Draw Data` → `Purchase Orchestrator` → `Balance Ledger (reserve)` → `Queue` → `Terminal Gateway` → `Ticket Result Module` → `Balance Ledger (final debit or release)` → `Audit/Logging` → `Web UI/Admin UI`

### Post-Draw Result Flow

`Scheduler / Admin trigger` → `Queue & Terminal Gateway` → `Ticket Result Module` → `Balance Ledger (winning credit)` → `Audit/Logging` → `Web UI/Admin UI`

## Boundary Rules

- UI не знает деталей browser automation.
- Terminal handlers не знают о веб-компонентах и пользовательской сессии.
- Ledger не должен зависеть от конкретной лотереи.
- Purchase orchestrator не должен содержать CSS/XPath/Playwright-деталей; он работает через handler contracts.
- Registry — единственный источник правды о том, какие лотереи доступны и какие обработчики им соответствуют.

## Build Order

1. Контракты платформы и stubs.
2. Access + базовый UI shell.
3. Registry + Draw Data.
4. Ledger.
5. Purchase Orchestrator.
6. Queue & Terminal Gateway.
7. Ticket Result Module.
8. Admin/Ops.
9. Hardening + docs + extension workflow.

Такой порядок режет риски по слоям и позволяет проверять поведение кусками, не собирая сразу всю систему.
