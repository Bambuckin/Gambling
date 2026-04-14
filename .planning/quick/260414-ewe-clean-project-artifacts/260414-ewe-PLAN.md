# Quick Task 260414-ewe: Очистить репозиторий от локальных зависимостей, кэшей и сборочных артефактов, сохранив только файлы проекта

**Status:** In Progress
**Date:** 2026-04-14

## Goal

Убрать из рабочей директории только локальные артефакты окружения и сборки, не затрагивая исходники, документацию, planning-файлы проекта и локальные `.env`.

## Acceptance Criteria

- Удалены `node_modules` и вложенные `node_modules`.
- Удалены `.next`, `.pnpm-store`, `*.tsbuildinfo` и runtime/log-артефакты в `.planning`.
- Сохранены каталоги `apps`, `packages`, `docs`, `scripts`, `ops`, `.planning`, `.git` и корневые конфиги проекта.
- После очистки в репозитории не осталось перечисленных артефактов.

## Files Most Likely Involved

- `.planning/STATE.md`
- `.planning/quick/260414-ewe-clean-project-artifacts/260414-ewe-SUMMARY.md`

## Steps

1. Удалить локальные зависимости и сборочные каталоги.
2. Удалить кэши и временные файлы TypeScript/runtime.
3. Проверить остаточную структуру и обновить planning-артефакты.
