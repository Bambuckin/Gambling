import { describe, expect, it } from "vitest";
import {
  createDefaultDrawSnapshots,
  createDefaultLotteryRegistryEntries,
  listDefaultLotteryTitles,
  listDefaultTerminalHandlerCodes
} from "../seeds/default-lottery-catalog.js";

describe("default lottery catalog seed", () => {
  it("contains unique lottery codes and deterministic order", () => {
    const entries = createDefaultLotteryRegistryEntries();
    const codes = entries.map((entry) => entry.lotteryCode);

    expect(codes.length).toBeGreaterThan(10);
    expect(new Set(codes).size).toBe(codes.length);
    expect(entries[0]?.displayOrder).toBe(10);
    expect(entries[entries.length - 1]?.displayOrder).toBe(entries.length * 10);
  });

  it("includes core nloto titles", () => {
    const titles = listDefaultLotteryTitles();
    expect(titles).toEqual(
      expect.arrayContaining(["Мечталлион", "Большая 8", "Великолепная 8", "Лавина призов", "Трижды три"])
    );
  });

  it("creates draw snapshots for enabled lotteries only", () => {
    const entries = createDefaultLotteryRegistryEntries();
    const enabledCodes = entries.filter((entry) => entry.enabled).map((entry) => entry.lotteryCode);
    const snapshots = createDefaultDrawSnapshots(new Date("2026-04-06T00:00:00.000Z"));

    expect(snapshots.length).toBe(enabledCodes.length);
    expect(snapshots.every((snapshot) => enabledCodes.includes(snapshot.lotteryCode))).toBe(true);
    expect(snapshots.every((snapshot) => snapshot.freshnessTtlSeconds > 0)).toBe(true);
  });

  it("returns handler codes aligned with enabled lottery list", () => {
    const entries = createDefaultLotteryRegistryEntries();
    const expected = entries.filter((entry) => entry.enabled).map((entry) => entry.lotteryCode);
    const handlerCodes = listDefaultTerminalHandlerCodes();

    expect(handlerCodes).toEqual(expected);
  });
});
