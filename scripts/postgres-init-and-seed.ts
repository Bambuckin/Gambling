import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  createDefaultLedgerEntries,
  hashAccessPassword,
  listDefaultIdentitySeeds,
  selectSeedDrawSnapshots
} from "@lottery/infrastructure";
import {
  createDefaultDrawSnapshots,
  createDefaultLotteryRegistryEntries,
  getPostgresPool,
  initializeLotteryPostgresSchema,
  PostgresDrawStore,
  PostgresIdentityStore,
  PostgresLedgerStore,
  PostgresLotteryRegistryStore,
  readPostgresConnectionStringFromEnv
} from "@lottery/infrastructure";
import type { AccessIdentity, DrawSnapshot, LedgerEntry, LotteryRegistryEntry } from "@lottery/domain";
import { buildIdentityFromSeed } from "@lottery/domain";

interface CliOptions {
  readonly seedMode: "if-empty" | "force" | "skip";
  readonly resetRuntime: boolean;
}

async function main(): Promise<void> {
  loadLocalEnvFile(".env");
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
  const seedDrawSnapshots = selectSeedDrawSnapshots(drawSnapshots, defaultDrawSnapshots());
  if (seedDrawSnapshots.length > 0) {
    for (const snapshot of seedDrawSnapshots) {
      await drawStore.upsertSnapshot(snapshot);
    }
    console.log("[bootstrap] seeded draw snapshots");
  } else {
    console.log(`[bootstrap] draw snapshots already present (${drawSnapshots.length})`);
  }

  const ledgerEntries = await ledgerStore.listEntries();
  const existingLedgerKeys = new Set(ledgerEntries.map((entry) => entry.idempotencyKey));
  const missingLedgerEntries = defaultLedgerEntries().filter((entry) => !existingLedgerKeys.has(entry.idempotencyKey));
  if (missingLedgerEntries.length > 0) {
    for (const entry of missingLedgerEntries) {
      await ledgerStore.appendEntry(entry);
    }
    console.log(`[bootstrap] ensured ledger entries (${missingLedgerEntries.length} added)`);
  } else {
    console.log(`[bootstrap] ledger entries already present (${ledgerEntries.length})`);
  }

  console.log("[bootstrap] completed");
}

function loadLocalEnvFile(envPath: string): void {
  const absoluteEnvPath = resolve(envPath);
  if (!existsSync(absoluteEnvPath)) {
    return;
  }

  const envFromFile = parseEnvFile(readFileSync(absoluteEnvPath, "utf8"));
  for (const [key, value] of Object.entries(envFromFile)) {
    const currentValue = process.env[key]?.trim();
    if (currentValue) {
      continue;
    }
    process.env[key] = value;
  }
}

function parseEnvFile(contents: string): Record<string, string> {
  const output: Record<string, string> = {};

  for (const rawLine of contents.split(/\r?\n/g)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1);
    if (!key) {
      continue;
    }

    output[key] = value;
  }

  return output;
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
    delete from lottery_operations_audit_events;
    delete from lottery_access_audit_events;
    delete from lottery_notifications;
    delete from lottery_draw_closures;
    delete from lottery_cash_desk_requests;
    delete from lottery_winnings_credit_jobs;
    delete from lottery_ticket_verification_jobs;
    delete from lottery_tickets;
    delete from lottery_purchase_queue_items;
    delete from lottery_purchase_requests;
    delete from lottery_sessions;
  `);
}

function defaultIdentities(): readonly AccessIdentity[] {
  const nowIso = new Date().toISOString();
  return listDefaultIdentitySeeds().map((seed) =>
    buildIdentityFromSeed(seed, hashAccessPassword(seed.password), nowIso)
  );
}

function defaultRegistryEntries(): readonly LotteryRegistryEntry[] {
  return createDefaultLotteryRegistryEntries();
}

function defaultDrawSnapshots(): readonly DrawSnapshot[] {
  return createDefaultDrawSnapshots(new Date());
}

function defaultLedgerEntries(): readonly LedgerEntry[] {
  return createDefaultLedgerEntries(new Date());
}

void main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(`[bootstrap] failed: ${message}`);
  process.exitCode = 1;
});
