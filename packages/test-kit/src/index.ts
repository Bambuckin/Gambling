export interface StubTerminalResult {
  readonly requestId: string;
  readonly status: "ok" | "error";
  readonly rawOutput: string;
}

export function createStubResult(requestId: string): StubTerminalResult {
  return {
    requestId,
    status: "ok",
    rawOutput: "stub-result"
  };
}
