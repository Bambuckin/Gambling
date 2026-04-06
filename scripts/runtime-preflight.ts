import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

type RuntimeRole = "all" | "web" | "worker";
type StorageBackend = "in-memory" | "postgres";

interface CliOptions {
  readonly envPath: string;
  readonly role: RuntimeRole;
}

interface PreflightIssue {
  readonly key: string;
  readonly message: string;
}

function main(): void {
  const options = readCliOptions(process.argv.slice(2));
  const envFilePath = resolve(options.envPath);
  if (!existsSync(envFilePath)) {
    throw new Error(`Env file not found: ${envFilePath}`);
  }

  const envFromFile = parseEnvFile(readFileSync(envFilePath, "utf8"));
  const env = {
    ...process.env,
    ...envFromFile
  };

  const backend = readStorageBackend(env.LOTTERY_STORAGE_BACKEND);
  const issues: PreflightIssue[] = [];

  validateRequired(issues, env, "LOTTERY_STORAGE_BACKEND");
  validateNoPlaceholder(issues, env, "LOTTERY_STORAGE_BACKEND");

  if (backend === "postgres") {
    validatePostgresConfig(issues, env);
  }

  if (options.role === "all" || options.role === "web") {
    validateWebConfig(issues, env);
  }

  if (options.role === "all" || options.role === "worker") {
    validateWorkerConfig(issues, env);
  }

  if (issues.length > 0) {
    console.error(`[preflight] failed for role=${options.role} backend=${backend}`);
    for (const issue of issues) {
      console.error(`- ${issue.key}: ${issue.message}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`[preflight] ok role=${options.role} backend=${backend}`);
  console.log(`[preflight] env source: ${envFilePath}`);
}

function readCliOptions(args: readonly string[]): CliOptions {
  let envPath = ".env";
  let role: RuntimeRole = "all";

  for (const rawArg of args) {
    const arg = rawArg.trim();
    if (arg.startsWith("--env=")) {
      envPath = arg.slice("--env=".length).trim();
      continue;
    }
    if (arg.startsWith("--role=")) {
      const value = arg.slice("--role=".length).trim().toLowerCase();
      if (value === "all" || value === "web" || value === "worker") {
        role = value;
        continue;
      }
      throw new Error(`Unsupported role: ${value}`);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return {
    envPath,
    role
  };
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

function readStorageBackend(rawValue: string | undefined): StorageBackend {
  const normalized = (rawValue ?? "in-memory").trim().toLowerCase();
  if (normalized === "postgres") {
    return "postgres";
  }
  return "in-memory";
}

function validatePostgresConfig(issues: PreflightIssue[], env: NodeJS.ProcessEnv): void {
  const connection = (env.LOTTERY_POSTGRES_URL ?? env.DATABASE_URL ?? "").trim();
  if (!connection) {
    issues.push({
      key: "LOTTERY_POSTGRES_URL",
      message: "missing connection string (or DATABASE_URL)"
    });
    return;
  }

  if (isPlaceholder(connection)) {
    issues.push({
      key: "LOTTERY_POSTGRES_URL",
      message: "contains placeholder markers (<...>)"
    });
    return;
  }

  try {
    const parsed = new URL(connection);
    if (!(parsed.protocol === "postgres:" || parsed.protocol === "postgresql:")) {
      issues.push({
        key: "LOTTERY_POSTGRES_URL",
        message: `unexpected protocol "${parsed.protocol}" (expected postgres/postgresql)`
      });
    }
    if (!parsed.hostname) {
      issues.push({
        key: "LOTTERY_POSTGRES_URL",
        message: "hostname is empty"
      });
    }
    if (!parsed.username || !parsed.password) {
      issues.push({
        key: "LOTTERY_POSTGRES_URL",
        message: "username or password is missing"
      });
    }
    const dbName = parsed.pathname.replace(/^\/+/, "");
    if (!dbName) {
      issues.push({
        key: "LOTTERY_POSTGRES_URL",
        message: "database name is missing"
      });
    }
  } catch {
    issues.push({
      key: "LOTTERY_POSTGRES_URL",
      message: "invalid URL format"
    });
  }
}

function validateWebConfig(issues: PreflightIssue[], env: NodeJS.ProcessEnv): void {
  validateRequired(issues, env, "HOSTNAME");
  validateRequired(issues, env, "PORT");
  validateNoPlaceholder(issues, env, "HOSTNAME");
  validateNoPlaceholder(issues, env, "PORT");

  const rawPort = (env.PORT ?? "").trim();
  if (!rawPort) {
    return;
  }
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    issues.push({
      key: "PORT",
      message: "must be an integer in range 1..65535"
    });
  }
}

function validateWorkerConfig(issues: PreflightIssue[], env: NodeJS.ProcessEnv): void {
  validateRequired(issues, env, "LOTTERY_TERMINAL_LOCK_TTL_SECONDS");
  validateRequired(issues, env, "LOTTERY_TERMINAL_POLL_INTERVAL_MS");
  validateRequired(issues, env, "LOTTERY_TERMINAL_HANDLER_CODES");

  validateNoPlaceholder(issues, env, "LOTTERY_TERMINAL_LOCK_TTL_SECONDS");
  validateNoPlaceholder(issues, env, "LOTTERY_TERMINAL_POLL_INTERVAL_MS");
  validateNoPlaceholder(issues, env, "LOTTERY_TERMINAL_HANDLER_CODES");

  validatePositiveInteger(issues, env, "LOTTERY_TERMINAL_LOCK_TTL_SECONDS", 1);
  validatePositiveInteger(issues, env, "LOTTERY_TERMINAL_POLL_INTERVAL_MS", 250);

  const handlers = (env.LOTTERY_TERMINAL_HANDLER_CODES ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  if (handlers.length === 0) {
    issues.push({
      key: "LOTTERY_TERMINAL_HANDLER_CODES",
      message: "must contain at least one lottery code"
    });
  }
}

function validateRequired(issues: PreflightIssue[], env: NodeJS.ProcessEnv, key: string): void {
  const value = (env[key] ?? "").trim();
  if (!value) {
    issues.push({
      key,
      message: "is required"
    });
  }
}

function validateNoPlaceholder(issues: PreflightIssue[], env: NodeJS.ProcessEnv, key: string): void {
  const value = (env[key] ?? "").trim();
  if (!value) {
    return;
  }
  if (isPlaceholder(value)) {
    issues.push({
      key,
      message: "contains placeholder markers (<...>)"
    });
  }
}

function validatePositiveInteger(
  issues: PreflightIssue[],
  env: NodeJS.ProcessEnv,
  key: string,
  minimum: number
): void {
  const value = (env[key] ?? "").trim();
  if (!value) {
    return;
  }

  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < minimum) {
    issues.push({
      key,
      message: `must be integer >= ${minimum}`
    });
  }
}

function isPlaceholder(value: string): boolean {
  return value.includes("<") && value.includes(">");
}

main();
