import type { DrawClosureRecord, TicketRecord, TicketVerificationJob } from "@lottery/domain";
import { closeDrawClosure, createOpenDrawClosure, createPurchasedTicketRecord } from "@lottery/domain";
import { describe, expect, it } from "vitest";
import type { DrawClosureStore } from "../ports/draw-closure-store.js";
import type { TicketStore } from "../ports/ticket-store.js";
import type { TicketVerificationJobStore } from "../ports/ticket-verification-job-store.js";
import type { TimeSource } from "../ports/time-source.js";
import { TicketVerificationQueueService } from "../services/ticket-verification-queue-service.js";

describe("TicketVerificationQueueService", () => {
  it("enqueues only pending purchased tickets", async () => {
    const ticketStore = new InMemoryTicketStore([
      createTicket("req-970", "pending"),
      createTicket("req-971", "verified")
    ]);
    const jobStore = new InMemoryTicketVerificationJobStore();
    const service = new TicketVerificationQueueService({
      ticketStore,
      jobStore,
      drawClosureStore: new InMemoryDrawClosureStore([createClosedDrawClosure("demo-lottery", "draw-970")]),
      timeSource: new FixedTimeSource("2026-04-06T00:10:00.000Z")
    });

    const result = await service.enqueuePendingVerificationTickets();

    expect(result.pendingCount).toBe(1);
    expect(result.enqueuedCount).toBe(1);
    expect(result.skippedCount).toBe(0);
    expect((await jobStore.listJobs()).length).toBe(1);
    expect((await jobStore.listJobs())[0]?.requestId).toBe("req-970");
  });

  it("skips duplicate enqueue and reserves job once", async () => {
    const ticketStore = new InMemoryTicketStore([createTicket("req-972", "pending")]);
    const jobStore = new InMemoryTicketVerificationJobStore();
    const service = new TicketVerificationQueueService({
      ticketStore,
      jobStore,
      drawClosureStore: new InMemoryDrawClosureStore([createClosedDrawClosure("demo-lottery", "draw-972")]),
      timeSource: new FixedTimeSource("2026-04-06T00:11:00.000Z")
    });

    await service.enqueuePendingVerificationTickets();
    const replay = await service.enqueuePendingVerificationTickets();
    const reserved = await service.reserveNextVerificationJob({
      workerId: "terminal-worker"
    });
    const secondReserve = await service.reserveNextVerificationJob({
      workerId: "terminal-worker"
    });

    expect(replay.enqueuedCount).toBe(0);
    expect(replay.skippedCount).toBe(1);
    expect(reserved?.status).toBe("verifying");
    expect(reserved?.attemptCount).toBe(1);
    expect(secondReserve).toBeNull();
  });

  it("marks reserved job done or error", async () => {
    const ticketStore = new InMemoryTicketStore([createTicket("req-973", "pending")]);
    const jobStore = new InMemoryTicketVerificationJobStore();
    const service = new TicketVerificationQueueService({
      ticketStore,
      jobStore,
      drawClosureStore: new InMemoryDrawClosureStore([createClosedDrawClosure("demo-lottery", "draw-973")]),
      timeSource: new FixedTimeSource("2026-04-06T00:12:00.000Z")
    });

    await service.enqueuePendingVerificationTickets();
    const reserved = await service.reserveNextVerificationJob({
      workerId: "terminal-worker"
    });
    expect(reserved).not.toBeNull();

    const done = await service.markVerificationJobDone(reserved!.jobId, {
      rawTerminalOutput: "[result] lose"
    });
    expect(done?.status).toBe("done");

    await service.enqueuePendingVerificationTickets();
    const jobsAfterDone = await jobStore.listJobs();
    expect(jobsAfterDone.length).toBe(1);

    const queuedAgain = {
      ...jobsAfterDone[0]!,
      status: "queued" as const
    };
    await jobStore.saveJob(queuedAgain);

    const reservedAgain = await service.reserveNextVerificationJob({
      workerId: "terminal-worker"
    });
    const errored = await service.markVerificationJobError(reservedAgain!.jobId, {
      error: "terminal timeout",
      rawTerminalOutput: "[result] timeout"
    });
    expect(errored?.status).toBe("error");
    expect(errored?.lastError).toContain("timeout");
  });

  it("waits for draw readiness before creating verification jobs", async () => {
    const ticketStore = new InMemoryTicketStore([createTicket("req-974", "pending")]);
    const jobStore = new InMemoryTicketVerificationJobStore();
    const service = new TicketVerificationQueueService({
      ticketStore,
      jobStore,
      drawClosureStore: new InMemoryDrawClosureStore([createOpenDrawClosure("demo-lottery", "draw-974")]),
      timeSource: new FixedTimeSource("2026-04-06T00:13:00.000Z")
    });

    const result = await service.enqueuePendingVerificationTickets();

    expect(result.pendingCount).toBe(1);
    expect(result.enqueuedCount).toBe(0);
    expect(result.skippedCount).toBe(0);
    expect((await jobStore.listJobs()).length).toBe(0);
  });
});

function createTicket(requestId: string, verificationStatus: "pending" | "verified"): TicketRecord {
  return {
    ...createPurchasedTicketRecord({
      ticketId: `${requestId}:ticket`,
      requestId,
      userId: "seed-user",
      lotteryCode: "demo-lottery",
      drawId: `draw-${requestId.split("-").at(-1)}`,
      purchasedAt: "2026-04-06T00:00:00.000Z",
      externalReference: `demo-${requestId}`
    }),
    verificationStatus
  };
}

class InMemoryTicketStore implements TicketStore {
  private tickets: TicketRecord[];

  constructor(tickets: readonly TicketRecord[]) {
    this.tickets = tickets.map((ticket) => ({ ...ticket }));
  }

  async listTickets(): Promise<readonly TicketRecord[]> {
    return this.tickets.map((ticket) => ({ ...ticket }));
  }

  async getTicketById(ticketId: string): Promise<TicketRecord | null> {
    const ticket = this.tickets.find((entry) => entry.ticketId === ticketId) ?? null;
    return ticket ? { ...ticket } : null;
  }

  async getTicketByRequestId(requestId: string): Promise<TicketRecord | null> {
    const ticket = this.tickets.find((entry) => entry.requestId === requestId) ?? null;
    return ticket ? { ...ticket } : null;
  }

  async saveTicket(ticket: TicketRecord): Promise<void> {
    const filtered = this.tickets.filter((entry) => entry.ticketId !== ticket.ticketId);
    this.tickets = [...filtered, { ...ticket }];
  }

  async clearAll(): Promise<void> {}
}

class InMemoryTicketVerificationJobStore implements TicketVerificationJobStore {
  private jobs: TicketVerificationJob[] = [];

  async listJobs(): Promise<readonly TicketVerificationJob[]> {
    return this.jobs.map((job) => ({ ...job }));
  }

  async getJobById(jobId: string): Promise<TicketVerificationJob | null> {
    const job = this.jobs.find((entry) => entry.jobId === jobId) ?? null;
    return job ? { ...job } : null;
  }

  async getJobByTicketId(ticketId: string): Promise<TicketVerificationJob | null> {
    const job = this.jobs.find((entry) => entry.ticketId === ticketId) ?? null;
    return job ? { ...job } : null;
  }

  async saveJob(job: TicketVerificationJob): Promise<void> {
    const filtered = this.jobs.filter((entry) => entry.jobId !== job.jobId);
    this.jobs = [...filtered, { ...job }];
  }
}

class InMemoryDrawClosureStore implements DrawClosureStore {
  private readonly closures: DrawClosureRecord[];

  constructor(closures: readonly DrawClosureRecord[]) {
    this.closures = closures.map((closure) => ({ ...closure }));
  }

  async getClosure(lotteryCode: string, drawId: string): Promise<DrawClosureRecord | null> {
    return this.closures.find((closure) => closure.lotteryCode === lotteryCode && closure.drawId === drawId) ?? null;
  }

  async saveClosure(): Promise<void> {
    throw new Error("read-only test double");
  }

  async listClosures(lotteryCode?: string): Promise<readonly DrawClosureRecord[]> {
    return lotteryCode
      ? this.closures.filter((closure) => closure.lotteryCode === lotteryCode)
      : [...this.closures];
  }

  async deleteClosure(): Promise<void> {
    throw new Error("read-only test double");
  }

  async clearAll(): Promise<void> {}
}

class FixedTimeSource implements TimeSource {
  private readonly value: string;

  constructor(value: string) {
    this.value = value;
  }

  nowIso(): string {
    return this.value;
  }
}

function createClosedDrawClosure(lotteryCode: string, drawId: string): DrawClosureRecord {
  return closeDrawClosure(
    createOpenDrawClosure(lotteryCode, drawId),
    "seed-admin",
    "2026-04-06T00:09:59.000Z"
  );
}
