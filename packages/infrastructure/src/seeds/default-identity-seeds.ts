import type { DemoIdentitySeed, LedgerEntry } from "@lottery/domain";

export interface DemoIdentityLedgerSeed {
  readonly identityId: string;
  readonly entryId: string;
  readonly amountMinor: number;
  readonly idempotencyKey: string;
}

const DEFAULT_IDENTITY_SEEDS: readonly DemoIdentitySeed[] = [
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
  },
  {
    identityId: "seed-cashier-1",
    login: "cashier1",
    password: "cashier1",
    role: "user",
    status: "active",
    displayName: "Cashier 1",
    phone: "79990000004"
  },
  {
    identityId: "seed-cashier-2",
    login: "cashier2",
    password: "cashier2",
    role: "user",
    status: "active",
    displayName: "Cashier 2",
    phone: "79990000005"
  }
];

const DEFAULT_LEDGER_SEEDS: readonly DemoIdentityLedgerSeed[] = [
  { identityId: "seed-user", entryId: "seed-user-credit", amountMinor: 220_000, idempotencyKey: "seed-user-credit" },
  { identityId: "seed-admin", entryId: "seed-admin-credit", amountMinor: 220_000, idempotencyKey: "seed-admin-credit" },
  { identityId: "seed-tester", entryId: "seed-tester-credit", amountMinor: 220_000, idempotencyKey: "seed-tester-credit" },
  { identityId: "seed-cashier-1", entryId: "seed-cashier-1-credit", amountMinor: 220_000, idempotencyKey: "seed-cashier-1-credit" },
  { identityId: "seed-cashier-2", entryId: "seed-cashier-2-credit", amountMinor: 220_000, idempotencyKey: "seed-cashier-2-credit" }
];

export function listDefaultIdentitySeeds(): readonly DemoIdentitySeed[] {
  return DEFAULT_IDENTITY_SEEDS;
}

export function listDefaultLedgerSeeds(): readonly DemoIdentityLedgerSeed[] {
  return DEFAULT_LEDGER_SEEDS;
}

export function createDefaultLedgerEntries(now: Date = new Date()): readonly LedgerEntry[] {
  const nowTime = now.getTime();
  const creditSeeds = listDefaultLedgerSeeds();

  const creditEntries = creditSeeds.map((seed, index): LedgerEntry => ({
    entryId: seed.entryId,
    userId: seed.identityId,
    operation: "credit",
    amountMinor: seed.amountMinor,
    currency: "RUB",
    idempotencyKey: seed.idempotencyKey,
    reference: {
      requestId: seed.idempotencyKey
    },
    createdAt: new Date(nowTime - (creditSeeds.length - index + 1) * 60 * 1000).toISOString()
  }));

  return [
    ...creditEntries,
    {
      entryId: "seed-tester-reserve",
      userId: "seed-tester",
      operation: "reserve",
      amountMinor: 20_000,
      currency: "RUB",
      idempotencyKey: "seed-tester-reserve",
      reference: {
        requestId: "seed-tester-reserve"
      },
      createdAt: new Date(nowTime - 60 * 1000).toISOString()
    }
  ];
}

export function isUserSeed(seed: DemoIdentitySeed): boolean {
  return seed.role === "user";
}

export function isAdminSeed(seed: DemoIdentitySeed): boolean {
  return seed.role === "admin";
}
