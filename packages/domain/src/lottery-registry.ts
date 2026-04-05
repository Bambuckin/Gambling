export interface LotteryHandlerBinding {
  readonly purchaseHandler: string;
  readonly resultHandler: string;
}

export type LotteryPricingStrategy = "fixed" | "matrix" | "formula";

export interface LotteryPricingRule {
  readonly strategy: LotteryPricingStrategy;
  readonly baseAmountMinor: number;
}

export interface LotteryRegistryEntry {
  readonly lotteryCode: string;
  readonly title: string;
  readonly enabled: boolean;
  readonly displayOrder: number;
  readonly formSchemaVersion: string;
  readonly pricing: LotteryPricingRule;
  readonly handlers: LotteryHandlerBinding;
}

export function normalizeLotteryCode(input: string): string {
  return input.trim().toLowerCase();
}

export function hasHandlerBindings(entry: LotteryRegistryEntry): boolean {
  return entry.handlers.purchaseHandler.trim().length > 0 && entry.handlers.resultHandler.trim().length > 0;
}

export function compareRegistryEntriesByOrder(a: LotteryRegistryEntry, b: LotteryRegistryEntry): number {
  if (a.displayOrder !== b.displayOrder) {
    return a.displayOrder - b.displayOrder;
  }

  return a.lotteryCode.localeCompare(b.lotteryCode);
}

export function sortRegistryEntries(entries: readonly LotteryRegistryEntry[]): LotteryRegistryEntry[] {
  return [...entries].sort(compareRegistryEntriesByOrder);
}
