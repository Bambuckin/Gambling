# Phase 16: Admin User Management and Manual Finance - Summary

**Completed:** 2026-04-16
**Status:** Complete

## What Was Done

### Domain Layer
- Added `manual_credit` and `manual_debit` to `LedgerOperationType` with movement deltas (available +/−).
- Added `adminAdjustmentId` to `LedgerReference` as a valid reference type for manual operations.
- Added `requiresAdminAdjustmentReference()` validation — manual operations must carry `adminAdjustmentId`.
- Added `IdentityFieldUpdate` type and `applyIdentityFieldUpdate()` function for immutable identity field updates.

### Application Layer
- `AdminUserService` — list all users, get by identityId, update user fields (login, displayName, phone, role, status, password).
  - Login uniqueness check across identities.
  - Password change via `PasswordVerifier.hash()`.
- `AdminManualFinanceService` — manual credit and debit with reason requirement.
  - Idempotent by `adjustmentId`.
  - Uses domain `buildBalanceSnapshot` for balance validation (rejects over-debit).
- Extended `IdentityStore` port with `listAll()` and `save()` methods.
- Extended `PasswordVerifier` port with `hash()` method.

### Infrastructure Layer
- `InMemoryIdentityStore` — added `listAll()` and `save()` implementations.
- `PostgresIdentityStore` — added `listAll()` and `save()` implementations (delegating to existing `upsert`).
- `Sha256PasswordVerifier` — added `hash()` method wrapping `hashAccessPassword`.

### Web Layer
- `access-runtime.ts` — added `getAdminUserService()` factory.
- `ledger-runtime.ts` — added `getLedgerStoreInstance()` for shared ledger store access.
- `purchase-runtime.ts` — added `getAdminManualFinanceService()` factory.
- Admin page (`/admin`):
  - User Management section with user list table and Edit button.
  - User edit form (login, displayName, phone, role, status, password) with Save Changes action.
  - Manual Balance Adjustment form (credit/debit, amount, reason) per user.

## Verification

- `corepack pnpm --filter @lottery/domain test` — 61 tests passed (12 new: 7 access, 5 ledger manual ops)
- `corepack pnpm --filter @lottery/application test` — 110 tests passed (18 new: 12 admin-user, 6 admin-manual-finance)
- `corepack pnpm --filter @lottery/web build` — clean
- Pre-existing typecheck errors in `apps/terminal-worker/src/main.ts` (unrelated).

## Files Changed

### New Files
- `packages/application/src/services/admin-user-service.ts`
- `packages/application/src/services/admin-manual-finance-service.ts`
- `packages/domain/src/__tests__/access.test.ts`
- `packages/application/src/__tests__/admin-user-service.test.ts`
- `packages/application/src/__tests__/admin-manual-finance-service.test.ts`

### Modified Files
- `packages/domain/src/ledger.ts` — manual_credit, manual_debit, adminAdjustmentId, requiresAdminAdjustmentReference
- `packages/domain/src/access.ts` — IdentityFieldUpdate, applyIdentityFieldUpdate
- `packages/application/src/ports/identity-store.ts` — listAll, save
- `packages/application/src/ports/password-verifier.ts` — hash
- `packages/application/src/index.ts` — new exports
- `packages/domain/src/__tests__/ledger.test.ts` — 5 new tests
- `packages/infrastructure/src/access/in-memory-identity-store.ts` — listAll, save
- `packages/infrastructure/src/access/sha256-password-verifier.ts` — hash
- `packages/infrastructure/src/postgres/postgres-access-store.ts` — listAll, save
- `apps/web/src/lib/access/access-runtime.ts` — getAdminUserService
- `apps/web/src/lib/ledger/ledger-runtime.ts` — getLedgerStoreInstance
- `apps/web/src/lib/purchase/purchase-runtime.ts` — getAdminManualFinanceService
- `apps/web/src/app/admin/page.tsx` — User Management section, edit form, manual balance UI, server actions

## Deferred

- User drill-down history view (requests, tickets, winnings, cash-desk, ledger per user) — visible in phase spec but not yet built. Can be added in Phase 17 or as a micro-task.
- `WinningsCreditService.processNextCreditJob()` worker wiring still pending.

---

*Phase: 16-admin-user-management-and-manual-finance*
*Summary created: 2026-04-16*
