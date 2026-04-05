import type { LotteryRegistryEntry } from "@lottery/domain";
import type { LotteryOrderDirection } from "@lottery/application";
import { getLotteryRegistryService } from "./registry-runtime";

export async function listAdminRegistryEntries(): Promise<LotteryRegistryEntry[]> {
  return getLotteryRegistryService().listAllLotteries();
}

export async function setAdminLotteryEnabled(lotteryCode: string, enabled: boolean): Promise<LotteryRegistryEntry> {
  return getLotteryRegistryService().setLotteryEnabled(lotteryCode, enabled);
}

export async function moveAdminLottery(
  lotteryCode: string,
  direction: LotteryOrderDirection
): Promise<LotteryRegistryEntry[]> {
  return getLotteryRegistryService().moveLottery(lotteryCode, direction);
}
