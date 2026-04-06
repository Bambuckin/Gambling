import type { LotteryRegistryEntry } from "@lottery/domain";
import { LotteryRegistryService } from "@lottery/application";
import { InMemoryLotteryRegistryStore, PostgresLotteryRegistryStore } from "@lottery/infrastructure";
import { getWebPostgresPool, getWebStorageBackend } from "../runtime/postgres-runtime";

interface RegistrySeedEntry {
  readonly lotteryCode: string;
  readonly title: string;
  readonly enabled: boolean;
  readonly displayOrder: number;
  readonly formSchemaVersion: string;
  readonly formFields: readonly {
    readonly fieldKey: string;
    readonly label: string;
    readonly type: "text" | "number" | "select";
    readonly required: boolean;
    readonly placeholder?: string;
    readonly min?: number;
    readonly max?: number;
    readonly step?: number;
    readonly defaultValue?: string | number;
    readonly options?: readonly {
      readonly value: string;
      readonly label: string;
    }[];
  }[];
  readonly pricing: {
    readonly strategy: "fixed" | "matrix" | "formula";
    readonly baseAmountMinor: number;
  };
  readonly handlers: {
    readonly purchaseHandler: string;
    readonly resultHandler: string;
  };
}

export interface LotteryRegistryRuntimeFactory {
  createService(): LotteryRegistryService;
}

let runtimeFactory: LotteryRegistryRuntimeFactory = createDefaultLotteryRegistryRuntimeFactory();
let cachedService: LotteryRegistryService | null = null;
const LOTTERY_CODE_PATTERN = /^[a-z0-9][a-z0-9-]{1,40}$/i;

export function configureLotteryRegistryRuntime(factory: LotteryRegistryRuntimeFactory): void {
  runtimeFactory = factory;
  cachedService = null;
}

export function getLotteryRegistryService(): LotteryRegistryService {
  if (!cachedService) {
    cachedService = runtimeFactory.createService();
  }

  return cachedService;
}

function createDefaultLotteryRegistryRuntimeFactory(): LotteryRegistryRuntimeFactory {
  const seedEntries = readRegistrySeedEntries();
  const backend = getWebStorageBackend();

  return {
    createService() {
      if (backend === "postgres") {
        return new LotteryRegistryService({
          registryStore: new PostgresLotteryRegistryStore(getWebPostgresPool())
        });
      }

      return new LotteryRegistryService({
        registryStore: new InMemoryLotteryRegistryStore(seedEntries)
      });
    }
  };
}

function readRegistrySeedEntries(): LotteryRegistryEntry[] {
  const modernSeeds = parseModernRegistrySeeds();
  if (modernSeeds.length > 0) {
    return modernSeeds;
  }

  const legacySeeds = parseLegacyShellCatalogSeeds();
  if (legacySeeds.length > 0) {
    return legacySeeds;
  }

  return defaultRegistrySeeds();
}

function parseModernRegistrySeeds(): LotteryRegistryEntry[] {
  const raw = process.env.LOTTERY_REGISTRY_ENTRIES_JSON;
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item) => sanitizeRegistrySeed(item))
      .filter((entry): entry is LotteryRegistryEntry => entry !== null);
  } catch {
    return [];
  }
}

function parseLegacyShellCatalogSeeds(): LotteryRegistryEntry[] {
  const raw = process.env.LOTTERY_SHELL_LOTTERIES_JSON;
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item, index) => sanitizeLegacyShellCatalogEntry(item, index))
      .filter((entry): entry is LotteryRegistryEntry => entry !== null);
  } catch {
    return [];
  }
}

function sanitizeRegistrySeed(input: unknown): LotteryRegistryEntry | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const record = input as Record<string, unknown>;
  const lotteryCode = typeof record.lotteryCode === "string" ? record.lotteryCode.trim().toLowerCase() : "";
  const title = typeof record.title === "string" ? record.title.trim() : "";
  const enabled = typeof record.enabled === "boolean" ? record.enabled : true;
  const displayOrder = typeof record.displayOrder === "number" ? Math.trunc(record.displayOrder) : NaN;
  const formSchemaVersion =
    typeof record.formSchemaVersion === "string" ? record.formSchemaVersion.trim() : "v1";
  const formFields = sanitizeFormFields(record.formFields);

  if (
    !lotteryCode ||
    !LOTTERY_CODE_PATTERN.test(lotteryCode) ||
    !title ||
    !Number.isFinite(displayOrder) ||
    formFields.length === 0
  ) {
    return null;
  }

  const pricing = sanitizePricingRule(record.pricing);
  const handlers = sanitizeHandlerBindings(record.handlers, lotteryCode);
  if (!pricing || !handlers) {
    return null;
  }

  return {
    lotteryCode,
    title,
    enabled,
    displayOrder,
    formSchemaVersion,
    formFields,
    pricing,
    handlers
  };
}

function sanitizeLegacyShellCatalogEntry(input: unknown, index: number): LotteryRegistryEntry | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const record = input as Record<string, unknown>;
  const code = typeof record.code === "string" ? record.code.trim().toLowerCase() : "";
  const title = typeof record.title === "string" ? record.title.trim() : "";
  if (!code || !LOTTERY_CODE_PATTERN.test(code) || !title) {
    return null;
  }

  return {
    lotteryCode: code,
    title,
    enabled: true,
    displayOrder: (index + 1) * 10,
    formSchemaVersion: "v1",
    formFields: defaultFormFieldsForLottery(code),
    pricing: {
      strategy: "fixed",
      baseAmountMinor: 100
    },
    handlers: {
      purchaseHandler: `handlers.${code}.purchase.v1`,
      resultHandler: `handlers.${code}.result.v1`
    }
  };
}

function sanitizePricingRule(input: unknown): RegistrySeedEntry["pricing"] | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const record = input as Record<string, unknown>;
  const strategy = record.strategy;
  const baseAmountMinor = typeof record.baseAmountMinor === "number" ? Math.trunc(record.baseAmountMinor) : NaN;

  if (strategy !== "fixed" && strategy !== "matrix" && strategy !== "formula") {
    return null;
  }

  if (!Number.isFinite(baseAmountMinor) || baseAmountMinor < 0) {
    return null;
  }

  return {
    strategy,
    baseAmountMinor
  };
}

function sanitizeFormFields(input: unknown): RegistrySeedEntry["formFields"] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((field) => sanitizeFormField(field))
    .filter((field): field is RegistrySeedEntry["formFields"][number] => field !== null);
}

function sanitizeFormField(input: unknown): RegistrySeedEntry["formFields"][number] | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const record = input as Record<string, unknown>;
  const fieldKey = typeof record.fieldKey === "string" ? record.fieldKey.trim() : "";
  const label = typeof record.label === "string" ? record.label.trim() : "";
  const type = record.type;
  const required = typeof record.required === "boolean" ? record.required : true;

  if (!fieldKey || !/^[a-z][a-z0-9_]{1,40}$/i.test(fieldKey) || !label) {
    return null;
  }

  if (type !== "text" && type !== "number" && type !== "select") {
    return null;
  }

  if (type === "select") {
    if (!Array.isArray(record.options)) {
      return null;
    }

    const options = record.options
      .map((item) => sanitizeFormFieldOption(item))
      .filter((item): item is { value: string; label: string } => item !== null);

    if (options.length === 0) {
      return null;
    }

    return {
      fieldKey,
      label,
      type,
      required,
      options
    };
  }

  const defaultValue =
    typeof record.defaultValue === "string" || typeof record.defaultValue === "number"
      ? record.defaultValue
      : undefined;

  return {
    fieldKey,
    label,
    type,
    required,
    ...(typeof record.placeholder === "string" ? { placeholder: record.placeholder } : {}),
    ...(typeof record.min === "number" ? { min: record.min } : {}),
    ...(typeof record.max === "number" ? { max: record.max } : {}),
    ...(typeof record.step === "number" ? { step: record.step } : {}),
    ...(defaultValue !== undefined ? { defaultValue } : {})
  };
}

function sanitizeFormFieldOption(input: unknown): { value: string; label: string } | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const record = input as Record<string, unknown>;
  const value = typeof record.value === "string" ? record.value.trim() : "";
  const label = typeof record.label === "string" ? record.label.trim() : "";
  if (!value || !label) {
    return null;
  }

  return { value, label };
}

function sanitizeHandlerBindings(input: unknown, lotteryCode: string): RegistrySeedEntry["handlers"] | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const record = input as Record<string, unknown>;
  const purchaseHandler = typeof record.purchaseHandler === "string" ? record.purchaseHandler.trim() : "";
  const resultHandler = typeof record.resultHandler === "string" ? record.resultHandler.trim() : "";

  if (!purchaseHandler || !resultHandler) {
    return null;
  }

  return {
    purchaseHandler,
    resultHandler
  };
}

function defaultRegistrySeeds(): LotteryRegistryEntry[] {
  return [
    {
      lotteryCode: "demo-lottery",
      title: "Demo Lottery",
      enabled: true,
      displayOrder: 10,
      formSchemaVersion: "v1-demo",
      formFields: [
        {
          fieldKey: "draw_count",
          label: "Draw Count",
          type: "number",
          required: true,
          min: 1,
          max: 10,
          step: 1,
          defaultValue: 1
        },
        {
          fieldKey: "ticket_note",
          label: "Ticket Note",
          type: "text",
          required: false,
          placeholder: "Optional note"
        }
      ],
      pricing: {
        strategy: "fixed",
        baseAmountMinor: 100
      },
      handlers: {
        purchaseHandler: "handlers.demo-lottery.purchase.v1",
        resultHandler: "handlers.demo-lottery.result.v1"
      }
    },
    {
      lotteryCode: "gosloto-6x45",
      title: "Gosloto 6x45",
      enabled: true,
      displayOrder: 20,
      formSchemaVersion: "v1-gosloto",
      formFields: [
        {
          fieldKey: "draw_count",
          label: "Draw Count",
          type: "number",
          required: true,
          min: 1,
          max: 5,
          step: 1,
          defaultValue: 1
        },
        {
          fieldKey: "bet_system",
          label: "Bet System",
          type: "select",
          required: true,
          options: [
            { value: "standard", label: "Standard" },
            { value: "extended", label: "Extended" }
          ]
        }
      ],
      pricing: {
        strategy: "fixed",
        baseAmountMinor: 150
      },
      handlers: {
        purchaseHandler: "handlers.gosloto-6x45.purchase.v1",
        resultHandler: "handlers.gosloto-6x45.result.v1"
      }
    },
    {
      lotteryCode: "archive-lottery",
      title: "Archive Lottery (Disabled)",
      enabled: false,
      displayOrder: 30,
      formSchemaVersion: "v1-archive",
      formFields: [
        {
          fieldKey: "draw_count",
          label: "Draw Count",
          type: "number",
          required: true,
          min: 1,
          max: 3,
          step: 1,
          defaultValue: 1
        }
      ],
      pricing: {
        strategy: "fixed",
        baseAmountMinor: 50
      },
      handlers: {
        purchaseHandler: "handlers.archive-lottery.purchase.v1",
        resultHandler: "handlers.archive-lottery.result.v1"
      }
    }
  ];
}

function defaultFormFieldsForLottery(lotteryCode: string): RegistrySeedEntry["formFields"] {
  return [
    {
      fieldKey: "draw_count",
      label: `Draw Count (${lotteryCode})`,
      type: "number",
      required: true,
      min: 1,
      max: 10,
      step: 1,
      defaultValue: 1
    }
  ];
}
