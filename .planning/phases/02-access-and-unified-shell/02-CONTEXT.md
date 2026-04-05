---
phase: "02"
name: "access-and-unified-shell"
created: 2026-04-05
updated: 2026-04-05
status: "execution-ready"
source: "resume + direct execution request"
---

# Phase 2: Access and Unified Shell - Context

<domain>
## Phase Boundary

Phase 2 delivers authentication and unified shell behavior for lottery entry.

`02-01` scope is intentionally narrow and executable:
- define access domain model and session lifecycle contracts;
- add identity/session storage ports and the first access use case;
- implement deterministic in-memory adapters for local execution and tests.

UI routing and post-login return flow stay for `02-02`.
</domain>

<decisions>
## Locked Decisions

### Access Model
- Roles are explicitly constrained to `"user"` and `"admin"`.
- Identity lookup is case-insensitive by login, while stored login is canonicalized.
- Session record must include: issue time, expiry time, last seen time, optional revoke time, and optional `returnToLotteryCode`.

### Ownership and Boundaries
- `@lottery/domain` owns pure access/session data contracts and lifecycle checks.
- `@lottery/application` owns access orchestration use case and storage/verifier ports.
- `@lottery/infrastructure` owns in-memory adapter implementations.
- `apps/web` does not own auth business logic in `02-01`.

### Lifecycle Rules
- Login creates a new session only for active identity + valid password.
- Session is considered valid only when not revoked and not expired.
- Logout revokes session and blocks further authentication with the same session id.
</decisions>

<canonical_refs>
## Canonical References

- `.planning/ROADMAP.md` - Phase 2 goal and plan sequence (`02-01`..`02-04`)
- `.planning/REQUIREMENTS.md` - AUTH-01..AUTH-05 scope
- `docs/modules/boundary-catalog.md` - ownership/anti-ownership rules
- `packages/domain/src/request-state.ts` - contract style baseline
- `packages/application/src/ports/*.ts` - application port style baseline
</canonical_refs>

<specifics>
## Specific Ideas

- Keep password verification behind a dedicated port so future phases can swap verifier/storage without touching use cases.
- Include `returnToLotteryCode` in session model now to avoid cross-module rewiring in `02-02`.
</specifics>

<deferred>
## Deferred Ideas

- Persistent storage (DB-backed identity/session repositories).
- Access event/audit transport and admin-facing access logs (covered in `02-04`).
- UI login form, route guards, and redirect UX (covered in `02-02` and `02-03`).
</deferred>

---
*Phase: 02-access-and-unified-shell*
*Context updated: 2026-04-05 for direct execution of 02-01*
