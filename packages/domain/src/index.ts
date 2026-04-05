export type LotteryCode = string;

export interface DomainEnvelope<TPayload> {
  readonly id: string;
  readonly createdAt: string;
  readonly payload: TPayload;
}

export interface RequestLifecycleState {
  readonly status: "draft" | "queued" | "executing" | "completed" | "failed";
}
