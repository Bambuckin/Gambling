import { hashAccessPassword } from "@lottery/infrastructure";
import {
  getPostgresPool,
  initializeLotteryPostgresSchema,
  PostgresDrawStore,
  PostgresIdentityStore,
  PostgresLedgerStore,
  PostgresLotteryRegistryStore,
  readPostgresConnectionStringFromEnv
} from "@lottery/infrastructure";
import type { DrawSnapshot, LedgerEntry, LotteryRegistryEntry } from "@lottery/domain";

interface CliOptions {
  readonly seedMode: "if-empty" | "force" | "skip";
  readonly resetRuntime: boolean;
}

async function main(): Promise<void> {
  const options = readCliOptions(process.argv.slice(2));
  const connectionString = readPostgresConnectionStringFromEnv();
  if (!connectionString) {
    throw new Error("Missing LOTTERY_POSTGRES_URL (or DATABASE_URL)");
  }

  const pool = getPostgresPool(connectionString);
  console.log("[bootstrap] initializing schema...");
  await initializeLotteryPostgresSchema(pool);

  if (options.resetRuntime) {
    console.log("[bootstrap] resetting runtime tables...");
    await resetRuntimeTables(pool);
  }

  if (options.seedMode === "skip") {
    console.log("[bootstrap] seed-mode=skip completed");
    return;
  }

  const identityStore = new PostgresIdentityStore(pool);
  const registryStore = new PostgresLotteryRegistryStore(pool);
  const drawStore = new PostgresDrawStore(pool);
  const ledgerStore = new PostgresLedgerStore(pool);

  if (options.seedMode === "force") {
    console.log("[bootstrap] seed-mode=force: replacing base seed data...");
    await truncateSeededTables(pool);
    await identityStore.upsertMany(defaultIdentities());
    await registryStore.saveEntries(defaultRegistryEntries());
    for (const snapshot of defaultDrawSnapshots()) {
      await drawStore.upsertSnapshot(snapshot);
    }
    for (const entry of defaultLedgerEntries()) {
      await ledgerStore.appendEntry(entry);
    }
    console.log("[bootstrap] force seed done");
    return;
  }

  console.log("[bootstrap] seed-mode=if-empty: checking tables...");

  const identityCount = await identityStore.count();
  if (identityCount === 0) {
    await identityStore.upsertMany(defaultIdentities());
    console.log("[bootstrap] seeded identities");
  } else {
    console.log(`[bootstrap] identities already present (${identityCount})`);
  }

  const registryEntries = await registryStore.listEntries();
  if (registryEntries.length === 0) {
    await registryStore.saveEntries(defaultRegistryEntries());
    console.log("[bootstrap] seeded lottery registry");
  } else {
    console.log(`[bootstrap] lottery registry already present (${registryEntries.length})`);
  }

  const drawSnapshots = await drawStore.listSnapshots();
  if (drawSnapshots.length === 0) {
    for (const snapshot of defaultDrawSnapshots()) {
      await drawStore.upsertSnapshot(snapshot);
    }
    console.log("[bootstrap] seeded draw snapshots");
  } else {
    console.log(`[bootstrap] draw snapshots already present (${drawSnapshots.length})`);
  }

  const ledgerEntries = await ledgerStore.listEntries();
  if (ledgerEntries.length === 0) {
    for (const entry of defaultLedgerEntries()) {
      await ledgerStore.appendEntry(entry);
    }
    console.log("[bootstrap] seeded ledger entries");
  } else {
    console.log(`[bootstrap] ledger entries already present (${ledgerEntries.length})`);
  }

  console.log("[bootstrap] completed");
}

function readCliOptions(args: readonly string[]): CliOptions {
  let seedMode: CliOptions["seedMode"] = "if-empty";
  let resetRuntime = false;

  for (const arg of args) {
    if (arg.startsWith("--seed-mode=")) {
      const value = arg.slice("--seed-mode=".length).trim().toLowerCase();
      if (value === "if-empty" || value === "force" || value === "skip") {
        seedMode = value;
      } else {
        throw new Error(`Unsupported seed mode: ${value}`);
      }
      continue;
    }

    if (arg === "--reset-runtime") {
      resetRuntime = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return {
    seedMode,
    resetRuntime
  };
}

async function truncateSeededTables(pool: ReturnType<typeof getPostgresPool>): Promise<void> {
  await pool.query(`
    delete from lottery_ledger_entries;
    delete from lottery_draw_snapshots;
    delete from lottery_registry_entries;
    delete from lottery_identities;
  `);
}

async function resetRuntimeTables(pool: ReturnType<typeof getPostgresPool>): Promise<void> {
  await pool.query(`
    delete from lottery_terminal_execution_locks;
    delete from lottery_operations_audit_events;
    delete from lottery_access_audit_events;
    delete from lottery_ticket_verification_jobs;
    delete from lottery_tickets;
    delete from lottery_purchase_queue_items;
    delete from lottery_purchase_requests;
    delete from lottery_sessions;
  `);
}

function defaultIdentities(): readonly {
  readonly identityId: string;
  readonly login: string;
  readonly passwordHash: string;
  readonly role: "user" | "admin";
  readonly status: "active";
  readonly displayName: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}[] {
  const nowIso = new Date().toISOString();

  return [
    {
      identityId: "seed-user",
      login: "operator",
      passwordHash: hashAccessPassword("operator"),
      role: "user",
      status: "active",
      displayName: "Operator User",
      createdAt: nowIso,
      updatedAt: nowIso
    },
    {
      identityId: "seed-admin",
      login: "admin",
      passwordHash: hashAccessPassword("admin"),
      role: "admin",
      status: "active",
      displayName: "Administrator",
      createdAt: nowIso,
      updatedAt: nowIso
    },
    {
      identityId: "seed-tester",
      login: "tester",
      passwordHash: hashAccessPassword("tester"),
      role: "user",
      status: "active",
      displayName: "Tester User",
      createdAt: nowIso,
      updatedAt: nowIso
    }
  ];
}

function defaultRegistryEntries(): readonly LotteryRegistryEntry[] {
  return [
    {
      lotteryCode: "demo-lottery",
      title: "Demo Lottery",
      enabled: true,
      displayOrder: 10,
      formSchemaVersion: "v1-demo",
      formFields: [
        {
          fieldKey: "draw_count",
          label: "Draw Count",
          type: "number",
          required: true,
          min: 1,
          max: 10,
          step: 1,
          defaultValue: 1
        },
        {
          fieldKey: "ticket_note",
          label: "Ticket Note",
          type: "text",
          required: false,
          placeholder: "Optional note"
        }
      ],
      pricing: {
        strategy: "fixed",
        baseAmountMinor: 100
      },
      handlers: {
        purchaseHandler: "handlers.demo-lottery.purchase.v1",
        resultHandler: "handlers.demo-lottery.result.v1"
      }
    },
    {
      lotteryCode: "gosloto-6x45",
      title: "Gosloto 6x45",
      enabled: true,
      displayOrder: 20,
      formSchemaVersion: "v1-gosloto",
      formFields: [
        {
          fieldKey: "draw_count",
          label: "Draw Count",
          type: "number",
          required: true,
          min: 1,
          max: 5,
          step: 1,
          defaultValue: 1
        },
        {
          fieldKey: "bet_system",
          label: "Bet System",
          type: "select",
          required: true,
          options: [
            { value: "standard", label: "Standard" },
            { value: "extended", label: "Extended" }
          ]
        }
      ],
      pricing: {
        strategy: "fixed",
        baseAmountMinor: 150
      },
      handlers: {
        purchaseHandler: "handlers.gosloto-6x45.purchase.v1",
        resultHandler: "handlers.gosloto-6x45.result.v1"
      }
    },
    {
      lotteryCode: "archive-lottery",
      title: "Archive Lottery (Disabled)",
      enabled: false,
      displayOrder: 30,
      formSchemaVersion: "v1-archive",
      formFields: [
        {
          fieldKey: "draw_count",
          label: "Draw Count",
          type: "number",
          required: true,
          min: 1,
          max: 3,
          step: 1,
          defaultValue: 1
        }
      ],
      pricing: {
        strategy: "fixed",
        baseAmountMinor: 50
      },
      handlers: {
        purchaseHandler: "handlers.archive-lottery.purchase.v1",
        resultHandler: "handlers.archive-lottery.result.v1"
      }
    }
  ];
}

function defaultDrawSnapshots(): readonly DrawSnapshot[] {
  const now = Date.now();

  return [
    {
      lotteryCode: "demo-lottery",
      drawId: "demo-draw-001",
      drawAt: new Date(now + 60 * 60 * 1000).toISOString(),
      fetchedAt: new Date(now - 10 * 60 * 1000).toISOString(),
      freshnessTtlSeconds: 60 * 60
    },
    {
      lotteryCode: "gosloto-6x45",
      drawId: "gosloto-draw-044",
      drawAt: new Date(now + 2 * 60 * 60 * 1000).toISOString(),
      fetchedAt: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
      freshnessTtlSeconds: 30 * 60
    }
  ];
}

function defaultLedgerEntries(): readonly LedgerEntry[] {
  const now = Date.now();

  return [
    {
      entryId: "seed-user-credit",
      userId: "seed-user",
      operation: "credit",
      amountMinor: 220_000,
      currency: "RUB",
      idempotencyKey: "seed-user-credit",
      reference: {
        requestId: "seed-user-credit"
      },
      createdAt: new Date(now - 4 * 60 * 1000).toISOString()
    },
    {
      entryId: "seed-admin-credit",
      userId: "seed-admin",
      operation: "credit",
      amountMinor: 500_000,
      currency: "RUB",
      idempotencyKey: "seed-admin-credit",
      reference: {
        requestId: "seed-admin-credit"
      },
      createdAt: new Date(now - 3 * 60 * 1000).toISOString()
    },
    {
      entryId: "seed-tester-credit",
      userId: "seed-tester",
      operation: "credit",
      amountMinor: 180_000,
      currency: "RUB",
      idempotencyKey: "seed-tester-credit",
      reference: {
        requestId: "seed-tester-credit"
      },
      createdAt: new Date(now - 2 * 60 * 1000).toISOString()
    },
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
      createdAt: new Date(now - 60 * 1000).toISOString()
    }
  ];
}

void main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(`[bootstrap] failed: ${message}`);
  process.exitCode = 1;
});
