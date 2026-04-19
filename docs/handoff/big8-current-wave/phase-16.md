# Phase 16: Admin User Management and Manual Finance

## Goal

Give the admin full user drill-down, full business-field editing, password/status control, and manual balance adjustments with audit.

## Locked Decisions

- Admin can change every business user field.
- `identityId` stays immutable as the technical key and is read-only.
- Manual balance operations live inside the user detail view.
- All of this belongs to admin UI, not to ad-hoc scripts.

## Required Implementation

1. Add user list and user detail view.
   - Admin must be able to open a user and see the entire operational history in one place.

2. Add user editing.
   - Editable fields:
     - `login`
     - `password`
     - `role`
     - `status`
     - `displayName`
     - `phone`
   - `identityId` is visible but read-only.

3. Add block/unblock behavior.
   - A blocked user must stop authenticating successfully.

4. Add manual balance operations.
   - Minimum operations:
     - `manual_credit`
     - `manual_debit`
   - Each requires a reason.
   - Each writes immutable ledger/audit records.

5. Add user drill-down history.
   - Show related purchase requests, tickets, winning actions, cash desk requests, and ledger history.

## Likely Touch Points

- `packages/domain/src/access.ts`
- `packages/domain/src/ledger.ts`
- `packages/application/src/services/wallet-ledger-service.ts`
- `packages/infrastructure/src/postgres/postgres-access-store.ts`
- `packages/infrastructure/src/access/in-memory-identity-store.ts`
- `apps/web/src/app/admin/page.tsx`
- `apps/web/src/lib/access/access-runtime.ts`
- `apps/web/src/lib/ledger/wallet-view.ts`

## Acceptance Scenarios

- Admin can search/open a user and edit all business fields.
- Password change takes effect on the next login.
- Blocked user cannot log in.
- Manual credit and debit change wallet totals correctly and produce audit-visible history.
- User detail view shows all related operational objects without leaving the page.

## Out Of Scope

- Multi-admin role hierarchy.
- Fine-grained field-level permissions.
- Bulk user import/export.
