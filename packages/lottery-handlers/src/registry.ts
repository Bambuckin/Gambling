import type { LotteryPurchaseHandlerContract } from "./contracts.js";

export interface LotteryPurchaseHandlerBinding {
  readonly lotteryCode: string;
  readonly bindingKey: string;
  readonly contractVersion: "v1";
  readonly handler: LotteryPurchaseHandlerContract;
}

export interface LotteryPurchaseHandlerRegistry {
  getByLotteryCode(lotteryCode: string): LotteryPurchaseHandlerBinding | null;
  listBindings(): readonly LotteryPurchaseHandlerBinding[];
}

export class LotteryHandlerRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LotteryHandlerRegistryError";
  }
}

export function createLotteryPurchaseHandlerRegistry(
  handlers: readonly LotteryPurchaseHandlerContract[]
): LotteryPurchaseHandlerRegistry {
  const bindingsByLottery = new Map<string, LotteryPurchaseHandlerBinding>();

  for (const handler of handlers) {
    const lotteryCode = normalizeLotteryCode(handler.lotteryCode);
    if (bindingsByLottery.has(lotteryCode)) {
      throw new LotteryHandlerRegistryError(`duplicate purchase handler binding for lottery "${lotteryCode}"`);
    }

    bindingsByLottery.set(lotteryCode, {
      lotteryCode,
      bindingKey: handler.bindingKey,
      contractVersion: handler.contractVersion,
      handler
    });
  }

  return {
    getByLotteryCode(lotteryCode: string): LotteryPurchaseHandlerBinding | null {
      const binding = bindingsByLottery.get(normalizeLotteryCode(lotteryCode)) ?? null;
      return binding
        ? {
            lotteryCode: binding.lotteryCode,
            bindingKey: binding.bindingKey,
            contractVersion: binding.contractVersion,
            handler: binding.handler
          }
        : null;
    },
    listBindings(): readonly LotteryPurchaseHandlerBinding[] {
      return [...bindingsByLottery.values()].map((binding) => ({
        lotteryCode: binding.lotteryCode,
        bindingKey: binding.bindingKey,
        contractVersion: binding.contractVersion,
        handler: binding.handler
      }));
    }
  };
}

function normalizeLotteryCode(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    throw new LotteryHandlerRegistryError("lotteryCode is required");
  }
  return normalized;
}
