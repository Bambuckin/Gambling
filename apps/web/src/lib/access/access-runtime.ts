import type { AccessIdentity, AccessIdentityStatus, SessionRole } from "@lottery/domain";
import { normalizeIdentityLogin, normalizeIdentityPhone } from "@lottery/domain";
import {
  AccessService,
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
  hashAccessPassword
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

interface AccessIdentitySeed {
  readonly identityId: string;
  readonly login: string;
  readonly password: string;
  readonly role: SessionRole;
  readonly status?: AccessIdentityStatus;
  readonly displayName?: string;
  readonly phone: string;
}

let runtimeFactory: AccessRuntimeFactory = createDefaultAccessRuntimeFactory();
let cachedService: AccessService | null = null;

export function configureAccessRuntime(nextFactory: AccessRuntimeFactory): void {
  runtimeFactory = nextFactory;
  cachedService = null;
}

export function getAccessService(): AccessService {
  if (!cachedService) {
    cachedService = new AccessService(runtimeFactory.createDependencies());
  }

  return cachedService;
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

  return seeds.map((seed) => ({
    identityId: seed.identityId,
    login: normalizeIdentityLogin(seed.login),
    passwordHash: hashAccessPassword(seed.password),
    role: seed.role,
    status: seed.status ?? "active",
    displayName: seed.displayName ?? seed.login,
    phone: normalizeIdentityPhone(seed.phone),
    createdAt: nowIso,
    updatedAt: nowIso
  }));
}

function readIdentitySeeds(): AccessIdentitySeed[] {
  const envValue = process.env.LOTTERY_ACCESS_IDENTITIES_JSON;
  if (!envValue) {
    return defaultIdentitySeeds();
  }

  try {
    const parsed = JSON.parse(envValue) as unknown;
    if (!Array.isArray(parsed)) {
      return defaultIdentitySeeds();
    }

    const seeds = parsed
      .map((entry) => sanitizeIdentitySeed(entry))
      .filter((entry): entry is AccessIdentitySeed => entry !== null);

    return seeds.length > 0 ? seeds : defaultIdentitySeeds();
  } catch {
    return defaultIdentitySeeds();
  }
}

function sanitizeIdentitySeed(input: unknown): AccessIdentitySeed | null {
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

function defaultIdentitySeeds(): AccessIdentitySeed[] {
  return [
    {
      identityId: "seed-user",
      login: "operator",
      password: "operator",
      role: "user",
      status: "active",
      displayName: "Operator User",
      phone: "79990000001"
    },
    {
      identityId: "seed-admin",
      login: "admin",
      password: "admin",
      role: "admin",
      status: "active",
      displayName: "Administrator",
      phone: "79990000002"
    },
    {
      identityId: "seed-tester",
      login: "tester",
      password: "tester",
      role: "user",
      status: "active",
      displayName: "Tester User",
      phone: "79990000003"
    }
  ];
}
