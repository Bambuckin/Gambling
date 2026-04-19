export const TICKET_PURCHASE_STATES = ["purchased"] as const;
export const TICKET_VERIFICATION_STATES = ["pending", "verified", "failed"] as const;
export const TICKET_VERIFICATION_JOB_STATES = ["queued", "verifying", "done", "error"] as const;
export const TICKET_ADMIN_RESULT_MARKS = ["win", "lose"] as const;
export const TICKET_CLAIM_STATES = ["unclaimed", "credit_pending", "credited", "cash_desk_pending", "cash_desk_paid"] as const;

export type TicketPurchaseState = (typeof TICKET_PURCHASE_STATES)[number];
export type TicketVerificationState = (typeof TICKET_VERIFICATION_STATES)[number];
export type TicketVerificationJobState = (typeof TICKET_VERIFICATION_JOB_STATES)[number];
export type TicketAdminResultMark = (typeof TICKET_ADMIN_RESULT_MARKS)[number];
export type TicketClaimState = (typeof TICKET_CLAIM_STATES)[number];

// Ticket remains a compatibility read model while canonical purchase and draw
// truth are introduced alongside the current runtime contour.
export interface TicketRecord {
  readonly ticketId: string;
  readonly requestId: string;
  readonly userId: string;
  readonly lotteryCode: string;
  readonly drawId: string;
  readonly purchasedAt: string;
  readonly externalReference: string;
  readonly purchaseStatus: TicketPurchaseState;
  readonly verificationStatus: TicketVerificationState;
  readonly verificationRawOutput: string | null;
  readonly winningAmountMinor: number | null;
  readonly verifiedAt: string | null;
  readonly lastVerificationEventId: string | null;
  readonly adminResultMark: TicketAdminResultMark | null;
  readonly adminResultMarkedBy: string | null;
  readonly adminResultMarkedAt: string | null;
  readonly resultSource: "terminal" | "admin_emulated" | null;
  readonly claimState: TicketClaimState;
}

export interface CreatePurchasedTicketRecordInput {
  readonly ticketId: string;
  readonly requestId: string;
  readonly userId: string;
  readonly lotteryCode: string;
  readonly drawId: string;
  readonly purchasedAt: string;
  readonly externalReference?: string | null;
}

export interface TicketVerificationJob {
  readonly jobId: string;
  readonly ticketId: string;
  readonly requestId: string;
  readonly lotteryCode: string;
  readonly drawId: string;
  readonly externalReference: string;
  readonly enqueuedAt: string;
  readonly updatedAt: string;
  readonly status: TicketVerificationJobState;
  readonly attemptCount: number;
  readonly lastTerminalOutput: string | null;
  readonly lastError: string | null;
}

export interface CreateTicketVerificationJobInput {
  readonly ticketId: string;
  readonly requestId: string;
  readonly lotteryCode: string;
  readonly drawId: string;
  readonly externalReference: string;
  readonly enqueuedAt: string;
}

export interface ApplyTicketVerificationOutcomeInput {
  readonly verificationStatus: Extract<TicketVerificationState, "verified" | "failed">;
  readonly verificationEventId: string;
  readonly verifiedAt: string;
  readonly rawTerminalOutput: string;
  readonly winningAmountMinor?: number | null;
}

export class TicketValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TicketValidationError";
  }
}

export function createPurchasedTicketRecord(input: CreatePurchasedTicketRecordInput): TicketRecord {
  const ticketId = requireNonEmpty(input.ticketId, "ticketId");
  const requestId = requireNonEmpty(input.requestId, "requestId");
  const userId = requireNonEmpty(input.userId, "userId");
  const lotteryCode = requireNonEmpty(input.lotteryCode, "lotteryCode").toLowerCase();
  const drawId = requireNonEmpty(input.drawId, "drawId");
  const purchasedAt = requireValidIso(input.purchasedAt, "purchasedAt");
  const externalReference =
    (typeof input.externalReference === "string" ? input.externalReference.trim() : "") ||
    `${lotteryCode}-${requestId}`;

  return {
    ticketId,
    requestId,
    userId,
    lotteryCode,
    drawId,
    purchasedAt,
    externalReference,
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
  };
}

export function isTicketPendingVerification(ticket: TicketRecord): boolean {
  return ticket.purchaseStatus === "purchased" && ticket.verificationStatus === "pending";
}

export function setTicketAdminResultMark(
  ticket: TicketRecord,
  mark: TicketAdminResultMark,
  markedBy: string,
  markedAt: string
): TicketRecord {
  if (ticket.verificationStatus !== "pending") {
    throw new TicketValidationError(
      `ticket "${ticket.ticketId}" cannot be marked from verification status "${ticket.verificationStatus}"`
    );
  }

  return {
    ...ticket,
    adminResultMark: mark,
    adminResultMarkedBy: markedBy,
    adminResultMarkedAt: requireValidIso(markedAt, "markedAt")
  };
}

export function resolveTicketFromAdminMark(
  ticket: TicketRecord,
  winAmountMinor: number,
  resolvedAt: string,
  resolvedBy: string
): TicketRecord {
  if (ticket.verificationStatus !== "pending") {
    return { ...ticket };
  }

  const mark = ticket.adminResultMark ?? "lose";
  const isWin = mark === "win";
  const winningAmountMinor = isWin ? winAmountMinor : 0;

  return {
    ...ticket,
    verificationStatus: "verified",
    verificationRawOutput: `admin_emulated mark=${mark} resolvedBy=${resolvedBy}`,
    winningAmountMinor,
    verifiedAt: requireValidIso(resolvedAt, "resolvedAt"),
    lastVerificationEventId: `${ticket.ticketId}:admin-resolve`,
    resultSource: "admin_emulated"
  };
}

export function createTicketVerificationJob(input: CreateTicketVerificationJobInput): TicketVerificationJob {
  const ticketId = requireNonEmpty(input.ticketId, "ticketId");
  const requestId = requireNonEmpty(input.requestId, "requestId");
  const lotteryCode = requireNonEmpty(input.lotteryCode, "lotteryCode").toLowerCase();
  const drawId = requireNonEmpty(input.drawId, "drawId");
  const externalReference = requireNonEmpty(input.externalReference, "externalReference");
  const enqueuedAt = requireValidIso(input.enqueuedAt, "enqueuedAt");

  return {
    jobId: `${ticketId}:verify`,
    ticketId,
    requestId,
    lotteryCode,
    drawId,
    externalReference,
    enqueuedAt,
    updatedAt: enqueuedAt,
    status: "queued",
    attemptCount: 0,
    lastTerminalOutput: null,
    lastError: null
  };
}

export function reserveTicketVerificationJob(job: TicketVerificationJob, updatedAt: string): TicketVerificationJob {
  if (job.status !== "queued") {
    throw new TicketValidationError(`job "${job.jobId}" cannot be reserved from status "${job.status}"`);
  }

  return {
    ...job,
    status: "verifying",
    attemptCount: job.attemptCount + 1,
    updatedAt: requireValidIso(updatedAt, "updatedAt")
  };
}

export function completeTicketVerificationJob(
  job: TicketVerificationJob,
  input: {
    readonly updatedAt: string;
    readonly rawTerminalOutput: string;
  }
): TicketVerificationJob {
  if (job.status !== "verifying") {
    throw new TicketValidationError(`job "${job.jobId}" cannot be completed from status "${job.status}"`);
  }

  return {
    ...job,
    status: "done",
    updatedAt: requireValidIso(input.updatedAt, "updatedAt"),
    lastTerminalOutput: input.rawTerminalOutput,
    lastError: null
  };
}

export function failTicketVerificationJob(
  job: TicketVerificationJob,
  input: {
    readonly updatedAt: string;
    readonly error: string;
    readonly rawTerminalOutput?: string | null;
  }
): TicketVerificationJob {
  if (job.status !== "verifying") {
    throw new TicketValidationError(`job "${job.jobId}" cannot be failed from status "${job.status}"`);
  }

  return {
    ...job,
    status: "error",
    updatedAt: requireValidIso(input.updatedAt, "updatedAt"),
    lastTerminalOutput: input.rawTerminalOutput ?? null,
    lastError: requireNonEmpty(input.error, "error")
  };
}

export function applyTicketVerificationOutcome(
  ticket: TicketRecord,
  input: ApplyTicketVerificationOutcomeInput
): TicketRecord {
  const verificationEventId = requireNonEmpty(input.verificationEventId, "verificationEventId");
  const verifiedAt = requireValidIso(input.verifiedAt, "verifiedAt");
  const rawTerminalOutput = requireNonEmpty(input.rawTerminalOutput, "rawTerminalOutput");
  const winningAmountMinor = normalizeNonNegativeMinorOrNull(input.winningAmountMinor ?? null, "winningAmountMinor");

  if (ticket.verificationStatus !== "pending") {
    if (ticket.lastVerificationEventId === verificationEventId) {
      return {
        ...ticket
      };
    }

    throw new TicketValidationError(
      `ticket "${ticket.ticketId}" cannot apply verification from status "${ticket.verificationStatus}"`
    );
  }

  return {
    ...ticket,
    verificationStatus: input.verificationStatus,
    verificationRawOutput: rawTerminalOutput,
    winningAmountMinor: input.verificationStatus === "verified" ? winningAmountMinor ?? 0 : null,
    verifiedAt,
    lastVerificationEventId: verificationEventId
  };
}

function requireNonEmpty(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new TicketValidationError(`${field} is required`);
  }
  return normalized;
}

function requireValidIso(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized || Number.isNaN(Date.parse(normalized))) {
    throw new TicketValidationError(`${field} must be a valid ISO date string`);
  }
  return normalized;
}

function normalizeNonNegativeMinorOrNull(value: number | null, field: string): number | null {
  if (value === null) {
    return null;
  }

  if (!Number.isInteger(value) || value < 0) {
    throw new TicketValidationError(`${field} must be a non-negative integer`);
  }

  return value;
}
