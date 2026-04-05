export interface TerminalExecutionPort {
  execute(requestId: string): Promise<void>;
}

export interface QueuePort {
  enqueue(requestId: string): Promise<void>;
}

export const infrastructureScaffoldVersion = "phase-01-plan-02";
