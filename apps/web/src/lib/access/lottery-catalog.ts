export interface LotteryShellEntry {
  readonly code: string;
  readonly title: string;
}

const DEFAULT_LOTTERY_CATALOG: LotteryShellEntry[] = [
  { code: "demo-lottery", title: "Demo Lottery" },
  { code: "gosloto-6x45", title: "Gosloto 6x45" }
];

export function readLotteryShellCatalog(): LotteryShellEntry[] {
  const raw = process.env.LOTTERY_SHELL_LOTTERIES_JSON;
  if (!raw) {
    return DEFAULT_LOTTERY_CATALOG;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return DEFAULT_LOTTERY_CATALOG;
    }

    const entries = parsed
      .map((entry) => sanitizeCatalogEntry(entry))
      .filter((entry): entry is LotteryShellEntry => entry !== null);

    return entries.length > 0 ? entries : DEFAULT_LOTTERY_CATALOG;
  } catch {
    return DEFAULT_LOTTERY_CATALOG;
  }
}

function sanitizeCatalogEntry(input: unknown): LotteryShellEntry | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const record = input as Record<string, unknown>;
  const code = typeof record.code === "string" ? record.code.trim().toLowerCase() : "";
  const title = typeof record.title === "string" ? record.title.trim() : "";
  if (!code || !title) {
    return null;
  }

  return { code, title };
}
