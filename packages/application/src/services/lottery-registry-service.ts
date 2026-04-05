import {
  type LotteryPricingRule,
  type LotteryRegistryEntry,
  hasHandlerBindings,
  normalizeLotteryCode,
  sortRegistryEntries
} from "@lottery/domain";
import type { LotteryRegistryStore } from "../ports/lottery-registry-store.js";

export interface LotteryRegistryServiceDependencies {
  readonly registryStore: LotteryRegistryStore;
}

export interface LotteryRegistryUpsertInput {
  readonly lotteryCode: string;
  readonly title: string;
  readonly enabled: boolean;
  readonly displayOrder: number;
  readonly formSchemaVersion: string;
  readonly pricing: LotteryPricingRule;
  readonly handlers: {
    readonly purchaseHandler: string;
    readonly resultHandler: string;
  };
}

export class LotteryRegistryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LotteryRegistryValidationError";
  }
}

export class LotteryRegistryService {
  private readonly registryStore: LotteryRegistryStore;

  constructor(dependencies: LotteryRegistryServiceDependencies) {
    this.registryStore = dependencies.registryStore;
  }

  async listAllLotteries(): Promise<LotteryRegistryEntry[]> {
    const entries = await this.registryStore.listEntries();
    const sanitized = entries.map((entry) => sanitizeRegistryEntry(entry));
    assertUniqueCodes(sanitized);
    return sortRegistryEntries(sanitized);
  }

  async getVisibleLotteries(): Promise<LotteryRegistryEntry[]> {
    const all = await this.listAllLotteries();
    return all.filter((entry) => entry.enabled);
  }

  async getLotteryByCode(lotteryCode: string): Promise<LotteryRegistryEntry | null> {
    const normalizedCode = normalizeLotteryCode(lotteryCode);
    const all = await this.listAllLotteries();
    return all.find((entry) => entry.lotteryCode === normalizedCode) ?? null;
  }

  async upsertLottery(input: LotteryRegistryUpsertInput): Promise<LotteryRegistryEntry> {
    const nextEntry = sanitizeRegistryEntry(input);
    const all = await this.listAllLotteries();
    const withoutCurrent = all.filter((entry) => entry.lotteryCode !== nextEntry.lotteryCode);
    const nextEntries = sortRegistryEntries([...withoutCurrent, nextEntry]);

    assertUniqueCodes(nextEntries);
    await this.registryStore.saveEntries(nextEntries);

    return nextEntry;
  }

  async setLotteryEnabled(lotteryCode: string, enabled: boolean): Promise<LotteryRegistryEntry> {
    const current = await this.getLotteryByCode(lotteryCode);
    if (!current) {
      throw new LotteryRegistryValidationError(`lottery "${normalizeLotteryCode(lotteryCode)}" is not registered`);
    }

    return this.upsertLottery({
      lotteryCode: current.lotteryCode,
      title: current.title,
      enabled,
      displayOrder: current.displayOrder,
      formSchemaVersion: current.formSchemaVersion,
      pricing: current.pricing,
      handlers: current.handlers
    });
  }

  async replaceAll(entries: readonly LotteryRegistryUpsertInput[]): Promise<LotteryRegistryEntry[]> {
    const sanitized = entries.map((entry) => sanitizeRegistryEntry(entry));
    assertUniqueCodes(sanitized);
    const sorted = sortRegistryEntries(sanitized);
    await this.registryStore.saveEntries(sorted);
    return sorted;
  }
}

function sanitizeRegistryEntry(input: LotteryRegistryUpsertInput | LotteryRegistryEntry): LotteryRegistryEntry {
  const lotteryCode = normalizeLotteryCode(input.lotteryCode);
  if (!lotteryCode) {
    throw new LotteryRegistryValidationError("lotteryCode is required");
  }

  if (!/^[a-z0-9][a-z0-9-]{1,40}$/i.test(lotteryCode)) {
    throw new LotteryRegistryValidationError(`lotteryCode "${lotteryCode}" has invalid format`);
  }

  const title = input.title.trim();
  if (!title) {
    throw new LotteryRegistryValidationError(`lottery "${lotteryCode}" title is required`);
  }

  if (!Number.isFinite(input.displayOrder)) {
    throw new LotteryRegistryValidationError(`lottery "${lotteryCode}" displayOrder must be finite`);
  }

  const displayOrder = Math.trunc(input.displayOrder);
  if (displayOrder < 0) {
    throw new LotteryRegistryValidationError(`lottery "${lotteryCode}" displayOrder must be >= 0`);
  }

  const formSchemaVersion = input.formSchemaVersion.trim();
  if (!formSchemaVersion) {
    throw new LotteryRegistryValidationError(`lottery "${lotteryCode}" formSchemaVersion is required`);
  }

  const pricingStrategy = input.pricing.strategy;
  const pricingBaseAmountMinor = Math.trunc(input.pricing.baseAmountMinor);
  if (pricingBaseAmountMinor < 0) {
    throw new LotteryRegistryValidationError(`lottery "${lotteryCode}" pricing base amount must be >= 0`);
  }

  const purchaseHandler = input.handlers.purchaseHandler.trim();
  const resultHandler = input.handlers.resultHandler.trim();
  const nextEntry: LotteryRegistryEntry = {
    lotteryCode,
    title,
    enabled: input.enabled,
    displayOrder,
    formSchemaVersion,
    pricing: {
      strategy: pricingStrategy,
      baseAmountMinor: pricingBaseAmountMinor
    },
    handlers: {
      purchaseHandler,
      resultHandler
    }
  };

  if (!hasHandlerBindings(nextEntry)) {
    throw new LotteryRegistryValidationError(`lottery "${lotteryCode}" handler references are required`);
  }

  return nextEntry;
}

function assertUniqueCodes(entries: readonly LotteryRegistryEntry[]): void {
  const seen = new Set<string>();

  for (const entry of entries) {
    const code = normalizeLotteryCode(entry.lotteryCode);
    if (seen.has(code)) {
      throw new LotteryRegistryValidationError(`duplicate lotteryCode "${code}"`);
    }

    seen.add(code);
  }
}
