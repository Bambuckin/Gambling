import type { DrawSnapshot, LotteryRegistryEntry } from "@lottery/domain";

export interface LotteryPurchaseContext {
  readonly requestId: string;
  readonly lotteryCode: LotteryRegistryEntry["lotteryCode"];
  readonly draw: DrawSnapshot;
  readonly ticketPayload: unknown;
  readonly attempt: number;
}

export interface LotteryPurchaseResult {
  readonly externalTicketReference: string;
  readonly rawTerminalOutput: string;
}

export interface LotteryResultContext {
  readonly lotteryCode: LotteryRegistryEntry["lotteryCode"];
  readonly externalTicketReference: string;
  readonly drawId: string;
}

export interface LotteryResultCheck {
  readonly status: "win" | "lose" | "pending" | "error";
  readonly winningAmountMinor: number;
  readonly rawTerminalOutput: string;
}

export interface LotteryPurchaseHandlerContract {
  readonly contractVersion: "v1";
  readonly lotteryCode: LotteryRegistryEntry["lotteryCode"];
  readonly bindingKey: string;
  purchase(context: LotteryPurchaseContext): Promise<LotteryPurchaseResult>;
}

export interface LotteryResultHandlerContract {
  readonly contractVersion: "v1";
  readonly lotteryCode: LotteryRegistryEntry["lotteryCode"];
  readonly bindingKey: string;
  verify(context: LotteryResultContext): Promise<LotteryResultCheck>;
}
