import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

interface CliOptions {
  readonly envPath: string;
  readonly filter: string;
  readonly script: string;
  readonly passthroughArgs: readonly string[];
}

function main(): void {
  const options = readCliOptions(process.argv.slice(2));
  loadRootEnv(options.envPath);
  const child = spawnPackageScript(options);

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });

  child.on("error", (error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    console.error(`[run-package-script-with-root-env] failed: ${message}`);
    process.exit(1);
  });
}

function spawnPackageScript(options: CliOptions) {
  const commandArgs = ["pnpm", "--filter", options.filter, options.script, ...options.passthroughArgs];

  if (process.platform === "win32") {
    const runner = process.env.ComSpec ?? "cmd.exe";
    const commandLine = ["corepack.cmd", ...commandArgs].map(quoteWindowsArg).join(" ");
    return spawn(runner, ["/d", "/s", "/c", commandLine], {
      stdio: "inherit",
      env: process.env
    });
  }

  return spawn("corepack", commandArgs, {
    stdio: "inherit",
    env: process.env
  });
}

function readCliOptions(args: readonly string[]): CliOptions {
  let envPath = ".env";
  let filter = "";
  let script = "";
  const passthroughArgs: string[] = [];
  let readingPassthrough = false;

  for (const rawArg of args) {
    const arg = rawArg.trim();
    if (readingPassthrough) {
      passthroughArgs.push(rawArg);
      continue;
    }

    if (arg === "--") {
      readingPassthrough = true;
      continue;
    }
    if (arg.startsWith("--env=")) {
      envPath = arg.slice("--env=".length).trim();
      continue;
    }
    if (arg.startsWith("--filter=")) {
      filter = arg.slice("--filter=".length).trim();
      continue;
    }
    if (arg.startsWith("--script=")) {
      script = arg.slice("--script=".length).trim();
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!filter) {
    throw new Error("Missing --filter=<workspace package>");
  }
  if (!script) {
    throw new Error("Missing --script=<package script>");
  }

  return {
    envPath,
    filter,
    script,
    passthroughArgs
  };
}

function loadRootEnv(envPath: string): void {
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

function quoteWindowsArg(value: string): string {
  if (!/[\s"]/u.test(value)) {
    return value;
  }

  return `"${value.replace(/"/g, '\\"')}"`;
}

main();
