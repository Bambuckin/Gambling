export interface LotteryHandlerBinding {
  readonly purchaseHandler: string;
  readonly resultHandler: string;
}

export interface LotteryPricingRule {
  readonly strategy: "fixed" | "matrix" | "formula";
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
