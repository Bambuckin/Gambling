import type {
  LotteryPurchaseContext,
  LotteryPurchaseHandlerContract,
  LotteryPurchaseResult,
  LotteryResultCheck,
  LotteryResultContext,
  LotteryResultHandlerContract
} from "@lottery/lottery-handlers";

export class FakeLotteryPurchaseHandler implements LotteryPurchaseHandlerContract {
  readonly contractVersion = "v1" as const;
  readonly lotteryCode: string;
  readonly bindingKey: string;

  constructor(lotteryCode: string, bindingKey = "fake-purchase-handler") {
    this.lotteryCode = lotteryCode;
    this.bindingKey = bindingKey;
  }

  async purchase(context: LotteryPurchaseContext): Promise<LotteryPurchaseResult> {
    return {
      externalTicketReference: `${context.lotteryCode}-${context.requestId}-stub`,
      rawTerminalOutput: `[fake-purchase] payload=${JSON.stringify(context.ticketPayload)}`
    };
  }
}

export class FakeLotteryResultHandler implements LotteryResultHandlerContract {
  readonly contractVersion = "v1" as const;
  readonly lotteryCode: string;
  readonly bindingKey: string;

  constructor(lotteryCode: string, bindingKey = "fake-result-handler") {
    this.lotteryCode = lotteryCode;
    this.bindingKey = bindingKey;
  }

  async verify(context: LotteryResultContext): Promise<LotteryResultCheck> {
    return {
      status: "lose",
      winningAmountMinor: 0,
      rawTerminalOutput: `[fake-result] ticket=${context.externalTicketReference}`
    };
  }
}
