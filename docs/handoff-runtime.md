# Runtime Handoff

Это короткий операционный handoff по текущему состоянию runtime.

## Читать в таком порядке

1. `docs/runbooks/deployment-bootstrap.md`
2. `docs/runbooks/current-working-contour-smoke.md`
3. `.planning/STATE.md`

## Что реально работает сейчас

- `apps/web` и `apps/terminal-worker` живут на одном Postgres runtime через `LOTTERY_STORAGE_BACKEND=postgres`.
- Каноническая истина уже первична для текущих admin, receiver и user read surfaces; активный Big 8 -> winnings contour больше не зависит от legacy ticket write-path, а legacy `purchase_request` и `ticket` остались только как compatibility/read-repair fallback.
- Полный ручной контур работает так: логин -> админ открывает тираж -> пользователь создаёт и подтверждает заявку -> worker забирает её -> админ помечает билет и закрывает тираж -> пользователь видит результат -> пользователь выбирает `Зачислить` или `В кассу` -> worker проводит credit job, а админ может закрыть cash-desk выплату.
- `/terminal/receiver` остаётся самым быстрым подтверждением того, что заявка реально дошла до terminal side.

## Важные нюансы

- Пустая очередь сама по себе не значит, что покупка пропала. Worker может сразу зарезервировать заявку, и тогда она уже видна в terminal rows или на `/terminal/receiver`.
- `db:init`, `start:web` и `start:worker` читают `.env` напрямую. Не нужно отдельно экспортировать `LOTTERY_POSTGRES_URL`, если он уже лежит в `.env`.
- Big 8 по умолчанию всё ещё идёт в `mock`-режиме. Для живого терминала нужно явно включить `LOTTERY_BIG8_TERMINAL_MODE=real`.
- В `mock`-режиме worker больше не создаёт тестовые тиражи сам. Нормальный путь теперь такой: создать тираж в `/admin`, купить билет, потом закрыть тираж там же.
- Ручные тиражи сохраняются в списке purchasable draws и не исчезают из формы после фонового refresh.
- Credit jobs обрабатываются самим worker loop. Cash-desk заявки создаются на пользовательской странице и закрываются действием `Выдать` в `/admin`.
- На `/lottery/bolshaya-8` теперь есть canonical-first блок `Итоги по аккаунту`, а у выигрышного билета есть явные действия `Зачислить` и `В кассу`.
- LAN client bundle стартует с `/login`, а terminal bundle открывает монитор `/terminal/receiver`.

## Текущая UI-поверхность

- `/login`: вход в ручной smoke и LAN kiosk contour.
- `/admin`: системная сводка, очередь, terminal rows, problem contour, alerts, recent audit, ручные тиражи, cash-desk выплаты, credit jobs, cleanup/reset.
- `/terminal/receiver`: canonical-first история terminal-side заявок.
- `/lottery/bolshaya-8`: создание билета, подтверждение заявки, выбор открытого тиража, статусы заявки, уведомления, результаты билетов, `Итоги по аккаунту`, `Зачислить`, `В кассу`.

## Что ещё не закончено

1. Real Big 8 flow now reaches truthful terminal purchase; remaining live risk is NLoto selector/session hardening under the target LAN setup.
2. Advisory execution lock and explicit purchase-queue transport seam are now live; active purchase -> draw -> result -> winnings flow больше не использует legacy ticket write-model как operational truth.
3. Полного destructive cleanup compatibility tables ещё нет; legacy `ticket`/request residue остаётся отдельным cleanup/migration шагом, а не активной runtime-зависимостью.
4. Если меняется каталог лотерей, синхронизируй:
   - `packages/infrastructure/src/seeds/default-lottery-catalog.ts`
   - `apps/web/src/lib/ui/lottery-presentation.ts`

## Быстрый старт

```powershell
# server
.\scripts\bootstrap-runtime.ps1 -EnvFile .env -SeedMode if-empty
.\scripts\start-web-runtime.ps1 -EnvFile .env

# worker
.\scripts\start-worker-runtime.ps1 -EnvFile .env
```

## Быстрая диагностика

```powershell
corepack pnpm runtime:doctor:queue
```

Запускай это до разбора live terminal, если заявки висят или `/admin` и `/terminal/receiver` расходятся по картине.

## Основной checklist

- `docs/runbooks/launch-readiness-checklist.md`
