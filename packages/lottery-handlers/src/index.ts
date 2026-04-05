export interface LotteryPurchaseHandler {
  readonly lotteryCode: string;
  purchase(ticketPayload: unknown): Promise<{ externalReference: string }>;
}

export interface LotteryResultHandler {
  readonly lotteryCode: string;
  verify(ticketReference: string): Promise<{ status: "win" | "lose" | "pending" }>;
}
