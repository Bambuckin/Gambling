# Current Working Contour Smoke

Этот runbook нужен для ручной проверки текущего рабочего контура: покупка билета, обработка терминалом, закрытие тиража, показ результата, зачисление выигрыша или кассовая выплата.

## Цель

Подтвердить, что система умеет:

1. впустить пользователя через `/login`;
2. создать и подтвердить заявку на `/lottery/bolshaya-8`;
3. провести заявку через общий runtime и terminal worker;
4. показать заявку в `/admin` и `/terminal/receiver`;
5. закрыть тираж одним действием администратора и сразу показать результат пользователю;
6. дать пользователю выбрать `Зачислить` или `В кассу` для выигрышного билета;
7. показать credit/cash-desk follow-up в `/admin`.

## Предусловия

- web runtime поднят;
- worker runtime поднят;
- web и worker смотрят в один и тот же Postgres, если `LOTTERY_STORAGE_BACKEND=postgres`;
- есть seeded admin и обычный пользователь;
- для mock contour тираж создается вручную из `/admin`;
- Big 8 по умолчанию работает в mock-режиме, пока явно не задан `LOTTERY_BIG8_TERMINAL_MODE=real`;
- credit jobs обрабатывает worker loop, а cash-desk payout закрывается действием администратора.

Если нужно проверить оба payout path за один прогон, создай минимум два выигрышных билета. Один и тот же выигрышный билет нельзя честно прогнать через `Зачислить` и `В кассу` одновременно.

## Step 1. Подними runtime

На сервере:

```powershell
.\scripts\bootstrap-runtime.ps1 -EnvFile .env -SeedMode if-empty
.\scripts\start-web-runtime.ps1 -EnvFile .env
```

На terminal machine или локально в mock contour:

```powershell
.\scripts\start-worker-runtime.ps1 -EnvFile .env
```

Если гоняешь LAN bundles:

- на client PC открой `Start Client.cmd`;
- на terminal PC открой `Start Terminal Receiver.cmd`.

Ожидание:

- `/login` открывается;
- `/admin` открывается под admin;
- `/terminal/receiver` открывается и не падает;
- worker пишет heartbeat/poll logs без preflight error.

## Step 2. Админ создает тестовый тираж

1. Открой `/admin`.
2. Создай draw для `bolshaya-8`.

Ожидание:

- draw появляется в блоке открытых тиражей;
- draw становится доступен на `/lottery/bolshaya-8`;
- если мешает старое тестовое состояние, удали пустые draws или сделай cleanup/reset до продолжения.

## Step 3. Пользователь создает заявку

1. Открой `/login`.
2. Войди обычным пользователем.
3. Перейди на `/lottery/bolshaya-8`.
4. Убедись, что созданный draw виден в форме.
5. Подготовь и подтверди минимум одну заявку.
6. Для проверки обоих payout path повтори покупку второй раз по тому же draw.

Ожидание:

- заявка появляется в истории заявок;
- после mock purchase приходит purchase notification;
- пользовательская таблица показывает русские статусы, без raw backend/result/status строк;
- блок `Итоги по аккаунту` остается видимым и страница не ломается;
- после успешной покупки резерв очищается, а покупка отражается как финальное списание.

## Step 4. Проверь terminal-side visibility

Открой одновременно:

1. `/admin`
2. `/terminal/receiver`

Ожидание:

- заявка видна либо в queue snapshot, либо в terminal/last-request rows;
- canonical-only visibility на `/terminal/receiver` не зависит от legacy request journal;
- пустая очередь не считается ошибкой, если request уже ушел в terminal contour.

## Step 5. Админ помечает билет и закрывает тираж

1. Останься в `/admin`.
2. Найди tickets по этому draw.
3. Для payout-проверок пометь минимум один билет как win.
4. Закрой draw.

Ожидание:

- mark action проходит без page crash;
- draw становится закрытым/settled;
- отдельной кнопки публикации результата нет;
- пользователь получает closed-draw notifications;
- ticket rows показывают итоговый результат и claim state.

## Step 6. Пользователь видит финальный результат

1. Вернись на `/lottery/bolshaya-8` тем же пользователем.
2. Дождись live refresh или обнови страницу.

Ожидание:

- notification feed показывает итог покупки и итог закрытого тиража;
- ticket table показывает результат без raw result/status строк;
- для проигрыша действий нет;
- для выигрыша видны кнопки `Зачислить` и `В кассу`;
- блок `Итоги по аккаунту` отражает актуальное число билетов и суммарный результат.

## Step 7. Проверь путь `Зачислить`

1. На одном выигрышном билете нажми `Зачислить`.
2. Подожди один-два worker poll цикла.
3. Обнови `/lottery/bolshaya-8` и `/admin`.

Ожидание:

- claim state меняется на `Зачисление в очереди`, затем на `Зачислен`;
- доступный баланс пользователя растет на сумму выигрыша;
- в `/admin` появляется строка в `Зачисления выигрышей`;
- job доходит до `Зачислено`, а не зависает в queued.

## Step 8. Проверь путь `В кассу`

1. На другом выигрышном билете нажми `В кассу`.
2. Открой `/admin`.
3. Найди новую строку в `Кассовые выплаты`.
4. Нажми `Выдать`.
5. Вернись на `/lottery/bolshaya-8` и обнови страницу.

Ожидание:

- claim state становится `Ожидает кассу`;
- в `/admin` появляется cash-desk request с правильной суммой и request/purchase identity;
- после `Выдать` статус cash-desk row меняется на `Выдано`;
- на пользовательской странице claim state меняется на `Выдан в кассе`.

## Failure Triage

### Заявка не видна в очереди

Проверь `/terminal/receiver` и terminal rows на `/admin`. Чаще всего это значит, что worker уже зарезервировал request: queue snapshot пуст, но canonical receiver history уже содержит запись.

### Draw не появился на пользовательской странице

Проверь:

- draw действительно открыт, а не уже закрыт;
- пользователь находится на той же лотерее `bolshaya-8`;
- web и worker смотрят в одну базу;
- старое тестовое состояние не застряло, при необходимости используй cleanup/reset.

### Credit job не дошел до `Зачислено`

Проверь:

- worker реально запущен;
- в worker log нет ошибок `credit job processing failed`;
- user action создал job, и он виден в `/admin`.

### Cash-desk request не закрывается

Проверь:

- в `/admin` нажата именно кнопка `Выдать` у нужной строки;
- у cash-desk request нет старой уже оплаченной копии;
- страница после действия обновилась и не показывает stale state.

## Полезные команды

```powershell
corepack pnpm runtime:preflight
corepack pnpm runtime:doctor:queue
corepack pnpm release:check
corepack pnpm --filter @lottery/web build
corepack pnpm --filter @lottery/web typecheck
```

## Связанные документы

- `docs/modules/current-working-contour.md`
- `docs/handoff-runtime.md`
- `docs/runbooks/deployment-bootstrap.md`
