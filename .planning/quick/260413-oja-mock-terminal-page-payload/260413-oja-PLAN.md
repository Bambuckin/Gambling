# Quick Task 260413-oja: Mock terminal page payload check

Status: completed
Date: 2026-04-13

## Goal

На одном компьютере проверить, что payload Big 8 уходит из веб-интерфейса в worker lifecycle, без реальной оплаты и без зависимости от живого NL checkout.

## Tasks

1. Add deterministic `mock` terminal mode for `bolshaya-8` handler in terminal worker.
2. Add debug page + API to view payloads consumed by worker (`/debug/mock-terminal`).
3. Update runtime docs/templates for switching between `real` and `mock` modes.
4. Run verification commands (`typecheck`, tests, web build).
