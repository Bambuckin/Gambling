import { isBig8PurchaseDraftPayload, type Big8PurchaseDraftPayload, type PurchaseRequestRecord } from "@lottery/domain";
import { getPurchaseRuntimeStores } from "./purchase-runtime";

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
  const normalizedLimit = Number.isFinite(limit) ? Math.max(1, Math.trunc(limit)) : DEFAULT_LIMIT;
  const { requestStore } = getPurchaseRuntimeStores();
  const records = await requestStore.listRequests();

  return records
    .filter((record) => record.snapshot.lotteryCode === "bolshaya-8")
    .map(toInboxRow)
    .filter((row) => row.state !== "awaiting_confirmation" && row.state !== "confirmed" && row.state !== "canceled")
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, normalizedLimit);
}

function toInboxRow(record: PurchaseRequestRecord): MockTerminalInboxRow {
  const reversedJournal = [...record.journal].reverse();
  const latestEntry = reversedJournal[0] ?? null;
  const reservedEntry =
    reversedJournal.find(
      (entry) => entry.toState === "executing" && (entry.note ?? "").includes("terminal execution reserved")
    ) ?? null;
  const latestAttemptEntry = reversedJournal.find((entry) => (entry.note ?? "").includes("terminal_attempt")) ?? null;

  const payloadFromSnapshot = isBig8PurchaseDraftPayload(record.snapshot.payload) ? record.snapshot.payload : null;
  const rawOutput = latestAttemptEntry ? extractRawOutput(latestAttemptEntry.note ?? "") : null;
  const payloadFromRawOutput = rawOutput ? decodePayloadFromRawOutput(rawOutput) : null;
  const resolvedPayload = payloadFromRawOutput ?? payloadFromSnapshot;

  return {
    requestId: record.snapshot.requestId,
    userId: record.snapshot.userId,
    drawId: record.snapshot.drawId,
    state: record.state,
    createdAt: record.snapshot.createdAt,
    updatedAt: latestEntry?.occurredAt ?? record.snapshot.createdAt,
    reservedAt: reservedEntry?.occurredAt ?? null,
    attemptCount: record.journal.filter((entry) => (entry.note ?? "").includes("terminal_attempt")).length,
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

function extractRawOutput(note: string): string | null {
  const marker = "rawOutput=";
  const position = note.indexOf(marker);
  if (position < 0) {
    return null;
  }

  const value = note.slice(position + marker.length).trim();
  return value.length > 0 ? value : null;
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
