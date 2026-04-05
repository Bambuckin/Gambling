import { getLotteryRegistryService } from "../registry/registry-runtime";

export interface LotteryShellEntry {
  readonly code: string;
  readonly title: string;
}

const FALLBACK_LOTTERY_CODE = "demo-lottery";

export async function readLotteryShellCatalog(): Promise<LotteryShellEntry[]> {
  const visible = await getLotteryRegistryService().getVisibleLotteries();
  return visible.map((entry) => ({
    code: entry.lotteryCode,
    title: entry.title
  }));
}

export async function isLotteryEnabled(lotteryCode: string): Promise<boolean> {
  const lottery = await getLotteryRegistryService().getLotteryByCode(lotteryCode);
  return Boolean(lottery?.enabled);
}

export async function resolveFallbackLotteryCode(preferredLotteryCode: string): Promise<string> {
  const visible = await getLotteryRegistryService().getVisibleLotteries();
  if (visible.some((entry) => entry.lotteryCode === preferredLotteryCode)) {
    return preferredLotteryCode;
  }

  return visible[0]?.lotteryCode ?? FALLBACK_LOTTERY_CODE;
}
