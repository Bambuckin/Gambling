export interface TerminalHandlerBinding {
  readonly lotteryCode: string;
  readonly bindingKey: string;
  readonly contractVersion: "v1";
}

export interface TerminalHandlerRegistry {
  getPurchaseBinding(lotteryCode: string): Promise<TerminalHandlerBinding | null>;
}
