export const CASH_DESK_STATUSES = ["pending", "paid"] as const;
export type CashDeskStatus = (typeof CASH_DESK_STATUSES)[number];

export interface CashDeskRequest {
  readonly cashDeskRequestId: string;
  readonly requestId: string;
  readonly purchaseId: string;
  readonly ticketId: string;
  readonly userId: string;
  readonly lotteryCode: string;
  readonly drawId: string;
  readonly winningAmountMinor: number;
  readonly currency: string;
  readonly status: CashDeskStatus;
  readonly createdAt: string;
  readonly paidAt: string | null;
  readonly paidBy: string | null;
}

export function createCashDeskRequest(input: {
  readonly cashDeskRequestId: string;
  readonly requestId: string;
  readonly purchaseId: string;
  readonly ticketId: string;
  readonly userId: string;
  readonly lotteryCode: string;
  readonly drawId: string;
  readonly winningAmountMinor: number;
  readonly currency: string;
  readonly createdAt: string;
}): CashDeskRequest {
  return {
    cashDeskRequestId: input.cashDeskRequestId.trim(),
    requestId: input.requestId.trim(),
    purchaseId: input.purchaseId.trim(),
    ticketId: input.ticketId.trim(),
    userId: input.userId.trim(),
    lotteryCode: input.lotteryCode.trim().toLowerCase(),
    drawId: input.drawId.trim(),
    winningAmountMinor: input.winningAmountMinor,
    currency: input.currency.trim().toUpperCase(),
    status: "pending",
    createdAt: input.createdAt,
    paidAt: null,
    paidBy: null
  };
}

export function payCashDeskRequest(request: CashDeskRequest, paidBy: string, paidAt: string): CashDeskRequest {
  if (request.status === "paid") {
    return { ...request };
  }

  return {
    ...request,
    status: "paid",
    paidBy: paidBy.trim(),
    paidAt
  };
}

export const WINNINGS_CREDIT_JOB_STATUSES = ["queued", "processing", "done", "error"] as const;
export type WinningsCreditJobStatus = (typeof WINNINGS_CREDIT_JOB_STATUSES)[number];

export interface WinningsCreditJob {
  readonly jobId: string;
  readonly requestId: string;
  readonly purchaseId: string;
  readonly ticketId: string;
  readonly userId: string;
  readonly drawId: string;
  readonly winningAmountMinor: number;
  readonly currency: string;
  readonly status: WinningsCreditJobStatus;
  readonly createdAt: string;
  readonly processedAt: string | null;
  readonly lastError: string | null;
}

export function createWinningsCreditJob(input: {
  readonly jobId: string;
  readonly requestId: string;
  readonly purchaseId: string;
  readonly ticketId: string;
  readonly userId: string;
  readonly drawId: string;
  readonly winningAmountMinor: number;
  readonly currency: string;
  readonly createdAt: string;
}): WinningsCreditJob {
  return {
    jobId: input.jobId.trim(),
    requestId: input.requestId.trim(),
    purchaseId: input.purchaseId.trim(),
    ticketId: input.ticketId.trim(),
    userId: input.userId.trim(),
    drawId: input.drawId.trim(),
    winningAmountMinor: input.winningAmountMinor,
    currency: input.currency.trim().toUpperCase(),
    status: "queued",
    createdAt: input.createdAt,
    processedAt: null,
    lastError: null
  };
}

export function startWinningsCreditJob(job: WinningsCreditJob): WinningsCreditJob {
  if (job.status !== "queued") {
    throw new Error(`winnings credit job "${job.jobId}" cannot start from status "${job.status}"`);
  }
  return { ...job, status: "processing" };
}

export function completeWinningsCreditJob(job: WinningsCreditJob, processedAt: string): WinningsCreditJob {
  if (job.status !== "processing") {
    throw new Error(`winnings credit job "${job.jobId}" cannot complete from status "${job.status}"`);
  }
  return { ...job, status: "done", processedAt, lastError: null };
}

export function failWinningsCreditJob(job: WinningsCreditJob, error: string, processedAt: string): WinningsCreditJob {
  if (job.status !== "processing") {
    throw new Error(`winnings credit job "${job.jobId}" cannot fail from status "${job.status}"`);
  }
  return { ...job, status: "error", processedAt, lastError: error };
}
