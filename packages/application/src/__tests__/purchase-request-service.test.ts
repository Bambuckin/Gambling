import { describe, expect, it } from "vitest";
import type { PurchaseRequestRecord } from "@lottery/domain";
import type { TimeSource } from "../ports/time-source.js";
import type { PurchaseRequestStore } from "../ports/purchase-request-store.js";
import { PurchaseRequestService, PurchaseRequestServiceError } from "../services/purchase-request-service.js";

describe("PurchaseRequestService", () => {
  it("creates immutable awaiting confirmation request record", async () => {
    const service = createService();

    const result = await service.createAwaitingConfirmation({
      requestId: "req-200",
      userId: "seed-user",
      lotteryCode: "demo-lottery",
      drawId: "draw-100",
      payload: {
        draw_count: 2,
        bet_system: "standard"
      },
      costMinor: 300,
      currency: "RUB"
    });

    expect(result.replayed).toBe(false);
    expect(result.request.state).toBe("awaiting_confirmation");
    expect(result.request.snapshot.requestId).toBe("req-200");
    expect(result.request.journal).toHaveLength(1);
    expect(result.request.journal[0]).toMatchObject({
      fromState: "created",
      toState: "awaiting_confirmation"
    });
  });

  it("returns replayed result when requestId payload is identical", async () => {
    const service = createService();

    const first = await service.createAwaitingConfirmation({
      requestId: "req-201",
      userId: "seed-user",
      lotteryCode: "demo-lottery",
      drawId: "draw-100",
      payload: {
        draw_count: 1
      },
      costMinor: 100,
      currency: "RUB"
    });
    const replay = await service.createAwaitingConfirmation({
      requestId: "req-201",
      userId: "seed-user",
      lotteryCode: "demo-lottery",
      drawId: "draw-100",
      payload: {
        draw_count: 1
      },
      costMinor: 100,
      currency: "RUB"
    });

    expect(first.replayed).toBe(false);
    expect(replay.replayed).toBe(true);
    expect(replay.request.snapshot.requestId).toBe(first.request.snapshot.requestId);
  });

  it("treats nested payloads as identical for replay protection", async () => {
    const service = createService();

    const first = await service.createAwaitingConfirmation({
      requestId: "req-201-nested",
      userId: "seed-user",
      lotteryCode: "bolshaya-8",
      drawId: "draw-101",
      payload: {
        schema: "big8-v1",
        contactPhone: "79990001122",
        tickets: [
          {
            boardNumbers: [1, 2, 3, 4, 5, 6, 7, 8],
            extraNumber: 1,
            multiplier: 1
          }
        ]
      },
      costMinor: 25_000,
      currency: "RUB"
    });
    const replay = await service.createAwaitingConfirmation({
      requestId: "req-201-nested",
      userId: "seed-user",
      lotteryCode: "bolshaya-8",
      drawId: "draw-101",
      payload: {
        schema: "big8-v1",
        contactPhone: "79990001122",
        tickets: [
          {
            boardNumbers: [1, 2, 3, 4, 5, 6, 7, 8],
            extraNumber: 1,
            multiplier: 1
          }
        ]
      },
      costMinor: 25_000,
      currency: "RUB"
    });

    expect(first.replayed).toBe(false);
    expect(replay.replayed).toBe(true);
  });

  it("throws conflict when requestId is reused with different payload", async () => {
    const service = createService();

    await service.createAwaitingConfirmation({
      requestId: "req-202",
      userId: "seed-user",
      lotteryCode: "demo-lottery",
      drawId: "draw-100",
      payload: {
        draw_count: 1
      },
      costMinor: 100,
      currency: "RUB"
    });

    const action = service.createAwaitingConfirmation({
      requestId: "req-202",
      userId: "seed-user",
      lotteryCode: "demo-lottery",
      drawId: "draw-100",
      payload: {
        draw_count: 2
      },
      costMinor: 200,
      currency: "RUB"
    });

    await expect(action).rejects.toBeInstanceOf(PurchaseRequestServiceError);
    await expect(action).rejects.toMatchObject({
      code: "request_conflict"
    });
  });

  it("lists requests by user", async () => {
    const service = createService();

    await service.createAwaitingConfirmation({
      requestId: "req-203",
      userId: "seed-user",
      lotteryCode: "demo-lottery",
      drawId: "draw-100",
      payload: {
        draw_count: 1
      },
      costMinor: 100,
      currency: "RUB"
    });
    await service.createAwaitingConfirmation({
      requestId: "req-204",
      userId: "seed-admin",
      lotteryCode: "demo-lottery",
      drawId: "draw-100",
      payload: {
        draw_count: 1
      },
      costMinor: 100,
      currency: "RUB"
    });

    const userRecords = await service.listByUser("seed-user");
    expect(userRecords).toHaveLength(1);
    expect(userRecords[0]?.snapshot.requestId).toBe("req-203");
  });
});

function createService(): PurchaseRequestService {
  return new PurchaseRequestService({
    requestStore: new InMemoryPurchaseRequestStore(),
    timeSource: {
      nowIso() {
        return "2026-04-05T20:00:00.000Z";
      }
    } satisfies TimeSource
  });
}

class InMemoryPurchaseRequestStore implements PurchaseRequestStore {
  private records: PurchaseRequestRecord[] = [];

  async listRequests(): Promise<readonly PurchaseRequestRecord[]> {
    return this.records.map(cloneRecord);
  }

  async getRequestById(requestId: string): Promise<PurchaseRequestRecord | null> {
    const record = this.records.find((entry) => entry.snapshot.requestId === requestId) ?? null;
    return record ? cloneRecord(record) : null;
  }

  async saveRequest(record: PurchaseRequestRecord): Promise<void> {
    const filtered = this.records.filter((entry) => entry.snapshot.requestId !== record.snapshot.requestId);
    this.records = [...filtered, cloneRecord(record)];
  }

  async clearAll(): Promise<void> {}
}

function cloneRecord(record: PurchaseRequestRecord): PurchaseRequestRecord {
  return {
    snapshot: {
      ...record.snapshot,
      payload: JSON.parse(JSON.stringify(record.snapshot.payload))
    },
    state: record.state,
    journal: record.journal.map((entry) => ({ ...entry }))
  };
}
