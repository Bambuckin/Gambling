import type { LotteryFormFieldDefinition } from "@lottery/domain";
import type { ReactElement } from "react";

interface LotteryFormFieldsProps {
  readonly fields: readonly LotteryFormFieldDefinition[];
}

export function LotteryFormFields({ fields }: LotteryFormFieldsProps): ReactElement {
  return (
    <>
      {fields.map((field) => (
        <label key={field.fieldKey}>
          {field.label}
          {field.type === "select" ? (
            <select name={field.fieldKey} required={field.required} defaultValue={resolveSelectDefaultValue(field)}>
              {(field.options ?? []).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              name={field.fieldKey}
              type={field.type}
              required={field.required}
              placeholder={field.placeholder}
              defaultValue={field.defaultValue}
              min={field.min}
              max={field.max}
              step={field.step}
            />
          )}
        </label>
      ))}
    </>
  );
}

function resolveSelectDefaultValue(field: LotteryFormFieldDefinition): string | undefined {
  if (typeof field.defaultValue === "string") {
    return field.defaultValue;
  }

  return field.options?.[0]?.value;
}
