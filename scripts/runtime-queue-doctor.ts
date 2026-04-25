import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getPostgresPool } from "../packages/infrastructure/src/postgres/postgres-client.js";
import { createTerminalExecutionAdvisoryKey } from "../packages/infrastructure/src/postgres/postgres-purchase-store.js";
import { readLotteryStorageBackendFromEnv } from "../packages/infrastructure/src/postgres/storage-backend.js";

interface CliOptions {
  readonly envPath: string;
}

async function main(): Promise<void> {
  const options = readCliOptions(process.argv.slice(2));
  const envFilePath = resolve(options.envPath);
  const envFromFile = existsSync(envFilePath) ? parseEnvFile(readFileSync(envFilePath, "utf8")) : {};
  for (const [key, value] of Object.entries(envFromFile)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }

  const storageBackend = readLotteryStorageBackendFromEnv();
  const workerMode = (process.env.LOTTERY_BIG8_TERMINAL_MODE ?? "mock").trim().toLowerCase();
  console.log(
    `[queue-doctor] backend=${storageBackend} workerMode=${workerMode} env=${existsSync(envFilePath) ? envFilePath : "missing"}`
  );

  if (storageBackend !== "postgres") {
    console.log("[queue-doctor] persistent queue inspection skipped: backend is not postgres");
    return;
  }

  const connectionString = (process.env.LOTTERY_POSTGRES_URL ?? process.env.DATABASE_URL ?? "").trim();
  if (!connectionString) {
    throw new Error("LOTTERY_POSTGRES_URL or DATABASE_URL is required for queue doctor");
  }

  const pool = getPostgresPool(connectionString);
  const executionLockKey = createTerminalExecutionAdvisoryKey("main-terminal");
  try {
    const [queueCounts, requestCounts, advisoryLockRows, oldestQueued] = await Promise.all([
      pool.query(`
        select
          count(*) filter (where status = 'queued')::int as queued_count,
          count(*) filter (where status = 'executing')::int as executing_count
        from lottery_purchase_queue_items
      `),
      pool.query(`
        select
          count(*) filter (where state = 'queued')::int as queued_requests,
          count(*) filter (where state = 'executing')::int as executing_requests,
          count(*) filter (where state = 'success')::int as success_requests,
          count(*) filter (where state = 'error')::int as error_requests
        from lottery_purchase_requests
      `),
      pool.query(
        `
          select
            l.pid,
            a.application_name,
            a.state,
            a.backend_start,
            a.query_start
          from pg_locks l
          join pg_stat_activity a on a.pid = l.pid
          where l.locktype = 'advisory'
            and l.classid = $1
            and l.objid = $2
            and l.objsubid = 2
          order by a.backend_start desc
        `,
        [executionLockKey.classId, executionLockKey.objectId]
      ),
      pool.query(`
        select request_id, status, enqueued_at
        from lottery_purchase_queue_items
        where status = 'queued'
        order by enqueued_at asc, request_id asc
        limit 5
      `)
    ]);

    const queue = queueCounts.rows[0] ?? {};
    const requests = requestCounts.rows[0] ?? {};
    console.log(
      JSON.stringify(
        {
          queue,
          requests,
          advisoryLocks: advisoryLockRows.rows,
          oldestQueued: oldestQueued.rows
        },
        null,
        2
      )
    );

    const queuedCount = Number(queue.queued_count ?? 0);
    const executingCount = Number(queue.executing_count ?? 0);
    if (queuedCount > 0 && executingCount === 0 && advisoryLockRows.rows.length === 0) {
      console.log(
        "[queue-doctor] suspicious state: queued requests exist but no executing queue item and no advisory lock holder"
      );
    }
  } finally {
    await pool.end();
  }
}

function readCliOptions(args: readonly string[]): CliOptions {
  let envPath = ".env";

  for (const rawArg of args) {
    const arg = rawArg.trim();
    if (arg.startsWith("--env=")) {
      envPath = arg.slice("--env=".length).trim();
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return { envPath };
}

function parseEnvFile(contents: string): Record<string, string> {
  const output: Record<string, string> = {};

  for (const rawLine of contents.split(/\r?\n/g)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
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

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
