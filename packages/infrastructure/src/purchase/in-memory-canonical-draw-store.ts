import type { CanonicalDrawRecord } from "@lottery/domain";
import type { CanonicalDrawStore } from "@lottery/application";

export class InMemoryCanonicalDrawStore implements CanonicalDrawStore {
  private records: CanonicalDrawRecord[];

  constructor(initialRecords: readonly CanonicalDrawRecord[] = []) {
    this.records = initialRecords.map(cloneRecord);
  }

  async listDraws(lotteryCode?: string): Promise<readonly CanonicalDrawRecord[]> {
    const normalizedLotteryCode = typeof lotteryCode === "string" ? lotteryCode.trim().toLowerCase() : null;

    return this.records
      .filter((entry) => !normalizedLotteryCode || entry.lotteryCode === normalizedLotteryCode)
      .map(cloneRecord)
      .sort((left, right) => compareRecords(left, right));
  }

  async getDraw(lotteryCode: string, drawId: string): Promise<CanonicalDrawRecord | null> {
    const normalizedLotteryCode = lotteryCode.trim().toLowerCase();
    const normalizedDrawId = drawId.trim();
    const record =
      this.records.find((entry) => entry.lotteryCode === normalizedLotteryCode && entry.drawId === normalizedDrawId) ??
      null;
    return record ? cloneRecord(record) : null;
  }

  async saveDraw(record: CanonicalDrawRecord): Promise<void> {
    const filtered = this.records.filter(
      (entry) => !(entry.lotteryCode === record.lotteryCode && entry.drawId === record.drawId)
    );
    this.records = [...filtered, cloneRecord(record)];
  }

  async deleteDraw(lotteryCode: string, drawId: string): Promise<void> {
    const normalizedLotteryCode = lotteryCode.trim().toLowerCase();
    const normalizedDrawId = drawId.trim();
    this.records = this.records.filter(
      (entry) => !(entry.lotteryCode === normalizedLotteryCode && entry.drawId === normalizedDrawId)
    );
  }

  async clearAll(): Promise<void> {
    this.records = [];
  }
}

function compareRecords(left: CanonicalDrawRecord, right: CanonicalDrawRecord): number {
  const byDrawAt = left.drawAt.localeCompare(right.drawAt);
  if (byDrawAt !== 0) {
    return byDrawAt;
  }

  const byLotteryCode = left.lotteryCode.localeCompare(right.lotteryCode);
  if (byLotteryCode !== 0) {
    return byLotteryCode;
  }

  return left.drawId.localeCompare(right.drawId);
}

function cloneRecord(record: CanonicalDrawRecord): CanonicalDrawRecord {
  return {
    ...record
  };
}
