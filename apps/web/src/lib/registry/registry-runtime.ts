import type { LotteryRegistryEntry } from "@lottery/domain";
import { LotteryRegistryService } from "@lottery/application";
import { InMemoryLotteryRegistryStore } from "@lottery/infrastructure";

interface RegistrySeedEntry {
  readonly lotteryCode: string;
  readonly title: string;
  readonly enabled: boolean;
  readonly displayOrder: number;
  readonly formSchemaVersion: string;
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

  return {
    createService() {
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

  if (!lotteryCode || !LOTTERY_CODE_PATTERN.test(lotteryCode) || !title || !Number.isFinite(displayOrder)) {
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
