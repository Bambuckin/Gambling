import type { LotteryFormFieldDefinition, LotteryPricingRule } from "./lottery-registry.js";

export type PurchaseDraftRawFieldValues = Readonly<Record<string, string | undefined>>;
export type PurchaseDraftPayloadValue = string | number;
export type PurchaseDraftPayload = Readonly<Record<string, PurchaseDraftPayloadValue>>;

export type PurchaseDraftFieldErrorReason =
  | "required"
  | "invalid_number"
  | "less_than_min"
  | "greater_than_max"
  | "invalid_step"
  | "invalid_option";

export interface PurchaseDraftFieldError {
  readonly fieldKey: string;
  readonly reason: PurchaseDraftFieldErrorReason;
  readonly message: string;
}

export interface PurchaseDraftValidationSuccess {
  readonly ok: true;
  readonly payload: PurchaseDraftPayload;
  readonly validatedFieldCount: number;
  readonly totalFieldCount: number;
}

export interface PurchaseDraftValidationFailure {
  readonly ok: false;
  readonly errors: readonly PurchaseDraftFieldError[];
  readonly totalFieldCount: number;
}

export type PurchaseDraftValidationResult = PurchaseDraftValidationSuccess | PurchaseDraftValidationFailure;

export interface PurchaseDraftQuote {
  readonly strategy: LotteryPricingRule["strategy"];
  readonly baseAmountMinor: number;
  readonly multiplier: number;
  readonly totalAmountMinor: number;
}

export class PurchaseDraftPricingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PurchaseDraftPricingError";
  }
}

export function validatePurchaseDraftFields(
  fields: readonly LotteryFormFieldDefinition[],
  rawValues: PurchaseDraftRawFieldValues
): PurchaseDraftValidationResult {
  const payload: Record<string, PurchaseDraftPayloadValue> = {};
  const errors: PurchaseDraftFieldError[] = [];

  for (const field of fields) {
    const rawValue = (rawValues[field.fieldKey] ?? "").trim();
    if (rawValue.length === 0) {
      if (field.required) {
        errors.push({
          fieldKey: field.fieldKey,
          reason: "required",
          message: `field "${field.fieldKey}" is required`
        });
      }
      continue;
    }

    if (field.type === "number") {
      const numericValue = Number(rawValue);
      if (!Number.isFinite(numericValue)) {
        errors.push({
          fieldKey: field.fieldKey,
          reason: "invalid_number",
          message: `field "${field.fieldKey}" must be a finite number`
        });
        continue;
      }

      if (typeof field.min === "number" && numericValue < field.min) {
        errors.push({
          fieldKey: field.fieldKey,
          reason: "less_than_min",
          message: `field "${field.fieldKey}" must be >= ${field.min}`
        });
        continue;
      }

      if (typeof field.max === "number" && numericValue > field.max) {
        errors.push({
          fieldKey: field.fieldKey,
          reason: "greater_than_max",
          message: `field "${field.fieldKey}" must be <= ${field.max}`
        });
        continue;
      }

      if (typeof field.step === "number" && field.step > 0) {
        const stepBase = typeof field.min === "number" ? field.min : 0;
        const stepRatio = (numericValue - stepBase) / field.step;
        const roundedStepRatio = Math.round(stepRatio);
        if (Math.abs(stepRatio - roundedStepRatio) > 1e-9) {
          errors.push({
            fieldKey: field.fieldKey,
            reason: "invalid_step",
            message: `field "${field.fieldKey}" must align to step ${field.step}`
          });
          continue;
        }
      }

      payload[field.fieldKey] = numericValue;
      continue;
    }

    if (field.type === "select") {
      const options = field.options ?? [];
      const isAllowedValue = options.some((option) => option.value === rawValue);
      if (!isAllowedValue) {
        errors.push({
          fieldKey: field.fieldKey,
          reason: "invalid_option",
          message: `field "${field.fieldKey}" has unsupported option "${rawValue}"`
        });
        continue;
      }
    }

    payload[field.fieldKey] = rawValue;
  }

  if (errors.length > 0) {
    return {
      ok: false,
      errors,
      totalFieldCount: fields.length
    };
  }

  return {
    ok: true,
    payload,
    validatedFieldCount: Object.keys(payload).length,
    totalFieldCount: fields.length
  };
}

export function quotePurchaseDraft(
  pricingRule: LotteryPricingRule,
  payload: PurchaseDraftPayload
): PurchaseDraftQuote {
  const baseAmountMinor = Math.trunc(pricingRule.baseAmountMinor);
  if (!Number.isFinite(baseAmountMinor) || baseAmountMinor < 0) {
    throw new PurchaseDraftPricingError("pricing base amount must be a non-negative finite number");
  }

  if (pricingRule.strategy !== "fixed") {
    throw new PurchaseDraftPricingError(`unsupported pricing strategy "${pricingRule.strategy}"`);
  }

  const drawCountValue = payload.draw_count;
  const multiplier = resolvePositiveInteger(drawCountValue, "draw_count");
  return {
    strategy: pricingRule.strategy,
    baseAmountMinor,
    multiplier,
    totalAmountMinor: baseAmountMinor * multiplier
  };
}

function resolvePositiveInteger(value: PurchaseDraftPayloadValue | undefined, fieldKey: string): number {
  if (value === undefined) {
    return 1;
  }

  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new PurchaseDraftPricingError(
      `field "${fieldKey}" must be a positive integer for quote calculation`
    );
  }

  return value;
}
