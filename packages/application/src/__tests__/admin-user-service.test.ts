import { describe, expect, it } from "vitest";
import { AdminUserService } from "../services/admin-user-service.js";
import type { AccessIdentity } from "@lottery/domain";

function createIdentity(overrides: Partial<AccessIdentity> = {}): AccessIdentity {
  return {
    identityId: overrides.identityId ?? "id-1",
    login: overrides.login ?? "user1",
    passwordHash: overrides.passwordHash ?? "hash123",
    role: overrides.role ?? "user",
    status: overrides.status ?? "active",
    displayName: overrides.displayName ?? "User One",
    phone: overrides.phone ?? "79001234567",
    createdAt: overrides.createdAt ?? "2026-04-01T10:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-04-01T10:00:00.000Z"
  };
}

function createTestEnv() {
  const identities = new Map<string, AccessIdentity>();
  const identitiesByLogin = new Map<string, AccessIdentity>();

  const seed = [
    createIdentity({ identityId: "id-1", login: "user1", role: "user" }),
    createIdentity({ identityId: "id-2", login: "admin1", role: "admin" })
  ];
  for (const id of seed) {
    identities.set(id.identityId, id);
    identitiesByLogin.set(id.login, id);
  }

  const service = new AdminUserService({
    identityStore: {
      findById: async (id: string) => identities.get(id) ?? null,
      findByLogin: async (login: string) => identitiesByLogin.get(login) ?? null,
      listAll: async () => Array.from(identities.values()),
      save: async (identity: AccessIdentity) => {
        identities.set(identity.identityId, identity);
        identitiesByLogin.set(identity.login, identity);
      }
    },
    passwordVerifier: {
      verify: async (plain, hash) => plain === hash,
      hash: async (plain) => `hashed_${plain}`
    },
    timeSource: {
      nowIso: () => "2026-04-10T12:00:00.000Z"
    }
  });

  return { service, identities };
}

describe("AdminUserService", () => {
  it("lists all users", async () => {
    const { service } = createTestEnv();
    const users = await service.listUsers();
    expect(users).toHaveLength(2);
  });

  it("gets user by identityId", async () => {
    const { service } = createTestEnv();
    const user = await service.getUser("id-1");
    expect(user?.login).toBe("user1");
  });

  it("returns null for unknown user", async () => {
    const { service } = createTestEnv();
    const user = await service.getUser("unknown");
    expect(user).toBeNull();
  });

  it("updates displayName", async () => {
    const { service, identities } = createTestEnv();
    const updated = await service.updateUser({ identityId: "id-1", displayName: "New Name" });
    expect(updated.displayName).toBe("New Name");
    expect(identities.get("id-1")?.displayName).toBe("New Name");
  });

  it("updates phone with normalization", async () => {
    const { service } = createTestEnv();
    const updated = await service.updateUser({ identityId: "id-1", phone: "89001112233" });
    expect(updated.phone).toBe("79001112233");
  });

  it("updates role", async () => {
    const { service } = createTestEnv();
    const updated = await service.updateUser({ identityId: "id-1", role: "admin" });
    expect(updated.role).toBe("admin");
  });

  it("blocks user by setting status to disabled", async () => {
    const { service } = createTestEnv();
    const updated = await service.updateUser({ identityId: "id-1", status: "disabled" });
    expect(updated.status).toBe("disabled");
  });

  it("unblocks user by setting status to active", async () => {
    const { service, identities } = createTestEnv();
    identities.set("id-1", { ...identities.get("id-1")!, status: "disabled" });
    const updated = await service.updateUser({ identityId: "id-1", status: "active" });
    expect(updated.status).toBe("active");
  });

  it("changes password via hash", async () => {
    const { service, identities } = createTestEnv();
    const updated = await service.updateUser({ identityId: "id-1", password: "newpass" });
    expect(updated.passwordHash).toBe("hashed_newpass");
    expect(identities.get("id-1")?.passwordHash).toBe("hashed_newpass");
  });

  it("rejects unknown identityId", async () => {
    const { service } = createTestEnv();
    await expect(service.updateUser({ identityId: "unknown", displayName: "X" })).rejects.toThrow("not found");
  });

  it("rejects login that is already taken by another user", async () => {
    const { service } = createTestEnv();
    await expect(service.updateUser({ identityId: "id-1", login: "admin1" })).rejects.toThrow("already taken");
  });

  it("allows login update to same login", async () => {
    const { service } = createTestEnv();
    const updated = await service.updateUser({ identityId: "id-1", login: "user1" });
    expect(updated.login).toBe("user1");
  });
});
