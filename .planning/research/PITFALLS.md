# Pitfalls Research: Lottery Terminal Operations System

## Critical Pitfalls

### 1. Balance and request state drift

- **Warning signs**: резерв создан, а статус заявки потерялся; финальное списание не совпадает с terminal result; есть операции без ссылки на заявку/билет.
- **Prevention**: отдельный ledger, идемпотентные переходы состояний, транзакционные изменения request + balance, запрет “ручных” silent updates.
- **Phase to address**: Phases 4-7.

### 2. Queue cancellation race

- **Warning signs**: пользователь “успешно отменил” заявку, которая уже ушла в терминал; два обработчика считают заявку своей.
- **Prevention**: четкая state machine заявки, атомарный захват заявки worker'ом, отдельное правило `cancelable_until`.
- **Phase to address**: Phases 5-6.

### 3. Brittle browser automation

- **Warning signs**: малейшее изменение страницы лотереи ломает покупку; нет raw terminal text для расследования.
- **Prevention**: adapter boundary, устойчивые селекторы, raw result capture, retry только для допустимых ошибок, smoke checks на handlers.
- **Phase to address**: Phase 6.

### 4. Registry entropy

- **Warning signs**: часть параметров лотереи хранится в UI, часть в backend, часть в handler'ах; добавление новой лотереи требует правок в пяти местах.
- **Prevention**: единый registry-источник истины, document-driven contract, extension guide.
- **Phase to address**: Phases 3 and 9.

### 5. Stale draw purchases

- **Warning signs**: покупка создается без актуального тиража; пользователь не видит, что данные устарели.
- **Prevention**: freshness model, blocking rules for stale draws, scheduled refresh with visible timestamps.
- **Phase to address**: Phase 3.

### 6. Opaque operational failures

- **Warning signs**: администратор видит только “ошибка”, но не понимает где и почему; нет связи между терминалом, заявкой и пользователем.
- **Prevention**: структурные логи, админ-алерты, списки проблемных заявок, runbook'и.
- **Phase to address**: Phase 8.

### 7. Docs lag behind code

- **Warning signs**: новый handler добавили, но никто не понимает где контракт, как тестировать и как запускать.
- **Prevention**: обязательные docs deliverables в roadmap, модульные README и verification notes как часть Definition of Done.
- **Phase to address**: Phase 9.
