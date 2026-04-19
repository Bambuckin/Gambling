import { describe, expect, it } from "vitest";
import { applyIdentityFieldUpdate, type AccessIdentity } from "../access.js";

function createBaseIdentity(overrides: Partial<AccessIdentity> = {}): AccessIdentity {
  return {
    identityId: "id-1",
    login: "user1",
    passwordHash: "hash123",
    role: "user",
    status: "active",
    displayName: "User One",
    phone: "79001234567",
    createdAt: "2026-04-01T10:00:00.000Z",
    updatedAt: "2026-04-01T10:00:00.000Z",
    ...overrides
  };
}

describe("access domain", () => {
  it("applies partial field update preserving unchanged fields", () => {
    const base = createBaseIdentity();
    const updated = applyIdentityFieldUpdate(base, { displayName: "New Name" }, "2026-04-10T12:00:00.000Z");

    expect(updated.displayName).toBe("New Name");
    expect(updated.login).toBe("user1");
    expect(updated.role).toBe("user");
    expect(updated.status).toBe("active");
    expect(updated.updatedAt).toBe("2026-04-10T12:00:00.000Z");
  });

  it("normalizes login on update", () => {
    const base = createBaseIdentity();
    const updated = applyIdentityFieldUpdate(base, { login: "  USER2  " }, "2026-04-10T12:00:00.000Z");

    expect(updated.login).toBe("user2");
  });

  it("normalizes phone on update", () => {
    const base = createBaseIdentity();
    const updated = applyIdentityFieldUpdate(base, { phone: "89001234567" }, "2026-04-10T12:00:00.000Z");

    expect(updated.phone).toBe("79001234567");
  });

  it("updates role and status", () => {
    const base = createBaseIdentity();
    const updated = applyIdentityFieldUpdate(
      base,
      { role: "admin", status: "disabled" },
      "2026-04-10T12:00:00.000Z"
    );

    expect(updated.role).toBe("admin");
    expect(updated.status).toBe("disabled");
  });

  it("updates passwordHash", () => {
    const base = createBaseIdentity();
    const updated = applyIdentityFieldUpdate(base, { passwordHash: "newhash" }, "2026-04-10T12:00:00.000Z");

    expect(updated.passwordHash).toBe("newhash");
  });

  it("preserves identityId and createdAt", () => {
    const base = createBaseIdentity();
    const updated = applyIdentityFieldUpdate(base, { displayName: "X" }, "2026-04-10T12:00:00.000Z");

    expect(updated.identityId).toBe("id-1");
    expect(updated.createdAt).toBe("2026-04-01T10:00:00.000Z");
  });

  it("allows setting displayName to empty string", () => {
    const base = createBaseIdentity();
    const updated = applyIdentityFieldUpdate(base, { displayName: "" }, "2026-04-10T12:00:00.000Z");

    expect(updated.displayName).toBe("");
  });
});
