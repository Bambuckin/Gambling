import {
  createPurchasedTicketRecord,
  type TicketRecord
} from "@lottery/domain";
import { describe, expect, it } from "vitest";
import type { TicketStore } from "../ports/ticket-store.js";
import type { TimeSource } from "../ports/time-source.js";
import {
  TicketVerificationResultService,
  TicketVerificationResultServiceError
} from "../services/ticket-verification-result-service.js";

describe("TicketVerificationResultService", () => {
  it("normalizes verification result without auto-crediting winnings", async () => {
    const ticketStore = new InMemoryTicketStore([createPendingTicket("req-980")]);
    const service = new TicketVerificationResultService({
      ticketStore,
      timeSource: new FixedTimeSource("2026-04-06T01:10:00.000Z")
    });

    const result = await service.recordVerificationResult({
      ticketId: "req-980:ticket",
      verificationEventId: "req-980:verify:1",
      terminalStatus: "win",
      winningAmountMinor: 3400,
      rawOutput: "[terminal-result] win"
    });

    expect(result.replayed).toBe(false);
    expect(result.verificationStatus).toBe("verified");
    expect(result.winningAmountMinor).toBe(3400);
    expect(result.rawOutput).toContain("win");
    expect(result.winningsCredited).toBe(false);
    expect(ticketStore.saveCount).toBe(1);

    const updatedTicket = await ticketStore.getTicketById("req-980:ticket");
    expect(updatedTicket?.verificationStatus).toBe("verified");
    expect(updatedTicket?.winningAmountMinor).toBe(3400);
    expect(updatedTicket?.verificationRawOutput).toContain("win");
  });

  it("returns replayed=true for the same verification event", async () => {
    const ticketStore = new InMemoryTicketStore([createPendingTicket("req-981")]);
    const service = new TicketVerificationResultService({
      ticketStore,
      timeSource: new FixedTimeSource("2026-04-06T01:11:00.000Z")
    });

    const first = await service.recordVerificationResult({
      ticketId: "req-981:ticket",
      verificationEventId: "req-981:verify:1",
      terminalStatus: "win",
      winningAmountMinor: 1200,
      rawOutput: "[terminal-result] win"
    });
    const replay = await service.recordVerificationResult({
      ticketId: "req-981:ticket",
      verificationEventId: "req-981:verify:1",
      terminalStatus: "win",
      winningAmountMinor: 1200,
      rawOutput: "[terminal-result] win"
    });

    expect(first.replayed).toBe(false);
    expect(replay.replayed).toBe(true);
    expect(replay.winningsCredited).toBe(false);
    expect(ticketStore.saveCount).toBe(1);
  });

  it("fails replay when event payload does not match persisted ticket outcome", async () => {
    const ticketStore = new InMemoryTicketStore([createPendingTicket("req-982")]);
    const service = new TicketVerificationResultService({
      ticketStore,
      timeSource: new FixedTimeSource("2026-04-06T01:12:00.000Z")
    });

    await service.recordVerificationResult({
      ticketId: "req-982:ticket",
      verificationEventId: "req-982:verify:1",
      terminalStatus: "lose",
      winningAmountMinor: 0,
      rawOutput: "[terminal-result] lose"
    });

    const action = service.recordVerificationResult({
      ticketId: "req-982:ticket",
      verificationEventId: "req-982:verify:1",
      terminalStatus: "win",
      winningAmountMinor: 1500,
      rawOutput: "[terminal-result] win"
    });

    await expect(action).rejects.toBeInstanceOf(TicketVerificationResultServiceError);
    await expect(action).rejects.toMatchObject({
      code: "replay_conflict"
    });
  });
});

function createPendingTicket(requestId: string): TicketRecord {
  return createPurchasedTicketRecord({
    ticketId: `${requestId}:ticket`,
    requestId,
    userId: "seed-user",
    lotteryCode: "demo-lottery",
    drawId: `draw-${requestId.split("-").at(-1)}`,
    purchasedAt: "2026-04-06T01:00:00.000Z",
    externalReference: `ext-${requestId}`
  });
}

class InMemoryTicketStore implements TicketStore {
  private tickets: TicketRecord[];
  saveCount = 0;

  constructor(initialTickets: readonly TicketRecord[]) {
    this.tickets = initialTickets.map(cloneTicket);
  }

  async listTickets(): Promise<readonly TicketRecord[]> {
    return this.tickets.map(cloneTicket);
  }

  async getTicketById(ticketId: string): Promise<TicketRecord | null> {
    const ticket = this.tickets.find((entry) => entry.ticketId === ticketId) ?? null;
    return ticket ? cloneTicket(ticket) : null;
  }

  async getTicketByRequestId(requestId: string): Promise<TicketRecord | null> {
    const ticket = this.tickets.find((entry) => entry.requestId === requestId) ?? null;
    return ticket ? cloneTicket(ticket) : null;
  }

  async saveTicket(ticket: TicketRecord): Promise<void> {
    this.saveCount += 1;
    const filtered = this.tickets.filter((entry) => entry.ticketId !== ticket.ticketId);
    this.tickets = [...filtered, cloneTicket(ticket)];
  }

  async clearAll(): Promise<void> {}
}

class FixedTimeSource implements TimeSource {
  constructor(private readonly value: string) {}

  nowIso(): string {
    return this.value;
  }
}

function cloneTicket(ticket: TicketRecord): TicketRecord {
  return {
    ...ticket
  };
}
