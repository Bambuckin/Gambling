import { describe, expect, it } from "vitest";
import type { RequestState } from "../request-state.js";
import {
  applyRequestStateTransition,
  assertCancelableRequestState,
  canCancelRequestState,
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
