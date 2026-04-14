import type { LotteryFormFieldDefinition, LotteryPricingRule } from "./lottery-registry.js";

export type PurchaseDraftRawFieldValues = Readonly<Record<string, string | undefined>>;
export type PurchaseDraftPayloadScalar = string | number | boolean | null;
export interface PurchaseDraftPayload {
  readonly [key: string]: PurchaseDraftPayloadValue;
}

export interface PurchaseDraftPayloadList extends ReadonlyArray<PurchaseDraftPayloadValue> {}

export type PurchaseDraftPayloadValue =
  | PurchaseDraftPayloadScalar
  | PurchaseDraftPayload
  | PurchaseDraftPayloadList;

export type PurchaseDraftFieldErrorReason =
  | "required"
  | "invalid_number"
  | "less_than_min"
  | "greater_than_max"
  | "invalid_step"
  | "invalid_option"
  | "invalid_payload"
  | "duplicate_value";

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

export interface Big8TicketDraft extends PurchaseDraftPayload {
  readonly boardNumbers: readonly number[];
  readonly extraNumber: number;
  readonly multiplier: number;
}

export interface Big8PurchaseDraftPayload extends PurchaseDraftPayload {
  readonly schema: "big8-v1";
  readonly contactPhone: string;
  readonly tickets: readonly Big8TicketDraft[];
}

const BIG8_BOARD_SIZE = 8;
const BIG8_BOARD_MIN = 1;
const BIG8_BOARD_MAX = 20;
const BIG8_EXTRA_MIN = 1;
const BIG8_EXTRA_MAX = 4;
const BIG8_MULTIPLIER_MIN = 1;
const BIG8_MULTIPLIER_MAX = 10;

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

export function validateBig8PurchaseDraft(input: unknown): PurchaseDraftValidationResult {
  if (!input || typeof input !== "object") {
    return invalidBig8Result({
      fieldKey: "payload",
      reason: "invalid_payload",
      message: 'field "payload" must be an object'
    });
  }

  const record = input as Record<string, unknown>;
  const contactPhone = typeof record.contactPhone === "string" ? record.contactPhone.replace(/\D/g, "") : "";
  const ticketsInput = Array.isArray(record.tickets) ? record.tickets : null;
  const errors: PurchaseDraftFieldError[] = [];

  if (!contactPhone || contactPhone.length < 10 || contactPhone.length > 15) {
    errors.push({
      fieldKey: "contactPhone",
      reason: "invalid_payload",
      message: 'field "contactPhone" must contain 10 to 15 digits'
    });
  }

  if (!ticketsInput || ticketsInput.length === 0) {
    errors.push({
      fieldKey: "tickets",
      reason: "required",
      message: 'field "tickets" must contain at least one ticket'
    });
  }

  const tickets: Big8TicketDraft[] = [];
  for (const [ticketIndex, ticketInput] of (ticketsInput ?? []).entries()) {
    const prefix = `tickets[${ticketIndex}]`;
    if (!ticketInput || typeof ticketInput !== "object") {
      errors.push({
        fieldKey: prefix,
        reason: "invalid_payload",
        message: `field "${prefix}" must be an object`
      });
      continue;
    }

    const ticket = ticketInput as Record<string, unknown>;
    const boardNumbers = sanitizeIntegerArray(ticket.boardNumbers);
    const extraNumber = sanitizeInteger(ticket.extraNumber);
    const multiplier = sanitizeInteger(ticket.multiplier) ?? 1;

    if (!boardNumbers) {
      errors.push({
        fieldKey: `${prefix}.boardNumbers`,
        reason: "invalid_payload",
        message: `field "${prefix}.boardNumbers" must be an array of integers`
      });
    } else {
      if (boardNumbers.length !== BIG8_BOARD_SIZE) {
        errors.push({
          fieldKey: `${prefix}.boardNumbers`,
          reason: "invalid_payload",
          message: `field "${prefix}.boardNumbers" must contain exactly ${BIG8_BOARD_SIZE} numbers`
        });
      }

      const uniqueNumbers = new Set(boardNumbers);
      if (uniqueNumbers.size !== boardNumbers.length) {
        errors.push({
          fieldKey: `${prefix}.boardNumbers`,
          reason: "duplicate_value",
          message: `field "${prefix}.boardNumbers" must not contain duplicates`
        });
      }

      for (const value of boardNumbers) {
        if (value < BIG8_BOARD_MIN || value > BIG8_BOARD_MAX) {
          errors.push({
            fieldKey: `${prefix}.boardNumbers`,
            reason: "invalid_payload",
            message: `field "${prefix}.boardNumbers" must contain values from ${BIG8_BOARD_MIN} to ${BIG8_BOARD_MAX}`
          });
          break;
        }
      }
    }

    if (!extraNumber || extraNumber < BIG8_EXTRA_MIN || extraNumber > BIG8_EXTRA_MAX) {
      errors.push({
        fieldKey: `${prefix}.extraNumber`,
        reason: "invalid_payload",
        message: `field "${prefix}.extraNumber" must be between ${BIG8_EXTRA_MIN} and ${BIG8_EXTRA_MAX}`
      });
    }

    if (!multiplier || multiplier < BIG8_MULTIPLIER_MIN || multiplier > BIG8_MULTIPLIER_MAX) {
      errors.push({
        fieldKey: `${prefix}.multiplier`,
        reason: "invalid_payload",
        message: `field "${prefix}.multiplier" must be between ${BIG8_MULTIPLIER_MIN} and ${BIG8_MULTIPLIER_MAX}`
      });
    }

    if (boardNumbers && extraNumber && multiplier) {
      tickets.push({
        boardNumbers: [...boardNumbers].sort((left, right) => left - right),
        extraNumber,
        multiplier
      });
    }
  }

  if (errors.length > 0) {
    return {
      ok: false,
      errors,
      totalFieldCount: Math.max(ticketsInput?.length ?? 0, 1)
    };
  }

  return {
    ok: true,
    payload: {
      schema: "big8-v1",
      contactPhone,
      tickets
    },
    validatedFieldCount: tickets.length,
    totalFieldCount: tickets.length
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

  if (isBig8PurchaseDraftPayload(payload)) {
    const multiplier = payload.tickets.reduce((sum, ticket) => sum + ticket.multiplier, 0);
    return {
      strategy: pricingRule.strategy,
      baseAmountMinor,
      multiplier,
      totalAmountMinor: baseAmountMinor * multiplier
    };
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

export function isBig8PurchaseDraftPayload(payload: PurchaseDraftPayload): payload is Big8PurchaseDraftPayload {
  if (payload.schema !== "big8-v1" || !Array.isArray(payload.tickets) || typeof payload.contactPhone !== "string") {
    return false;
  }

  return payload.tickets.every((ticket: Big8TicketDraft) => {
    if (!ticket || typeof ticket !== "object") {
      return false;
    }

    const record = ticket as unknown as Record<string, unknown>;
    return (
      Array.isArray(record.boardNumbers) &&
      record.boardNumbers.every((value) => typeof value === "number") &&
      typeof record.extraNumber === "number" &&
      typeof record.multiplier === "number"
    );
  });
}

export function clonePurchaseDraftPayload(payload: PurchaseDraftPayload): PurchaseDraftPayload {
  const output: Record<string, PurchaseDraftPayloadValue> = {};
  for (const [key, value] of Object.entries(payload)) {
    output[key] = clonePurchaseDraftValue(value);
  }
  return output;
}

export function sanitizePurchaseDraftPayload(input: unknown): PurchaseDraftPayload | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return null;
  }

  const output: Record<string, PurchaseDraftPayloadValue> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    const sanitizedValue = sanitizePurchaseDraftValue(value);
    if (sanitizedValue === undefined) {
      return null;
    }
    output[key] = sanitizedValue;
  }

  return output;
}

export function arePurchaseDraftPayloadsEqual(left: PurchaseDraftPayload, right: PurchaseDraftPayload): boolean {
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  for (let index = 0; index < leftKeys.length; index += 1) {
    const leftKey = leftKeys[index];
    const rightKey = rightKeys[index];
    if (!leftKey || !rightKey || leftKey !== rightKey) {
      return false;
    }

    if (!arePurchaseDraftValuesEqual(left[leftKey], right[rightKey])) {
      return false;
    }
  }

  return true;
}

function clonePurchaseDraftValue(value: PurchaseDraftPayloadValue): PurchaseDraftPayloadValue {
  if (Array.isArray(value)) {
    return value.map((item) => clonePurchaseDraftValue(item));
  }

  if (value && typeof value === "object") {
    return clonePurchaseDraftPayload(value as PurchaseDraftPayload);
  }

  return value;
}

function sanitizePurchaseDraftValue(input: unknown): PurchaseDraftPayloadValue | undefined {
  if (
    input === null ||
    typeof input === "string" ||
    typeof input === "number" ||
    typeof input === "boolean"
  ) {
    return input;
  }

  if (Array.isArray(input)) {
    const items: PurchaseDraftPayloadValue[] = [];
    for (const item of input) {
      const sanitizedItem = sanitizePurchaseDraftValue(item);
      if (sanitizedItem === undefined) {
        return undefined;
      }
      items.push(sanitizedItem);
    }
    return items;
  }

  if (input && typeof input === "object") {
    return sanitizePurchaseDraftPayload(input);
  }

  return undefined;
}

function arePurchaseDraftValuesEqual(
  left: PurchaseDraftPayloadValue | undefined,
  right: PurchaseDraftPayloadValue | undefined
): boolean {
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
      return false;
    }

    for (let index = 0; index < left.length; index += 1) {
      if (!arePurchaseDraftValuesEqual(left[index], right[index])) {
        return false;
      }
    }

    return true;
  }

  if (left && typeof left === "object") {
    return Boolean(
      right &&
        typeof right === "object" &&
        arePurchaseDraftPayloadsEqual(left as PurchaseDraftPayload, right as PurchaseDraftPayload)
    );
  }

  return left === right;
}

function sanitizeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function sanitizeIntegerArray(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.some((entry) => !Number.isInteger(entry))) {
    return null;
  }

  return value.map((entry) => Math.trunc(entry));
}

function invalidBig8Result(error: PurchaseDraftFieldError): PurchaseDraftValidationFailure {
  return {
    ok: false,
    errors: [error],
    totalFieldCount: 1
  };
}
