import type { AccessIdentity, AccessIdentityStatus, DemoIdentitySeed, SessionRole } from "@lottery/domain";
import { buildIdentityFromSeed, normalizeIdentityLogin, normalizeIdentityPhone } from "@lottery/domain";
import {
  AccessService,
  AdminUserService,
  SystemTimeSource,
  type AccessServiceDependencies,
  type IdentityStore,
  type PasswordVerifier,
  type SessionStore
} from "@lottery/application";
import {
  InMemoryIdentityStore,
  InMemoryAccessAuditLog,
  InMemorySessionStore,
  PostgresAccessAuditLog,
  PostgresIdentityStore,
  PostgresSessionStore,
  Sha256PasswordVerifier,
  hashAccessPassword,
  listDefaultIdentitySeeds
} from "@lottery/infrastructure";
import { getWebPostgresPool, getWebStorageBackend } from "../runtime/postgres-runtime";

export interface AccessRuntimeFactory {
  createDependencies(): AccessServiceDependencies;
}

export interface AccessRuntimeAdapters {
  readonly identityStore: IdentityStore;
  readonly sessionStore: SessionStore;
  readonly passwordVerifier: PasswordVerifier;
  readonly accessAuditLog: AccessServiceDependencies["accessAuditLog"];
}

let runtimeFactory: AccessRuntimeFactory = createDefaultAccessRuntimeFactory();
let cachedService: AccessService | null = null;
let cachedAdminUserService: AdminUserService | null = null;
let cachedAdapters: AccessRuntimeAdapters | null = null;

export function configureAccessRuntime(nextFactory: AccessRuntimeFactory): void {
  runtimeFactory = nextFactory;
  cachedService = null;
  cachedAdminUserService = null;
  cachedAdapters = null;
}

export function getAccessService(): AccessService {
  if (!cachedService) {
    cachedService = new AccessService(runtimeFactory.createDependencies());
  }

  return cachedService;
}

export function getAdminUserService(): AdminUserService {
  if (!cachedAdminUserService) {
    const deps = runtimeFactory.createDependencies();
    cachedAdminUserService = new AdminUserService({
      identityStore: deps.identityStore,
      passwordVerifier: deps.passwordVerifier,
      timeSource: deps.timeSource
    });
  }

  return cachedAdminUserService;
}

export function getSessionStoreInstance(): SessionStore {
  if (!cachedAdapters) {
    cachedAdapters = createDefaultAdaptersFromFactory();
  }
  return cachedAdapters.sessionStore;
}

function createDefaultAdaptersFromFactory(): AccessRuntimeAdapters {
  return createDefaultAdapters();
}

export function createDefaultAccessRuntimeFactory(): AccessRuntimeFactory {
  const adapters = createDefaultAdapters();

  return {
    createDependencies() {
      return {
        identityStore: adapters.identityStore,
        sessionStore: adapters.sessionStore,
        passwordVerifier: adapters.passwordVerifier,
        accessAuditLog: adapters.accessAuditLog,
        timeSource: new SystemTimeSource()
      };
    }
  };
}

function createDefaultAdapters(): AccessRuntimeAdapters {
  const seededIdentities = buildSeededIdentities();
  const backend = getWebStorageBackend();

  if (backend === "postgres") {
    const pool = getWebPostgresPool();

    return {
      identityStore: new PostgresIdentityStore(pool),
      sessionStore: new PostgresSessionStore(pool),
      accessAuditLog: new PostgresAccessAuditLog(pool),
      passwordVerifier: new Sha256PasswordVerifier()
    };
  }

  return {
    identityStore: new InMemoryIdentityStore(seededIdentities),
    sessionStore: new InMemorySessionStore(),
    accessAuditLog: new InMemoryAccessAuditLog(),
    passwordVerifier: new Sha256PasswordVerifier()
  };
}

function buildSeededIdentities(): AccessIdentity[] {
  const seeds = readIdentitySeeds();
  const nowIso = new Date().toISOString();

  return seeds.map((seed) =>
    buildIdentityFromSeed(seed, hashAccessPassword(seed.password), nowIso)
  );
}

function readIdentitySeeds(): DemoIdentitySeed[] {
  const envValue = process.env.LOTTERY_ACCESS_IDENTITIES_JSON;
  if (!envValue) {
    return [...listDefaultIdentitySeeds()];
  }

  try {
    const parsed = JSON.parse(envValue) as unknown;
    if (!Array.isArray(parsed)) {
      return [...listDefaultIdentitySeeds()];
    }

    const seeds = parsed
      .map((entry) => sanitizeIdentitySeed(entry))
      .filter((entry): entry is DemoIdentitySeed => entry !== null);

    return seeds.length > 0 ? seeds : [...listDefaultIdentitySeeds()];
  } catch {
    return [...listDefaultIdentitySeeds()];
  }
}

function sanitizeIdentitySeed(input: unknown): DemoIdentitySeed | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const record = input as Record<string, unknown>;
  const identityId = typeof record.identityId === "string" ? record.identityId.trim() : "";
  const login = typeof record.login === "string" ? record.login.trim() : "";
  const password = typeof record.password === "string" ? record.password : "";
  const role = record.role === "admin" ? "admin" : record.role === "user" ? "user" : null;
  const status = record.status === "disabled" ? "disabled" : record.status === "active" ? "active" : undefined;
  const displayName = typeof record.displayName === "string" ? record.displayName : undefined;
  const phone = typeof record.phone === "string" ? record.phone : "";

  if (!identityId || !login || !password || !role || !phone) {
    return null;
  }

  return {
    identityId,
    login,
    password,
    role,
    phone,
    ...(status ? { status } : {}),
    ...(displayName ? { displayName } : {})
  };
}
