import type { LedgerEntry, BalanceSnapshot } from "@lottery/domain";
import type { TimeSource } from "../ports/time-source.js";
import type { LedgerStore } from "../ports/ledger-store.js";
import { buildBalanceSnapshot, sortLedgerEntries } from "@lottery/domain";

export interface AdminManualFinanceServiceDependencies {
  readonly ledgerStore: LedgerStore;
  readonly timeSource: TimeSource;
}

export interface ManualBalanceAdjustment {
  readonly adjustmentId: string;
  readonly userId: string;
  readonly operation: "manual_credit" | "manual_debit";
  readonly amountMinor: number;
  readonly currency: string;
  readonly reason: string;
  readonly performedBy: string;
}

export interface ManualBalanceAdjustmentResult {
  readonly entry: LedgerEntry;
  readonly snapshot: BalanceSnapshot;
}

export class AdminManualFinanceService {
  private readonly ledgerStore: LedgerStore;
  private readonly timeSource: TimeSource;

  constructor(dependencies: AdminManualFinanceServiceDependencies) {
    this.ledgerStore = dependencies.ledgerStore;
    this.timeSource = dependencies.timeSource;
  }

  async performAdjustment(input: ManualBalanceAdjustment): Promise<ManualBalanceAdjustmentResult> {
    if (!input.adjustmentId.trim()) {
      throw new Error("adjustmentId is required");
    }
    if (!input.userId.trim()) {
      throw new Error("userId is required");
    }
    if (!input.reason.trim()) {
      throw new Error("reason is required for manual balance adjustment");
    }
    if (!input.performedBy.trim()) {
      throw new Error("performedBy is required");
    }
    if (input.amountMinor <= 0 || !Number.isFinite(input.amountMinor)) {
      throw new Error("amountMinor must be a positive integer");
    }

    const existing = await this.ledgerStore.listEntriesByUser(input.userId);
    const alreadyProcessed = existing.some(
      (e) => e.idempotencyKey === input.adjustmentId
    );
    if (alreadyProcessed) {
      const entries = sortLedgerEntries(existing);
      const matchingEntry = entries.find((e) => e.idempotencyKey === input.adjustmentId)!;
      const snapshot = buildBalanceSnapshot({
        userId: input.userId,
        currency: input.currency,
        entries
      });
      return { entry: matchingEntry, snapshot };
    }

    const nowIso = this.timeSource.nowIso();
    const entry: LedgerEntry = {
      entryId: `manual_${input.adjustmentId}`,
      userId: input.userId,
      operation: input.operation,
      amountMinor: input.amountMinor,
      currency: input.currency,
      idempotencyKey: input.adjustmentId,
      reference: {
        adminAdjustmentId: input.adjustmentId
      },
      createdAt: nowIso
    };

    const allEntries = [...existing, entry];
    const snapshot = buildBalanceSnapshot({
      userId: input.userId,
      currency: input.currency,
      entries: sortLedgerEntries(allEntries)
    });

    await this.ledgerStore.appendEntry(entry);

    return { entry, snapshot };
  }

  async getUserBalance(userId: string, currency: string): Promise<BalanceSnapshot> {
    const entries = await this.ledgerStore.listEntriesByUser(userId);
    return buildBalanceSnapshot({
      userId,
      currency,
      entries: sortLedgerEntries(entries)
    });
  }
}
