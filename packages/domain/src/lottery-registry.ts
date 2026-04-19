export interface LotteryHandlerBinding {
  readonly purchaseHandler: string;
  readonly resultHandler: string;
}

export type LotteryPricingStrategy = "fixed" | "matrix" | "formula";

export interface LotteryPricingRule {
  readonly strategy: LotteryPricingStrategy;
  readonly baseAmountMinor: number;
}

export type LotteryFormFieldType = "text" | "number" | "select";

export interface LotteryFormFieldOption {
  readonly value: string;
  readonly label: string;
}

export interface LotteryFormFieldDefinition {
  readonly fieldKey: string;
  readonly label: string;
  readonly type: LotteryFormFieldType;
  readonly required: boolean;
  readonly placeholder?: string;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly defaultValue?: string | number;
  readonly options?: readonly LotteryFormFieldOption[];
}

export type LotteryPurchaseCompletionMode = "direct" | "emulate_after_cart";
export type LotteryDrawFreshnessMode = "block" | "warn_only";

export interface LotteryRegistryEntry {
  readonly lotteryCode: string;
  readonly title: string;
  readonly enabled: boolean;
  readonly displayOrder: number;
  readonly formSchemaVersion: string;
  readonly formFields: readonly LotteryFormFieldDefinition[];
  readonly pricing: LotteryPricingRule;
  readonly handlers: LotteryHandlerBinding;
  readonly purchaseCompletionMode?: LotteryPurchaseCompletionMode;
  readonly drawFreshnessMode?: LotteryDrawFreshnessMode;
}

export function normalizeLotteryCode(input: string): string {
  return input.trim().toLowerCase();
}

export function hasHandlerBindings(entry: LotteryRegistryEntry): boolean {
  return entry.handlers.purchaseHandler.trim().length > 0 && entry.handlers.resultHandler.trim().length > 0;
}

export function hasFormFieldDefinitions(entry: LotteryRegistryEntry): boolean {
  return entry.formFields.length > 0;
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
