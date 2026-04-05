import type { DomainEnvelope } from "@lottery/domain";

export interface UseCaseResult {
  readonly ok: boolean;
  readonly message: string;
}

export function wrapUseCasePayload<T>(payload: T): DomainEnvelope<T> {
  return {
    id: "pending-id",
    createdAt: new Date(0).toISOString(),
    payload
  };
}
