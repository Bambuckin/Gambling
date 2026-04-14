# UI Customization Guide

This guide explains where to change the customer purchase UI without touching business logic.

## 1. Core UI entry points

- `apps/web/src/app/layout.tsx` - global shell, fonts, top navigation.
- `apps/web/src/app/styles.css` - global design tokens, cards, tables, forms, responsive rules.
- `apps/web/src/app/page.tsx` - main lottery catalog screen.
- `apps/web/src/app/login/page.tsx` - login screen.
- `apps/web/src/app/lottery/[lotteryCode]/page.tsx` - purchase flow UI (draft, confirm, queue, status).

## 2. Where lottery visual presets live

- `apps/web/src/lib/ui/lottery-presentation.ts`

Each lottery code has:
- `category`
- `tagline`
- `accentFrom`
- `accentTo`

If a new code has no preset, fallback styling is applied automatically.

## 3. Where default lottery catalog data lives

- `packages/infrastructure/src/seeds/default-lottery-catalog.ts`

This file controls:
- default registry entries (codes, titles, forms, handlers, prices),
- default draw snapshots,
- default worker handler code list.

It is used by:
- in-memory runtime in `apps/web`,
- Postgres bootstrap script `scripts/postgres-init-and-seed.ts`,
- worker default handler code resolution.

## 4. Source provenance for the seeded NLoto game set

`nloto.ru` is protected by anti-bot challenge from this environment.
To keep a real source, lottery names/slugs were taken from official National Lottery Telegram posts with links to `https://nloto.ru/lottery/*`:

- channel: `https://t.me/s/nationallottery_ru`
- verification date: 2026-04-06

If your operations team has direct browser access to `nloto.ru`, re-check current active game list and update `default-lottery-catalog.ts` if needed.

## 5. Safe editing rules

1. Do not change server-action function signatures in `lottery/[lotteryCode]/page.tsx` unless you also update integration tests.
2. Keep `lotteryCode` stable once used in production requests/tickets.
3. If you rename lottery titles only, status/history remains intact.
4. If you add a lottery code:
   - add seed entry in `default-lottery-catalog.ts`,
   - add visual preset in `lottery-presentation.ts`,
   - add worker handler implementation (or keep stub in non-production).

