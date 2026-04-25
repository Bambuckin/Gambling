import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";

const DEFAULT_ENV_RELATIVE_PATH = "../../../../../.env";
const REPO_ENV_FROM_ENTRY = "../../../.env";
const BUNDLE_ENV_FROM_ENTRY = "../terminal-receiver.env";

export function loadWorkerEnvFromFile(relativePath = DEFAULT_ENV_RELATIVE_PATH): string | null {
  const scriptPath = process.argv[1];
  const scriptDir = scriptPath ? dirname(resolve(scriptPath)) : null;
  const candidates = new Set<string>();

  if (isAbsolute(relativePath)) {
    candidates.add(relativePath);
  } else {
    candidates.add(resolve(process.cwd(), relativePath));
    candidates.add(resolve(process.cwd(), ".env"));
    candidates.add(resolve(process.cwd(), BUNDLE_ENV_FROM_ENTRY));
    if (scriptDir) {
      candidates.add(resolve(scriptDir, relativePath));
      candidates.add(resolve(scriptDir, REPO_ENV_FROM_ENTRY));
      candidates.add(resolve(scriptDir, BUNDLE_ENV_FROM_ENTRY));
    }
  }

  let envFilePath: string | null = null;
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      envFilePath = candidate;
      break;
    }
  }

  if (!envFilePath) {
    return null;
  }

  const contents = readFileSync(envFilePath, "utf8");
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
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    process.env[key] = value;
  }

  return envFilePath;
}
