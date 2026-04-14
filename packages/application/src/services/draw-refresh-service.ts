import {
  type DrawAvailabilityState,
  type DrawOption,
  type DrawSnapshot,
  listSnapshotDrawOptions,
  normalizeLotteryCode,
  resolveDrawAvailabilityState
} from "@lottery/domain";
import type { DrawStore } from "../ports/draw-store.js";
import type { TimeSource } from "../ports/time-source.js";

export interface DrawRefreshServiceDependencies {
  readonly drawStore: DrawStore;
  readonly timeSource: TimeSource;
}

export interface DrawSnapshotUpsertInput {
  readonly lotteryCode: string;
  readonly drawId: string;
  readonly drawAt: string;
  readonly fetchedAt?: string;
  readonly freshnessTtlSeconds: number;
  readonly availableDraws?: readonly DrawOption[];
}

export interface DrawDataProvider {
  fetchCurrentDraw(lotteryCode: string): Promise<Omit<DrawSnapshotUpsertInput, "lotteryCode"> | null>;
}

export class DrawRefreshValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DrawRefreshValidationError";
  }
}

export class DrawRefreshService {
  private readonly drawStore: DrawStore;
  private readonly timeSource: TimeSource;

  constructor(dependencies: DrawRefreshServiceDependencies) {
    this.drawStore = dependencies.drawStore;
    this.timeSource = dependencies.timeSource;
  }

  async listSnapshots(): Promise<DrawSnapshot[]> {
    const snapshots = await this.drawStore.listSnapshots();
    return snapshots.map((snapshot) => sanitizeSnapshot(snapshot, this.timeSource.nowIso()));
  }

  async getDrawState(lotteryCode: string): Promise<DrawAvailabilityState> {
    const normalizedCode = normalizeLotteryCode(lotteryCode);
    const snapshot = await this.drawStore.getSnapshot(normalizedCode);
    const nowIso = this.timeSource.nowIso();
    return resolveDrawAvailabilityState(normalizedCode, snapshot, nowIso);
  }

  async listAvailableDraws(lotteryCode: string): Promise<readonly DrawOption[]> {
    const normalizedCode = normalizeLotteryCode(lotteryCode);
    const snapshot = await this.drawStore.getSnapshot(normalizedCode);
    return listSnapshotDrawOptions(snapshot);
  }

  async upsertSnapshot(input: DrawSnapshotUpsertInput): Promise<DrawSnapshot> {
    const nowIso = this.timeSource.nowIso();
    const snapshot = sanitizeSnapshot(input, nowIso);
    await this.drawStore.upsertSnapshot(snapshot);
    return snapshot;
  }

  async refreshLottery(lotteryCode: string, provider: DrawDataProvider): Promise<DrawAvailabilityState> {
    const normalizedCode = normalizeLotteryCode(lotteryCode);
    const provided = await provider.fetchCurrentDraw(normalizedCode);
    if (!provided) {
      return this.getDrawState(normalizedCode);
    }

    await this.upsertSnapshot({
      lotteryCode: normalizedCode,
      drawId: provided.drawId,
      drawAt: provided.drawAt,
      freshnessTtlSeconds: provided.freshnessTtlSeconds,
      ...(provided.availableDraws ? { availableDraws: provided.availableDraws } : {}),
      ...(provided.fetchedAt ? { fetchedAt: provided.fetchedAt } : {})
    });

    return this.getDrawState(normalizedCode);
  }
}

function sanitizeSnapshot(input: DrawSnapshotUpsertInput | DrawSnapshot, fallbackFetchedAt: string): DrawSnapshot {
  const lotteryCode = normalizeLotteryCode(input.lotteryCode);
  if (!lotteryCode) {
    throw new DrawRefreshValidationError("lotteryCode is required");
  }

  if (!/^[a-z0-9][a-z0-9-]{1,40}$/i.test(lotteryCode)) {
    throw new DrawRefreshValidationError(`lotteryCode "${lotteryCode}" has invalid format`);
  }

  const drawId = input.drawId.trim();
  if (!drawId) {
    throw new DrawRefreshValidationError(`drawId is required for lottery "${lotteryCode}"`);
  }

  const drawAt = normalizeIsoOrThrow(input.drawAt, `drawAt for lottery "${lotteryCode}"`);
  const fetchedAt = normalizeIsoOrThrow(input.fetchedAt ?? fallbackFetchedAt, `fetchedAt for lottery "${lotteryCode}"`);
  const availableDraws = sanitizeDrawOptions(input.availableDraws);

  const freshnessTtlSeconds = Math.trunc(input.freshnessTtlSeconds);
  if (!Number.isFinite(freshnessTtlSeconds) || freshnessTtlSeconds <= 0) {
    throw new DrawRefreshValidationError(`freshnessTtlSeconds for lottery "${lotteryCode}" must be > 0`);
  }

  return {
    lotteryCode,
    drawId,
    drawAt,
    fetchedAt,
    freshnessTtlSeconds,
    ...(availableDraws.length > 0 ? { availableDraws } : {})
  };
}

function normalizeIsoOrThrow(value: string, fieldLabel: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new DrawRefreshValidationError(`${fieldLabel} must be valid ISO timestamp`);
  }

  return new Date(timestamp).toISOString();
}

function sanitizeDrawOptions(input: readonly DrawOption[] | undefined): readonly DrawOption[] {
  if (!input || input.length === 0) {
    return [];
  }

  const uniqueById = new Map<string, DrawOption>();
  for (const entry of input) {
    const drawId = entry.drawId.trim();
    if (!drawId) {
      throw new DrawRefreshValidationError("availableDraws drawId is required");
    }

    uniqueById.set(drawId, {
      drawId,
      drawAt: normalizeIsoOrThrow(entry.drawAt, `availableDraws.${drawId}.drawAt`),
      label: entry.label.trim() || drawId,
      ...(typeof entry.priceMinor === "number" && Number.isFinite(entry.priceMinor)
        ? { priceMinor: Math.max(0, Math.trunc(entry.priceMinor)) }
        : {})
    });
  }

  return [...uniqueById.values()].sort((left, right) => Date.parse(left.drawAt) - Date.parse(right.drawAt));
}
