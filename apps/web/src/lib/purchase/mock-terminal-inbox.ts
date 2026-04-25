import { isBig8PurchaseDraftPayload, type Big8PurchaseDraftPayload, type PurchaseDraftPayload } from "@lottery/domain";
import { getTerminalReceiverQueryService } from "./purchase-runtime";

export interface MockTerminalInboxRow {
  readonly requestId: string;
  readonly userId: string;
  readonly drawId: string;
  readonly state: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly reservedAt: string | null;
  readonly attemptCount: number;
  readonly receiverLabel: string | null;
  readonly phoneMasked: string | null;
  readonly ticketCount: number;
  readonly payload: Big8PurchaseDraftPayload | null;
  readonly workerRawOutput: string | null;
}

const DEFAULT_LIMIT = 40;

export async function listMockTerminalInboxRows(limit = DEFAULT_LIMIT): Promise<readonly MockTerminalInboxRow[]> {
  const rows = await getTerminalReceiverQueryService().listRows({
    limit,
    lotteryCode: "bolshaya-8"
  });

  return rows.map(toInboxRow);
}

function toInboxRow(row: {
  readonly requestId: string;
  readonly userId: string;
  readonly drawId: string;
  readonly state: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly reservedAt: string | null;
  readonly attemptCount: number;
  readonly payload: PurchaseDraftPayload | null;
  readonly workerRawOutput: string | null;
}): MockTerminalInboxRow {
  const payloadFromSnapshot = row.payload && isBig8PurchaseDraftPayload(row.payload) ? row.payload : null;
  const rawOutput = row.workerRawOutput;
  const payloadFromRawOutput = rawOutput ? decodePayloadFromRawOutput(rawOutput) : null;
  const resolvedPayload = payloadFromRawOutput ?? payloadFromSnapshot;

  return {
    requestId: row.requestId,
    userId: row.userId,
    drawId: row.drawId,
    state: row.state,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    reservedAt: row.reservedAt,
    attemptCount: row.attemptCount,
    receiverLabel: rawOutput ? extractRawOutputField(rawOutput, "receiver") : null,
    phoneMasked: resolvedPayload ? maskPhone(resolvedPayload.contactPhone) : null,
    ticketCount: resolvedPayload?.tickets.length ?? 0,
    payload: resolvedPayload,
    workerRawOutput: rawOutput
  };
}

function decodePayloadFromRawOutput(rawOutput: string): Big8PurchaseDraftPayload | null {
  const encodedMatch = rawOutput.match(/payload_base64=([A-Za-z0-9_-]+)/);
  if (!encodedMatch?.[1]) {
    return null;
  }

  try {
    const decoded = Buffer.from(encodedMatch[1], "base64url").toString("utf8");
    const parsed = JSON.parse(decoded);
    return isBig8PurchaseDraftPayload(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function extractRawOutputField(rawOutput: string, fieldKey: string): string | null {
  const expression = new RegExp(`(?:^|\\s)${fieldKey}=([^\\s]+)`);
  const match = rawOutput.match(expression);
  const value = match?.[1]?.trim();
  return value ? value : null;
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 4) {
    return digits;
  }

  return `***${digits.slice(-4)}`;
}
