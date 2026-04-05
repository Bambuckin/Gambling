import type { RequestState } from "@lottery/domain";

export interface TerminalExecutionRequest {
  readonly requestId: string;
  readonly lotteryCode: string;
  readonly attempt: number;
  readonly payload: unknown;
}

export interface TerminalExecutionResult {
  readonly requestId: string;
  readonly nextState: Extract<RequestState, "success" | "retrying" | "error">;
  readonly rawOutput: string;
  readonly externalTicketReference?: string | null;
  readonly finishedAt: string;
}

export interface TerminalExecutor {
  execute(request: TerminalExecutionRequest): Promise<TerminalExecutionResult>;
}
