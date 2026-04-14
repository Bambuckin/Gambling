import { isBig8PurchaseDraftPayload, validateBig8PurchaseDraft } from "@lottery/domain";
import type {
  LotteryPurchaseContext,
  LotteryPurchaseHandlerContract,
  LotteryPurchaseResult
} from "@lottery/lottery-handlers";

const DEFAULT_MOCK_LATENCY_MS = 250;

export interface Big8MockTerminalHandlerOptions {
  readonly latencyMs?: number;
}

export class Big8MockTerminalHandler implements LotteryPurchaseHandlerContract {
  readonly contractVersion = "v1" as const;
  readonly lotteryCode = "bolshaya-8";
  readonly bindingKey = "bolshaya-8-terminal-handler-v1";

  private readonly latencyMs: number;

  constructor(options: Big8MockTerminalHandlerOptions = {}) {
    const parsedLatency = Math.trunc(options.latencyMs ?? DEFAULT_MOCK_LATENCY_MS);
    this.latencyMs = Number.isFinite(parsedLatency) ? Math.max(0, parsedLatency) : DEFAULT_MOCK_LATENCY_MS;
  }

  async purchase(context: LotteryPurchaseContext): Promise<LotteryPurchaseResult> {
    const validated = validateBig8PurchaseDraft(context.ticketPayload);
    if (!validated.ok || !isBig8PurchaseDraftPayload(validated.payload)) {
      const reason = validated.ok
        ? "payload does not match big8 schema"
        : validated.errors.map((error) => `${error.fieldKey}:${error.reason}`).join(",");
      throw new Error(`invalid big8 payload for mock terminal: ${reason}`);
    }

    if (this.latencyMs > 0) {
      await sleep(this.latencyMs);
    }

    const payload = validated.payload;
    const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
    const maskedPhone = maskPhone(payload.contactPhone);
    const receiverLabel = readReceiverLabel();

    return {
      executionOutcome: "added_to_cart",
      externalTicketReference: null,
      rawTerminalOutput: [
        "[big8-mock-terminal]",
        `receiver=${receiverLabel}`,
        `request=${context.requestId}`,
        `draw=${context.draw.drawId}`,
        `attempt=${context.attempt}`,
        `tickets=${payload.tickets.length}`,
        `phone=${maskedPhone}`,
        `payload_base64=${encodedPayload}`
      ].join(" ")
    };
  }
}

async function sleep(durationMs: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, durationMs));
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 4) {
    return digits;
  }
  return `***${digits.slice(-4)}`;
}

function readReceiverLabel(): string {
  const rawValue = process.env.LOTTERY_TERMINAL_RECEIVER_LABEL ?? process.env.COMPUTERNAME ?? "terminal-receiver";
  const normalized = rawValue.trim();
  if (normalized.length === 0) {
    return "terminal-receiver";
  }

  return normalized.replace(/\s+/g, "_");
}
