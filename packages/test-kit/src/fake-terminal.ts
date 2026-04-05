import type {
  TerminalExecutionRequest,
  TerminalExecutionResult,
  TerminalExecutor
} from "@lottery/application";

export type FakeTerminalMode = "success" | "retry" | "error";

export interface FakeTerminalConfig {
  readonly mode: FakeTerminalMode;
}

export class FakeTerminalExecutor implements TerminalExecutor {
  private readonly config: FakeTerminalConfig;

  constructor(config: FakeTerminalConfig = { mode: "success" }) {
    this.config = config;
  }

  async execute(request: TerminalExecutionRequest): Promise<TerminalExecutionResult> {
    const nextState =
      this.config.mode === "success" ? "success" : this.config.mode === "retry" ? "retrying" : "error";

    return {
      requestId: request.requestId,
      nextState,
      rawOutput: `[fake-terminal:${this.config.mode}] lottery=${request.lotteryCode} attempt=${request.attempt}`,
      finishedAt: new Date().toISOString()
    };
  }
}
