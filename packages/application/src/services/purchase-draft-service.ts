import {
  PurchaseDraftPricingError,
  type PurchaseDraftFieldError,
  type PurchaseDraftPayload,
  quotePurchaseDraft,
  validatePurchaseDraftFields
} from "@lottery/domain";
import type { LotteryRegistryService } from "./lottery-registry-service.js";

export interface PurchaseDraftServiceDependencies {
  readonly registryService: LotteryRegistryService;
}

export interface PreparePurchaseDraftInput {
  readonly lotteryCode: string;
  readonly rawFieldValues: Readonly<Record<string, string | undefined>>;
  readonly currency?: string;
}

export interface PreparedPurchaseDraft {
  readonly lotteryCode: string;
  readonly lotteryTitle: string;
  readonly validatedPayload: PurchaseDraftPayload;
  readonly validatedFieldCount: number;
  readonly totalFieldCount: number;
  readonly pricingStrategy: "fixed" | "matrix" | "formula";
  readonly baseAmountMinor: number;
  readonly multiplier: number;
  readonly costMinor: number;
  readonly currency: string;
}

export type PurchaseDraftServiceErrorCode =
  | "lottery_not_found"
  | "lottery_disabled"
  | "validation_failed"
  | "pricing_failed";

export class PurchaseDraftServiceError extends Error {
  readonly code: PurchaseDraftServiceErrorCode;
  readonly fieldErrors: readonly PurchaseDraftFieldError[];

  constructor(
    message: string,
    options: {
      readonly code: PurchaseDraftServiceErrorCode;
      readonly fieldErrors?: readonly PurchaseDraftFieldError[];
      readonly cause?: unknown;
    }
  ) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "PurchaseDraftServiceError";
    this.code = options.code;
    this.fieldErrors = options.fieldErrors ?? [];
  }
}

export class PurchaseDraftService {
  private readonly registryService: LotteryRegistryService;

  constructor(dependencies: PurchaseDraftServiceDependencies) {
    this.registryService = dependencies.registryService;
  }

  async prepareDraft(input: PreparePurchaseDraftInput): Promise<PreparedPurchaseDraft> {
    const lotteryCode = input.lotteryCode.trim().toLowerCase();
    if (!lotteryCode) {
      throw new PurchaseDraftServiceError("lottery code is required", {
        code: "lottery_not_found"
      });
    }

    const lottery = await this.registryService.getLotteryByCode(lotteryCode);
    if (!lottery) {
      throw new PurchaseDraftServiceError(`lottery "${lotteryCode}" is not registered`, {
        code: "lottery_not_found"
      });
    }

    if (!lottery.enabled) {
      throw new PurchaseDraftServiceError(`lottery "${lottery.lotteryCode}" is disabled`, {
        code: "lottery_disabled"
      });
    }

    const validation = validatePurchaseDraftFields(lottery.formFields, input.rawFieldValues);
    if (!validation.ok) {
      throw new PurchaseDraftServiceError(`lottery "${lottery.lotteryCode}" payload failed validation`, {
        code: "validation_failed",
        fieldErrors: validation.errors
      });
    }

    try {
      const quote = quotePurchaseDraft(lottery.pricing, validation.payload);
      return {
        lotteryCode: lottery.lotteryCode,
        lotteryTitle: lottery.title,
        validatedPayload: validation.payload,
        validatedFieldCount: validation.validatedFieldCount,
        totalFieldCount: validation.totalFieldCount,
        pricingStrategy: quote.strategy,
        baseAmountMinor: quote.baseAmountMinor,
        multiplier: quote.multiplier,
        costMinor: quote.totalAmountMinor,
        currency: normalizeCurrency(input.currency)
      };
    } catch (error) {
      if (error instanceof PurchaseDraftPricingError) {
        throw new PurchaseDraftServiceError(error.message, {
          code: "pricing_failed",
          cause: error
        });
      }

      throw error;
    }
  }
}

function normalizeCurrency(input: string | undefined): string {
  const candidate = input?.trim().toUpperCase();
  return candidate && candidate.length > 0 ? candidate : "RUB";
}
