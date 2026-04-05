import { describe, expect, it } from "vitest";
import type { TerminalHandlerBinding, TerminalHandlerRegistry } from "../ports/terminal-handler-registry.js";
import {
  TerminalHandlerResolverService,
  TerminalHandlerResolverServiceError
} from "../services/terminal-handler-resolver-service.js";

describe("TerminalHandlerResolverService", () => {
  it("resolves deterministic purchase binding by lottery code", async () => {
    const service = new TerminalHandlerResolverService({
      handlerRegistry: new InMemoryTerminalHandlerRegistry([
        {
          lotteryCode: "demo-lottery",
          bindingKey: "demo-handler-v1",
          contractVersion: "v1"
        }
      ])
    });

    const binding = await service.resolvePurchaseBinding("  DEMO-LOTTERY ");
    expect(binding).toEqual({
      lotteryCode: "demo-lottery",
      bindingKey: "demo-handler-v1",
      contractVersion: "v1"
    });
  });

  it("throws typed error when binding is missing", async () => {
    const service = new TerminalHandlerResolverService({
      handlerRegistry: new InMemoryTerminalHandlerRegistry([])
    });

    const action = service.resolvePurchaseBinding("unknown-lottery");
    await expect(action).rejects.toBeInstanceOf(TerminalHandlerResolverServiceError);
    await expect(action).rejects.toMatchObject({
      code: "handler_not_found"
    });
  });

  it("throws typed error when lottery code is empty", async () => {
    const service = new TerminalHandlerResolverService({
      handlerRegistry: new InMemoryTerminalHandlerRegistry([])
    });

    const action = service.resolvePurchaseBinding("   ");
    await expect(action).rejects.toBeInstanceOf(TerminalHandlerResolverServiceError);
    await expect(action).rejects.toMatchObject({
      code: "invalid_lottery_code"
    });
  });
});

class InMemoryTerminalHandlerRegistry implements TerminalHandlerRegistry {
  private readonly byLotteryCode: Map<string, TerminalHandlerBinding>;

  constructor(bindings: readonly TerminalHandlerBinding[]) {
    this.byLotteryCode = new Map(bindings.map((binding) => [binding.lotteryCode, { ...binding }]));
  }

  async getPurchaseBinding(lotteryCode: string): Promise<TerminalHandlerBinding | null> {
    const binding = this.byLotteryCode.get(lotteryCode) ?? null;
    return binding
      ? {
          ...binding
        }
      : null;
  }
}
