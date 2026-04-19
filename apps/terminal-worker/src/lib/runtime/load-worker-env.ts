import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const DEFAULT_ENV_RELATIVE_PATH = "../../../../../.env";

export function loadWorkerEnvFromFile(relativePath = DEFAULT_ENV_RELATIVE_PATH): string | null {
  const envFileUrl = new URL(relativePath, import.meta.url);
  const envFilePath = fileURLToPath(envFileUrl);

  if (!existsSync(envFilePath)) {
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
