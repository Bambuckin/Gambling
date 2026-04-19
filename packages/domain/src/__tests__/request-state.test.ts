import { describe, expect, it } from "vitest";
import type { CanonicalPurchaseStatus, RequestState } from "../request-state.js";
import {
  applyCanonicalPurchaseStatusTransition,
  applyRequestStateTransition,
  assertCancelableRequestState,
  canCancelRequestState,
  canTransitionCanonicalPurchaseStatus,
  canTransitionRequestState
} from "../request-state.js";

describe("request state machine", () => {
  it("allows a happy path from creation to success", () => {
    let state: RequestState = "created";
    state = applyRequestStateTransition(state, "awaiting_confirmation");
    state = applyRequestStateTransition(state, "confirmed");
    state = applyRequestStateTransition(state, "queued");
    state = applyRequestStateTransition(state, "executing");
    state = applyRequestStateTransition(state, "success");

    expect(state).toBe("success");
  });

  it("allows cart stage completion without marking ticket purchase success", () => {
    let state: RequestState = "created";
    state = applyRequestStateTransition(state, "awaiting_confirmation");
    state = applyRequestStateTransition(state, "confirmed");
    state = applyRequestStateTransition(state, "queued");
    state = applyRequestStateTransition(state, "executing");
    state = applyRequestStateTransition(state, "added_to_cart");

    expect(state).toBe("added_to_cart");
    expect(canTransitionRequestState("added_to_cart", "executing").allowed).toBe(false);
  });

  it("rejects invalid transition from created directly to executing", () => {
    const check = canTransitionRequestState("created", "executing");
    expect(check.allowed).toBe(false);
    expect(() => applyRequestStateTransition("created", "executing")).toThrow(
      "transition from created to executing is not allowed"
    );
  });

  it("covers reserve release after cancellation and prevents double execution", () => {
    const cancelToRelease = canTransitionRequestState("canceled", "reserve_released");
    expect(cancelToRelease.allowed).toBe(true);

    const successToExecuting = canTransitionRequestState("success", "executing");
    expect(successToExecuting.allowed).toBe(false);
  });

  it("allows cancellation only for queued and retrying states", () => {
    expect(canCancelRequestState("queued").allowed).toBe(true);
    expect(canCancelRequestState("retrying").allowed).toBe(true);
    expect(canCancelRequestState("executing").allowed).toBe(false);
    expect(canCancelRequestState("added_to_cart").allowed).toBe(false);
    expect(() => assertCancelableRequestState("success")).toThrow(
      "request in state success cannot be canceled"
    );
  });
});

describe("canonical purchase state machine", () => {
  it("allows the additive purchase happy path through draw settlement", () => {
    let status: CanonicalPurchaseStatus = "submitted";
    status = applyCanonicalPurchaseStatusTransition(status, "queued");
    status = applyCanonicalPurchaseStatusTransition(status, "processing");
    status = applyCanonicalPurchaseStatusTransition(status, "purchased");
    status = applyCanonicalPurchaseStatusTransition(status, "awaiting_draw_close");
    status = applyCanonicalPurchaseStatusTransition(status, "settled");

    expect(status).toBe("settled");
  });

  it("allows retryable failure to re-enter the queue but blocks rewinding from purchased", () => {
    expect(canTransitionCanonicalPurchaseStatus("processing", "purchase_failed_retryable").allowed).toBe(true);
    expect(canTransitionCanonicalPurchaseStatus("purchase_failed_retryable", "queued").allowed).toBe(true);
    expect(canTransitionCanonicalPurchaseStatus("purchased", "processing").allowed).toBe(false);
  });

  it("rejects invalid canonical transition directly from submitted to purchased", () => {
    expect(canTransitionCanonicalPurchaseStatus("submitted", "purchased")).toEqual({
      allowed: false,
      reason: "transition from submitted to purchased is not allowed"
    });
    expect(() => applyCanonicalPurchaseStatusTransition("submitted", "purchased")).toThrow(
      "transition from submitted to purchased is not allowed"
    );
  });
});
