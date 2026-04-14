import { describe, expect, it } from "vitest";
import {
  listKnownLotteryPresentationCodes,
  resolveLotteryPresentation
} from "../lottery-presentation.js";

describe("lottery presentation mapping", () => {
  it("contains curated presets for known lottery codes", () => {
    const codes = listKnownLotteryPresentationCodes();

    expect(codes).toEqual(
      expect.arrayContaining(["mechtallion", "bolshaya-8", "velikolepnaya-8", "lavina-prizov", "trizhdy-tri"])
    );
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("returns configured palette for known code", () => {
    const presentation = resolveLotteryPresentation("mechtallion");
    expect(presentation.category).toBe("Флагман");
    expect(presentation.accentFrom).toMatch(/^#/);
    expect(presentation.accentTo).toMatch(/^#/);
  });

  it("returns fallback palette for unknown code", () => {
    const presentation = resolveLotteryPresentation("unknown-lottery");
    expect(presentation.category).toBe("Тиражная лотерея");
    expect(presentation.tagline.length).toBeGreaterThan(20);
  });
});
