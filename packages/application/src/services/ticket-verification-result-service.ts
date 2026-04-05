import { applyTicketVerificationOutcome, type TicketRecord } from "@lottery/domain";
import type { PurchaseRequestStore } from "../ports/purchase-request-store.js";
import type { TicketStore } from "../ports/ticket-store.js";
import type { TimeSource } from "../ports/time-source.js";
import type { WalletLedgerService } from "./wallet-ledger-service.js";

export interface TicketVerificationResultServiceDependencies {
  readonly ticketStore: TicketStore;
  readonly purchaseRequestStore: PurchaseRequestStore;
  readonly walletLedgerService: WalletLedgerService;
  readonly timeSource: TimeSource;
}

export interface RecordTicketVerificationResultInput {
  readonly ticketId: string;
  readonly verificationEventId: string;
  readonly terminalStatus: "win" | "lose" | "pending" | "error";
  readonly winningAmountMinor: number;
  readonly rawOutput: string;
  readonly verifiedAt?: string;
}

export interface RecordTicketVerificationResultResult {
  readonly ticket: TicketRecord;
  readonly verificationStatus: TicketRecord["verificationStatus"];
  readonly winningAmountMinor: number | null;
  readonly rawOutput: string;
  readonly replayed: boolean;
  readonly winningsCredited: boolean;
}

export type TicketVerificationResultServiceErrorCode =
  | "ticket_not_found"
  | "request_not_found"
  | "replay_conflict";

export class TicketVerificationResultServiceError extends Error {
  readonly code: TicketVerificationResultServiceErrorCode;

  constructor(
    message: string,
    options: {
      readonly code: TicketVerificationResultServiceErrorCode;
    }
  ) {
    super(message);
    this.name = "TicketVerificationResultServiceError";
    this.code = options.code;
  }
}

export class TicketVerificationResultService {
  private readonly ticketStore: TicketStore;
  private readonly purchaseRequestStore: PurchaseRequestStore;
  private readonly walletLedgerService: WalletLedgerService;
  private readonly timeSource: TimeSource;

  constructor(dependencies: TicketVerificationResultServiceDependencies) {
    this.ticketStore = dependencies.ticketStore;
    this.purchaseRequestStore = dependencies.purchaseRequestStore;
    this.walletLedgerService = dependencies.walletLedgerService;
    this.timeSource = dependencies.timeSource;
  }

  async recordVerificationResult(
    input: RecordTicketVerificationResultInput
  ): Promise<RecordTicketVerificationResultResult> {
    const ticketId = requireNonEmpty(input.ticketId, "ticketId");
    const verificationEventId = requireNonEmpty(input.verificationEventId, "verificationEventId");
    const rawOutput = requireNonEmpty(input.rawOutput, "rawOutput");
    const normalizedOutcome = normalizeOutcome(input.terminalStatus, input.winningAmountMinor);

    const existingTicket = await this.ticketStore.getTicketById(ticketId);
    if (!existingTicket) {
      throw new TicketVerificationResultServiceError(`ticket "${ticketId}" not found`, {
        code: "ticket_not_found"
      });
    }

    const isReplay = existingTicket.lastVerificationEventId === verificationEventId;
    const updatedTicket = isReplay
      ? assertReplayMatches(existingTicket, normalizedOutcome, rawOutput)
      : applyTicketVerificationOutcome(existingTicket, {
          verificationStatus: normalizedOutcome.verificationStatus,
          verificationEventId,
          verifiedAt: input.verifiedAt ?? this.timeSource.nowIso(),
          rawTerminalOutput: rawOutput,
          winningAmountMinor: normalizedOutcome.winningAmountMinor
        });

    const credited = await this.creditWinningsIfNeeded(updatedTicket, verificationEventId);

    if (!isReplay) {
      await this.ticketStore.saveTicket(updatedTicket);
    }

    return {
      ticket: updatedTicket,
      verificationStatus: updatedTicket.verificationStatus,
      winningAmountMinor: updatedTicket.winningAmountMinor,
      rawOutput: updatedTicket.verificationRawOutput ?? rawOutput,
      replayed: isReplay,
      winningsCredited: credited
    };
  }

  private async creditWinningsIfNeeded(ticket: TicketRecord, verificationEventId: string): Promise<boolean> {
    if (ticket.verificationStatus !== "verified") {
      return false;
    }

    const winningAmountMinor = ticket.winningAmountMinor ?? 0;
    if (winningAmountMinor <= 0) {
      return false;
    }

    const request = await this.purchaseRequestStore.getRequestById(ticket.requestId);
    if (!request) {
      throw new TicketVerificationResultServiceError(
        `request "${ticket.requestId}" not found for ticket "${ticket.ticketId}"`,
        {
          code: "request_not_found"
        }
      );
    }

    const credit = await this.walletLedgerService.creditWinnings({
      userId: ticket.userId,
      requestId: ticket.requestId,
      ticketId: ticket.ticketId,
      verificationEventId,
      drawId: ticket.drawId,
      amountMinor: winningAmountMinor,
      currency: request.snapshot.currency
    });

    return !credit.replayed;
  }
}

function normalizeOutcome(
  terminalStatus: RecordTicketVerificationResultInput["terminalStatus"],
  winningAmountMinor: number
): {
  readonly verificationStatus: "verified" | "failed";
  readonly winningAmountMinor: number | null;
} {
  if (!Number.isInteger(winningAmountMinor) || winningAmountMinor < 0) {
    throw new TicketVerificationResultServiceError("winningAmountMinor must be a non-negative integer", {
      code: "replay_conflict"
    });
  }

  if (terminalStatus === "win") {
    return {
      verificationStatus: "verified",
      winningAmountMinor
    };
  }

  if (terminalStatus === "lose") {
    return {
      verificationStatus: "verified",
      winningAmountMinor: 0
    };
  }

  return {
    verificationStatus: "failed",
    winningAmountMinor: null
  };
}

function assertReplayMatches(
  ticket: TicketRecord,
  outcome: {
    readonly verificationStatus: "verified" | "failed";
    readonly winningAmountMinor: number | null;
  },
  rawOutput: string
): TicketRecord {
  const sameStatus = ticket.verificationStatus === outcome.verificationStatus;
  const sameWinning = (ticket.winningAmountMinor ?? null) === (outcome.winningAmountMinor ?? null);
  const sameRawOutput = (ticket.verificationRawOutput ?? "") === rawOutput;

  if (sameStatus && sameWinning && sameRawOutput) {
    return {
      ...ticket
    };
  }

  throw new TicketVerificationResultServiceError(
    `verification replay for ticket "${ticket.ticketId}" has conflicting payload`,
    {
      code: "replay_conflict"
    }
  );
}

function requireNonEmpty(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new TicketVerificationResultServiceError(`${field} is required`, {
      code: "replay_conflict"
    });
  }

  return normalized;
}
