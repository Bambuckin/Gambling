import { describe, expect, it } from "vitest";
import {
  LedgerValidationError,
  applyLedgerEntry,
  buildBalanceSnapshot,
  createBalanceSnapshot,
  normalizeLedgerEntry
} from "../ledger.js";
import type { LedgerEntry } from "../ledger.js";

describe("ledger domain", () => {
  it("builds wallet aggregate from immutable reserve/debit/release history", () => {
    const snapshot = buildBalanceSnapshot({
      userId: "seed-user",
      currency: "RUB",
      entries: [
        createEntry({
          entryId: "entry-credit",
          operation: "credit",
          amountMinor: 100_000,
          createdAt: "2026-04-05T10:00:00.000Z",
          idempotencyKey: "idem-credit",
          reference: {
            requestId: "seed-credit"
          }
        }),
        createEntry({
          entryId: "entry-reserve",
          operation: "reserve",
          amountMinor: 30_000,
          createdAt: "2026-04-05T10:05:00.000Z",
          idempotencyKey: "idem-reserve",
          reference: {
            requestId: "req-1"
          }
        }),
        createEntry({
          entryId: "entry-debit",
          operation: "debit",
          amountMinor: 20_000,
          createdAt: "2026-04-05T10:06:00.000Z",
          idempotencyKey: "idem-debit",
          reference: {
            requestId: "req-1"
          }
        }),
        createEntry({
          entryId: "entry-release",
          operation: "release",
          amountMinor: 10_000,
          createdAt: "2026-04-05T10:07:00.000Z",
          idempotencyKey: "idem-release",
          reference: {
            requestId: "req-2"
          }
        })
      ]
    });

    expect(snapshot).toEqual({
      userId: "seed-user",
      availableMinor: 80_000,
      reservedMinor: 0,
      currency: "RUB"
    });
  });

  it("rejects operations that cause reserved underflow", () => {
    const snapshot = createBalanceSnapshot({
      userId: "seed-user",
      currency: "RUB",
      availableMinor: 10_000,
      reservedMinor: 0
    });
    const debit = createEntry({
      entryId: "entry-underflow",
      operation: "debit",
      amountMinor: 5_000,
      idempotencyKey: "idem-underflow",
      reference: {
        requestId: "req-underflow"
      }
    });

    expect(() => applyLedgerEntry(snapshot, debit)).toThrow(LedgerValidationError);
    expect(() => applyLedgerEntry(snapshot, debit)).toThrow("negative reserved");
  });

  it("rejects mixed-currency wallet streams", () => {
    const action = () =>
      buildBalanceSnapshot({
        userId: "seed-user",
        currency: "RUB",
        entries: [
          createEntry({
            entryId: "entry-rub",
            operation: "credit",
            amountMinor: 1_000,
            currency: "RUB",
            idempotencyKey: "idem-rub",
            reference: {
              requestId: "req-rub"
            }
          }),
          createEntry({
            entryId: "entry-usd",
            operation: "credit",
            amountMinor: 1_000,
            currency: "USD",
            idempotencyKey: "idem-usd",
            reference: {
              requestId: "req-usd"
            }
          })
        ]
      });

    expect(action).toThrow(LedgerValidationError);
    expect(action).toThrow("does not match wallet currency");
  });

  it("normalizes and validates immutable entry shape", () => {
    const normalized = normalizeLedgerEntry(
      createEntry({
        entryId: "  entry-normalized  ",
        userId: "  seed-user  ",
        operation: "credit",
        amountMinor: 1500,
        currency: " rub ",
        createdAt: "2026-04-05T10:00:00.000Z",
        idempotencyKey: "  idem-normalized  ",
        reference: {
          requestId: "  req-normalized  ",
          drawId: "  draw-1  "
        }
      })
    );

    expect(normalized).toEqual({
      entryId: "entry-normalized",
      userId: "seed-user",
      operation: "credit",
      amountMinor: 1500,
      currency: "RUB",
      idempotencyKey: "idem-normalized",
      reference: {
        requestId: "req-normalized",
        drawId: "draw-1"
      },
      createdAt: "2026-04-05T10:00:00.000Z"
    });
  });

  it("requires request or ticket reference for traceability", () => {
    const action = () =>
      normalizeLedgerEntry(
        createEntry({
          entryId: "entry-no-ref",
          operation: "credit",
          amountMinor: 100,
          idempotencyKey: "idem-no-ref",
          reference: {
            drawId: "draw-only"
          }
        })
      );

    expect(action).toThrow(LedgerValidationError);
    expect(action).toThrow("must include at least one request/ticket reference");
  });

  it("requires requestId for reserve/debit/release operations", () => {
    const action = () =>
      normalizeLedgerEntry(
        createEntry({
          entryId: "entry-reserve-no-request",
          operation: "reserve",
          amountMinor: 100,
          idempotencyKey: "idem-reserve-no-request",
          reference: {
            ticketId: "ticket-only"
          }
        })
      );

    expect(action).toThrow(LedgerValidationError);
    expect(action).toThrow("requires requestId reference");
  });

  it("applies manual_credit to available balance", () => {
    const snapshot = buildBalanceSnapshot({
      userId: "seed-user",
      currency: "RUB",
      entries: [
        createEntry({
          entryId: "e1",
          operation: "credit",
          amountMinor: 50_000,
          idempotencyKey: "idem-1",
          reference: { requestId: "r1" }
        }),
        createEntry({
          entryId: "e2",
          operation: "manual_credit",
          amountMinor: 10_000,
          idempotencyKey: "idem-2",
          reference: { adminAdjustmentId: "adj-1" }
        })
      ]
    });

    expect(snapshot.availableMinor).toBe(60_000);
    expect(snapshot.reservedMinor).toBe(0);
  });

  it("applies manual_debit from available balance", () => {
    const snapshot = buildBalanceSnapshot({
      userId: "seed-user",
      currency: "RUB",
      entries: [
        createEntry({
          entryId: "e1",
          operation: "credit",
          amountMinor: 50_000,
          idempotencyKey: "idem-1",
          reference: { requestId: "r1" }
        }),
        createEntry({
          entryId: "e2",
          operation: "manual_debit",
          amountMinor: 20_000,
          idempotencyKey: "idem-2",
          reference: { adminAdjustmentId: "adj-1" }
        })
      ]
    });

    expect(snapshot.availableMinor).toBe(30_000);
    expect(snapshot.reservedMinor).toBe(0);
  });

  it("rejects manual operations without adminAdjustmentId reference", () => {
    const action = () =>
      normalizeLedgerEntry(
        createEntry({
          entryId: "e-bad",
          operation: "manual_credit",
          amountMinor: 100,
          idempotencyKey: "idem-bad",
          reference: { requestId: "r1" }
        })
      );

    expect(action).toThrow(LedgerValidationError);
    expect(action).toThrow("requires adminAdjustmentId reference");
  });

  it("rejects manual_debit that causes negative available balance", () => {
    const snapshot = buildBalanceSnapshot({
      userId: "seed-user",
      currency: "RUB",
      entries: [
        createEntry({
          entryId: "e1",
          operation: "credit",
          amountMinor: 5_000,
          idempotencyKey: "idem-1",
          reference: { requestId: "r1" }
        })
      ]
    });

    const overDebit = createEntry({
      entryId: "e2",
      operation: "manual_debit",
      amountMinor: 10_000,
      idempotencyKey: "idem-2",
      reference: { adminAdjustmentId: "adj-1" }
    });

    expect(() => applyLedgerEntry(snapshot, overDebit)).toThrow(LedgerValidationError);
    expect(() => applyLedgerEntry(snapshot, overDebit)).toThrow("negative available");
  });

  it("accepts adminAdjustmentId as valid ledger reference", () => {
    const entry = normalizeLedgerEntry(
      createEntry({
        entryId: "e-adj",
        operation: "manual_credit",
        amountMinor: 1_000,
        idempotencyKey: "idem-adj",
        reference: { adminAdjustmentId: "adj-100" }
      })
    );

    expect(entry.reference.adminAdjustmentId).toBe("adj-100");
  });
});

function createEntry(overrides: Partial<LedgerEntry>): LedgerEntry {
  return {
    entryId: overrides.entryId ?? "entry-default",
    userId: overrides.userId ?? "seed-user",
    operation: overrides.operation ?? "credit",
    amountMinor: overrides.amountMinor ?? 1000,
    currency: overrides.currency ?? "RUB",
    idempotencyKey: overrides.idempotencyKey ?? "idem-default",
    reference: overrides.reference ?? {
      requestId: "req-default"
    },
    createdAt: overrides.createdAt ?? "2026-04-05T10:00:00.000Z"
  };
}
