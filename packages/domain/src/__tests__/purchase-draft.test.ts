import { describe, expect, it } from "vitest";
import type { LotteryFormFieldDefinition } from "../lottery-registry.js";
import { PurchaseDraftPricingError, quotePurchaseDraft, validatePurchaseDraftFields } from "../purchase-draft.js";

describe("purchase draft validation", () => {
  it("validates mixed field types and returns normalized payload", () => {
    const result = validatePurchaseDraftFields(
      [
        numberField("draw_count", { min: 1, max: 5, step: 1 }),
        textField("ticket_note", { required: false }),
        selectField("bet_system", ["standard", "extended"])
      ],
      {
        draw_count: "3",
        ticket_note: "  nightly ticket ",
        bet_system: "extended"
      }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected successful validation");
    }

    expect(result.payload).toEqual({
      draw_count: 3,
      ticket_note: "nightly ticket",
      bet_system: "extended"
    });
    expect(result.validatedFieldCount).toBe(3);
  });

  it("returns field-level errors for missing required and invalid option", () => {
    const result = validatePurchaseDraftFields(
      [
        numberField("draw_count", { min: 1, max: 5, step: 1 }),
        selectField("bet_system", ["standard", "extended"])
      ],
      {
        draw_count: "",
        bet_system: "invalid-system"
      }
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected failed validation");
    }

    expect(result.errors.map((entry) => entry.fieldKey)).toEqual(["draw_count", "bet_system"]);
    expect(result.errors.map((entry) => entry.reason)).toEqual(["required", "invalid_option"]);
  });

  it("enforces numeric min/max/step rules", () => {
    const minFailure = validatePurchaseDraftFields(
      [numberField("draw_count", { min: 2, max: 10, step: 2 })],
      { draw_count: "1" }
    );
    expect(minFailure.ok).toBe(false);
    if (minFailure.ok) {
      throw new Error("Expected failed validation");
    }
    expect(minFailure.errors[0]?.reason).toBe("less_than_min");

    const stepFailure = validatePurchaseDraftFields(
      [numberField("draw_count", { min: 1, max: 10, step: 2 })],
      { draw_count: "2" }
    );
    expect(stepFailure.ok).toBe(false);
    if (stepFailure.ok) {
      throw new Error("Expected failed validation");
    }
    expect(stepFailure.errors[0]?.reason).toBe("invalid_step");
  });
});

describe("purchase draft quote", () => {
  it("calculates fixed quote with draw_count multiplier", () => {
    const quote = quotePurchaseDraft(
      {
        strategy: "fixed",
        baseAmountMinor: 150
      },
      {
        draw_count: 4,
        bet_system: "standard"
      }
    );

    expect(quote).toEqual({
      strategy: "fixed",
      baseAmountMinor: 150,
      multiplier: 4,
      totalAmountMinor: 600
    });
  });

  it("throws on unsupported pricing strategy", () => {
    expect(() =>
      quotePurchaseDraft(
        {
          strategy: "matrix",
          baseAmountMinor: 200
        },
        {
          draw_count: 1
        }
      )
    ).toThrow(PurchaseDraftPricingError);
  });
});

function numberField(
  fieldKey: string,
  options: {
    readonly required?: boolean;
    readonly min?: number;
    readonly max?: number;
    readonly step?: number;
  } = {}
): LotteryFormFieldDefinition {
  return {
    fieldKey,
    label: fieldKey,
    type: "number",
    required: options.required ?? true,
    ...(options.min !== undefined ? { min: options.min } : {}),
    ...(options.max !== undefined ? { max: options.max } : {}),
    ...(options.step !== undefined ? { step: options.step } : {})
  };
}

function textField(
  fieldKey: string,
  options: {
    readonly required?: boolean;
  } = {}
): LotteryFormFieldDefinition {
  return {
    fieldKey,
    label: fieldKey,
    type: "text",
    required: options.required ?? true
  };
}

function selectField(fieldKey: string, values: readonly string[]): LotteryFormFieldDefinition {
  return {
    fieldKey,
    label: fieldKey,
    type: "select",
    required: true,
    options: values.map((value) => ({
      value,
      label: value
    }))
  };
}
