import {
  type DrawAvailabilityState,
  type DrawOption,
  type DrawSnapshot,
  type LotteryDrawFreshnessMode,
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

  async getDrawState(lotteryCode: string, freshnessMode?: LotteryDrawFreshnessMode): Promise<DrawAvailabilityState> {
    const normalizedCode = normalizeLotteryCode(lotteryCode);
    const snapshot = await this.drawStore.getSnapshot(normalizedCode);
    const nowIso = this.timeSource.nowIso();
    return resolveDrawAvailabilityState(normalizedCode, snapshot, nowIso, freshnessMode);
  }

  async listAvailableDraws(lotteryCode: string): Promise<readonly DrawOption[]> {
    const normalizedCode = normalizeLotteryCode(lotteryCode);
    const snapshot = await this.drawStore.getSnapshot(normalizedCode);
    return listSnapshotDrawOptions(snapshot);
  }

  async upsertSnapshot(input: DrawSnapshotUpsertInput): Promise<DrawSnapshot> {
    const nowIso = this.timeSource.nowIso();
    const sanitized = sanitizeSnapshot(input, nowIso);
    const existing = await this.drawStore.getSnapshot(sanitized.lotteryCode);
    const snapshot = mergeSnapshotDrawOptions(sanitized, existing);
    await this.drawStore.upsertSnapshot(snapshot);
    return snapshot;
  }

  async removeDraw(lotteryCode: string, drawId: string): Promise<boolean> {
    const normalizedCode = normalizeLotteryCode(lotteryCode);
    const normalizedDrawId = drawId.trim();
    if (!normalizedDrawId) {
      return false;
    }

    const existing = await this.drawStore.getSnapshot(normalizedCode);
    if (!existing) {
      return false;
    }

    const remainingDraws = listSnapshotDrawOptions(existing).filter((draw) => draw.drawId !== normalizedDrawId);
    if (remainingDraws.length === listSnapshotDrawOptions(existing).length) {
      return false;
    }

    if (remainingDraws.length === 0) {
      await this.drawStore.deleteSnapshot(normalizedCode);
      return true;
    }

    const nextCurrentDraw = remainingDraws[0]!;
    await this.drawStore.upsertSnapshot({
      ...existing,
      drawId: nextCurrentDraw.drawId,
      drawAt: nextCurrentDraw.drawAt,
      fetchedAt: this.timeSource.nowIso(),
      availableDraws: remainingDraws
    });
    return true;
  }

  async clearAllSnapshots(): Promise<void> {
    await this.drawStore.clearAll();
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

function mergeSnapshotDrawOptions(next: DrawSnapshot, existing: DrawSnapshot | null): DrawSnapshot {
  const mergedOptions = new Map<string, DrawOption>();

  for (const option of listSnapshotDrawOptions(existing)) {
    mergedOptions.set(option.drawId, { ...option });
  }

  for (const option of listSnapshotDrawOptions(next)) {
    mergedOptions.set(option.drawId, { ...option });
  }

  const currentOption = mergedOptions.get(next.drawId);
  mergedOptions.set(next.drawId, {
    drawId: next.drawId,
    drawAt: next.drawAt,
    label: currentOption?.label ?? next.drawId,
    ...(typeof currentOption?.priceMinor === "number" ? { priceMinor: currentOption.priceMinor } : {})
  });

  const availableDraws = [...mergedOptions.values()].sort((left, right) => Date.parse(left.drawAt) - Date.parse(right.drawAt));

  return {
    ...next,
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
