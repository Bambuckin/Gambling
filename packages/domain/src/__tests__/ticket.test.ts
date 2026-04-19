import { describe, expect, it } from "vitest";
import {
  applyTicketVerificationOutcome,
  completeTicketVerificationJob,
  createPurchasedTicketRecord,
  createTicketVerificationJob,
  failTicketVerificationJob,
  isTicketPendingVerification,
  reserveTicketVerificationJob,
  setTicketAdminResultMark,
  resolveTicketFromAdminMark,
  TicketValidationError
} from "../ticket.js";

describe("createPurchasedTicketRecord", () => {
  it("creates purchased ticket with pending verification defaults", () => {
    const ticket = createPurchasedTicketRecord({
      ticketId: "req-900:ticket",
      requestId: "req-900",
      userId: "seed-user",
      lotteryCode: "demo-lottery",
      drawId: "draw-900",
      purchasedAt: "2026-04-05T23:00:00.000Z",
      externalReference: "demo-ext-900"
    });

    expect(ticket).toEqual({
      ticketId: "req-900:ticket",
      requestId: "req-900",
      userId: "seed-user",
      lotteryCode: "demo-lottery",
      drawId: "draw-900",
      purchasedAt: "2026-04-05T23:00:00.000Z",
      externalReference: "demo-ext-900",
      purchaseStatus: "purchased",
      verificationStatus: "pending",
      verificationRawOutput: null,
      winningAmountMinor: null,
      verifiedAt: null,
      lastVerificationEventId: null,
      adminResultMark: null,
      adminResultMarkedBy: null,
      adminResultMarkedAt: null,
      resultSource: null,
      claimState: "unclaimed"
    });
  });

  it("falls back to deterministic external reference when not provided", () => {
    const ticket = createPurchasedTicketRecord({
      ticketId: "req-901:ticket",
      requestId: "req-901",
      userId: "seed-user",
      lotteryCode: "demo-lottery",
      drawId: "draw-901",
      purchasedAt: "2026-04-05T23:00:01.000Z",
      externalReference: "   "
    });

    expect(ticket.externalReference).toBe("demo-lottery-req-901");
  });

  it("rejects invalid ticket input", () => {
    expect(() =>
      createPurchasedTicketRecord({
        ticketId: "req-902:ticket",
        requestId: "req-902",
        userId: " ",
        lotteryCode: "demo-lottery",
        drawId: "draw-902",
        purchasedAt: "2026-04-05T23:00:02.000Z"
      })
    ).toThrow(TicketValidationError);

    expect(() =>
      createPurchasedTicketRecord({
        ticketId: "req-903:ticket",
        requestId: "req-903",
        userId: "seed-user",
        lotteryCode: "demo-lottery",
        drawId: "draw-903",
        purchasedAt: "not-iso"
      })
    ).toThrow(TicketValidationError);
  });
});

describe("ticket verification jobs", () => {
  it("marks purchased+pending ticket as verification-eligible", () => {
    const pendingTicket = createPurchasedTicketRecord({
      ticketId: "req-910:ticket",
      requestId: "req-910",
      userId: "seed-user",
      lotteryCode: "demo-lottery",
      drawId: "draw-910",
      purchasedAt: "2026-04-05T23:05:00.000Z",
      externalReference: "demo-ext-910"
    });

    expect(isTicketPendingVerification(pendingTicket)).toBe(true);
    expect(
      isTicketPendingVerification({
        ...pendingTicket,
        verificationStatus: "verified"
      })
    ).toBe(false);
  });

  it("creates verification job, reserves it, and completes it", () => {
    const queuedJob = createTicketVerificationJob({
      ticketId: "req-911:ticket",
      requestId: "req-911",
      lotteryCode: "demo-lottery",
      drawId: "draw-911",
      externalReference: "demo-ext-911",
      enqueuedAt: "2026-04-05T23:06:00.000Z"
    });

    expect(queuedJob.status).toBe("queued");
    expect(queuedJob.attemptCount).toBe(0);

    const reservedJob = reserveTicketVerificationJob(queuedJob, "2026-04-05T23:06:10.000Z");
    expect(reservedJob.status).toBe("verifying");
    expect(reservedJob.attemptCount).toBe(1);

    const completedJob = completeTicketVerificationJob(reservedJob, {
      updatedAt: "2026-04-05T23:06:20.000Z",
      rawTerminalOutput: "[result] lose"
    });

    expect(completedJob.status).toBe("done");
    expect(completedJob.lastTerminalOutput).toContain("lose");
    expect(completedJob.lastError).toBeNull();
  });

  it("marks reserved job as error", () => {
    const queuedJob = createTicketVerificationJob({
      ticketId: "req-912:ticket",
      requestId: "req-912",
      lotteryCode: "demo-lottery",
      drawId: "draw-912",
      externalReference: "demo-ext-912",
      enqueuedAt: "2026-04-05T23:07:00.000Z"
    });
    const reservedJob = reserveTicketVerificationJob(queuedJob, "2026-04-05T23:07:10.000Z");

    const failedJob = failTicketVerificationJob(reservedJob, {
      updatedAt: "2026-04-05T23:07:15.000Z",
      error: "terminal timeout",
      rawTerminalOutput: "[result] timeout"
    });

    expect(failedJob.status).toBe("error");
    expect(failedJob.lastError).toContain("timeout");
    expect(failedJob.lastTerminalOutput).toContain("timeout");
  });

  it("rejects invalid verification-job transitions", () => {
    const queuedJob = createTicketVerificationJob({
      ticketId: "req-913:ticket",
      requestId: "req-913",
      lotteryCode: "demo-lottery",
      drawId: "draw-913",
      externalReference: "demo-ext-913",
      enqueuedAt: "2026-04-05T23:08:00.000Z"
    });

    expect(() =>
      completeTicketVerificationJob(queuedJob, {
        updatedAt: "2026-04-05T23:08:10.000Z",
        rawTerminalOutput: "n/a"
      })
    ).toThrow(TicketValidationError);
  });
});

describe("applyTicketVerificationOutcome", () => {
  it("applies verified outcome with winning amount and verified timestamp", () => {
    const ticket = createPurchasedTicketRecord({
      ticketId: "req-920:ticket",
      requestId: "req-920",
      userId: "seed-user",
      lotteryCode: "demo-lottery",
      drawId: "draw-920",
      purchasedAt: "2026-04-05T23:10:00.000Z",
      externalReference: "demo-ext-920"
    });

    const verified = applyTicketVerificationOutcome(ticket, {
      verificationStatus: "verified",
      verificationEventId: "job:req-920:1",
      verifiedAt: "2026-04-05T23:11:00.000Z",
      rawTerminalOutput: "[result] win",
      winningAmountMinor: 1500
    });

    expect(verified.verificationStatus).toBe("verified");
    expect(verified.winningAmountMinor).toBe(1500);
    expect(verified.verifiedAt).toBe("2026-04-05T23:11:00.000Z");
    expect(verified.lastVerificationEventId).toBe("job:req-920:1");
  });

  it("applies failed outcome and stores raw terminal output", () => {
    const ticket = createPurchasedTicketRecord({
      ticketId: "req-921:ticket",
      requestId: "req-921",
      userId: "seed-user",
      lotteryCode: "demo-lottery",
      drawId: "draw-921",
      purchasedAt: "2026-04-05T23:12:00.000Z",
      externalReference: "demo-ext-921"
    });

    const failed = applyTicketVerificationOutcome(ticket, {
      verificationStatus: "failed",
      verificationEventId: "job:req-921:1",
      verifiedAt: "2026-04-05T23:13:00.000Z",
      rawTerminalOutput: "[result] error",
      winningAmountMinor: 0
    });

    expect(failed.verificationStatus).toBe("failed");
    expect(failed.winningAmountMinor).toBeNull();
    expect(failed.verifiedAt).toBe("2026-04-05T23:13:00.000Z");
    expect(failed.verificationRawOutput).toContain("error");
  });

  it("rejects negative winning amount", () => {
    const ticket = createPurchasedTicketRecord({
      ticketId: "req-922:ticket",
      requestId: "req-922",
      userId: "seed-user",
      lotteryCode: "demo-lottery",
      drawId: "draw-922",
      purchasedAt: "2026-04-05T23:14:00.000Z",
      externalReference: "demo-ext-922"
    });

    expect(() =>
      applyTicketVerificationOutcome(ticket, {
        verificationStatus: "verified",
        verificationEventId: "job:req-922:1",
        verifiedAt: "2026-04-05T23:15:00.000Z",
        rawTerminalOutput: "[result] win",
        winningAmountMinor: -1
      })
    ).toThrow(TicketValidationError);
  });
});

describe("setTicketAdminResultMark", () => {
  it("marks a pending ticket as win", () => {
    const ticket = createPurchasedTicketRecord({
      ticketId: "req-930:ticket",
      requestId: "req-930",
      userId: "seed-user",
      lotteryCode: "demo-lottery",
      drawId: "draw-930",
      purchasedAt: "2026-04-05T23:20:00.000Z"
    });

    const marked = setTicketAdminResultMark(ticket, "win", "admin-1", "2026-04-05T23:21:00.000Z");
    expect(marked.adminResultMark).toBe("win");
    expect(marked.adminResultMarkedBy).toBe("admin-1");
    expect(marked.adminResultMarkedAt).toBe("2026-04-05T23:21:00.000Z");
    expect(marked.verificationStatus).toBe("pending");
  });

  it("marks a pending ticket as lose", () => {
    const ticket = createPurchasedTicketRecord({
      ticketId: "req-931:ticket",
      requestId: "req-931",
      userId: "seed-user",
      lotteryCode: "demo-lottery",
      drawId: "draw-931",
      purchasedAt: "2026-04-05T23:22:00.000Z"
    });

    const marked = setTicketAdminResultMark(ticket, "lose", "admin-1", "2026-04-05T23:22:30.000Z");
    expect(marked.adminResultMark).toBe("lose");
  });

  it("rejects marking already verified ticket", () => {
    const ticket = createPurchasedTicketRecord({
      ticketId: "req-932:ticket",
      requestId: "req-932",
      userId: "seed-user",
      lotteryCode: "demo-lottery",
      drawId: "draw-932",
      purchasedAt: "2026-04-05T23:23:00.000Z"
    });

    const verified = applyTicketVerificationOutcome(ticket, {
      verificationStatus: "verified",
      verificationEventId: "job:req-932:1",
      verifiedAt: "2026-04-05T23:24:00.000Z",
      rawTerminalOutput: "[result] lose",
      winningAmountMinor: 0
    });

    expect(() => setTicketAdminResultMark(verified, "win", "admin-1", "2026-04-05T23:25:00.000Z")).toThrow(
      TicketValidationError
    );
  });
});

describe("resolveTicketFromAdminMark", () => {
  it("resolves win-marked ticket with win amount", () => {
    const ticket = createPurchasedTicketRecord({
      ticketId: "req-940:ticket",
      requestId: "req-940",
      userId: "seed-user",
      lotteryCode: "demo-lottery",
      drawId: "draw-940",
      purchasedAt: "2026-04-05T23:30:00.000Z"
    });

    const marked = setTicketAdminResultMark(ticket, "win", "admin-1", "2026-04-05T23:31:00.000Z");
    const resolved = resolveTicketFromAdminMark(marked, 50_000, "2026-04-05T23:32:00.000Z", "admin-1");

    expect(resolved.verificationStatus).toBe("verified");
    expect(resolved.winningAmountMinor).toBe(50_000);
    expect(resolved.resultSource).toBe("admin_emulated");
    expect(resolved.verifiedAt).toBe("2026-04-05T23:32:00.000Z");
  });

  it("resolves lose-marked ticket with zero winning", () => {
    const ticket = createPurchasedTicketRecord({
      ticketId: "req-941:ticket",
      requestId: "req-941",
      userId: "seed-user",
      lotteryCode: "demo-lottery",
      drawId: "draw-941",
      purchasedAt: "2026-04-05T23:33:00.000Z"
    });

    const marked = setTicketAdminResultMark(ticket, "lose", "admin-1", "2026-04-05T23:34:00.000Z");
    const resolved = resolveTicketFromAdminMark(marked, 50_000, "2026-04-05T23:35:00.000Z", "admin-1");

    expect(resolved.verificationStatus).toBe("verified");
    expect(resolved.winningAmountMinor).toBe(0);
    expect(resolved.resultSource).toBe("admin_emulated");
  });

  it("defaults unmarked ticket to lose", () => {
    const ticket = createPurchasedTicketRecord({
      ticketId: "req-942:ticket",
      requestId: "req-942",
      userId: "seed-user",
      lotteryCode: "demo-lottery",
      drawId: "draw-942",
      purchasedAt: "2026-04-05T23:36:00.000Z"
    });

    const resolved = resolveTicketFromAdminMark(ticket, 50_000, "2026-04-05T23:37:00.000Z", "admin-1");
    expect(resolved.verificationStatus).toBe("verified");
    expect(resolved.winningAmountMinor).toBe(0);
    expect(resolved.resultSource).toBe("admin_emulated");
  });

  it("skips already resolved ticket idempotently", () => {
    const ticket = createPurchasedTicketRecord({
      ticketId: "req-943:ticket",
      requestId: "req-943",
      userId: "seed-user",
      lotteryCode: "demo-lottery",
      drawId: "draw-943",
      purchasedAt: "2026-04-05T23:38:00.000Z"
    });

    const first = resolveTicketFromAdminMark(ticket, 50_000, "2026-04-05T23:39:00.000Z", "admin-1");
    const second = resolveTicketFromAdminMark(first, 50_000, "2026-04-05T23:40:00.000Z", "admin-1");

    expect(second.verifiedAt).toBe(first.verifiedAt);
    expect(second.verificationStatus).toBe("verified");
  });
});
