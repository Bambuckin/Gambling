# Conventions

## Delivery

- Start file-changing work through a GSD workflow so planning artifacts stay in sync.
- Keep work modular and phase-aligned instead of scattering cross-cutting changes.
- Prefer vertical slices that are partially runnable and testable.

## Design

- Separate platform logic from lottery-specific adapters.
- Treat request transitions and balance mutations as auditable domain events.
- Make idempotency explicit for reserve, debit, release, retry, and winnings credit flows.
- Keep terminal integration behind contracts so local development can rely on stubs.

## Documentation

- Update architecture and module docs when boundaries change.
- Each module should carry verification notes for local smoke, integration, or unit checks.
- New lottery support must document registry fields, handler contracts, and operator steps.

## Testing

- Add unit checks for pricing, validation, and state transitions.
- Add integration checks for ledger, queue, request orchestration, and result flows.
- Keep at least one local smoke path that works without the production terminal.
