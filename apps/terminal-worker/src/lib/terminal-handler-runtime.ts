import {
  TerminalHandlerResolverService,
  type TerminalHandlerBinding,
  type TerminalHandlerRegistry
} from "@lottery/application";
import {
  createLotteryPurchaseHandlerRegistry,
  type LotteryPurchaseHandlerBinding,
  type LotteryPurchaseHandlerContract,
  type LotteryPurchaseContext,
  type LotteryPurchaseResult,
  type LotteryResultCheck
} from "@lottery/lottery-handlers";

export interface ResolvedPurchaseHandler {
  readonly binding: TerminalHandlerBinding;
  readonly handler: LotteryPurchaseHandlerContract;
}

export interface VerifyTicketResultInput {
  readonly lotteryCode: string;
  readonly externalTicketReference: string;
  readonly drawId: string;
}

export class TerminalHandlerRuntime {
  private readonly registryBindings: ReturnType<typeof createLotteryPurchaseHandlerRegistry>;
  private readonly resolverService: TerminalHandlerResolverService;

  constructor(handlers: readonly LotteryPurchaseHandlerContract[] = [new DemoLotteryPurchaseHandler()]) {
    this.registryBindings = createLotteryPurchaseHandlerRegistry(handlers);
    this.resolverService = new TerminalHandlerResolverService({
      handlerRegistry: new WorkerTerminalHandlerRegistryAdapter(this.registryBindings.listBindings())
    });
  }

  async resolvePurchaseHandler(lotteryCode: string): Promise<ResolvedPurchaseHandler> {
    const binding = await this.resolverService.resolvePurchaseBinding(lotteryCode);
    const resolvedBinding = this.registryBindings.getByLotteryCode(binding.lotteryCode);
    if (!resolvedBinding) {
      throw new Error(`missing runtime purchase handler for lottery "${binding.lotteryCode}"`);
    }

    return {
      binding,
      handler: resolvedBinding.handler
    };
  }

  async verifyTicketResult(input: VerifyTicketResultInput): Promise<LotteryResultCheck> {
    const resolved = await this.resolvePurchaseHandler(input.lotteryCode);
    const reference = input.externalTicketReference.trim();
    const normalizedReference = reference.toLowerCase();

    const status: LotteryResultCheck["status"] = normalizedReference.includes("error")
      ? "error"
      : normalizedReference.includes("pending")
        ? "pending"
        : normalizedReference.includes("win")
          ? "win"
          : "lose";

    return {
      status,
      winningAmountMinor: status === "win" ? 500 : 0,
      rawTerminalOutput: `[demo-result-handler] lottery=${resolved.binding.lotteryCode} draw=${input.drawId} ref=${reference} status=${status}`
    };
  }
}

class WorkerTerminalHandlerRegistryAdapter implements TerminalHandlerRegistry {
  private readonly bindingByLotteryCode: Map<string, TerminalHandlerBinding>;

  constructor(bindings: readonly LotteryPurchaseHandlerBinding[]) {
    this.bindingByLotteryCode = new Map(
      bindings.map((binding) => [
        binding.lotteryCode,
        {
          lotteryCode: binding.lotteryCode,
          bindingKey: binding.bindingKey,
          contractVersion: binding.contractVersion
        } satisfies TerminalHandlerBinding
      ])
    );
  }

  async getPurchaseBinding(lotteryCode: string): Promise<TerminalHandlerBinding | null> {
    const binding = this.bindingByLotteryCode.get(lotteryCode) ?? null;
    return binding
      ? {
          ...binding
        }
      : null;
  }
}

class DemoLotteryPurchaseHandler implements LotteryPurchaseHandlerContract {
  readonly contractVersion = "v1" as const;
  readonly lotteryCode = "demo-lottery";
  readonly bindingKey = "demo-terminal-handler-v1";

  async purchase(context: LotteryPurchaseContext): Promise<LotteryPurchaseResult> {
    return {
      externalTicketReference: `${context.lotteryCode}-${context.requestId}-terminal-stub`,
      rawTerminalOutput: `[demo-terminal-handler] draw=${context.draw.drawId} attempt=${context.attempt}`
    };
  }
}
