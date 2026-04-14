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
import { listDefaultTerminalHandlerCodes as listDefaultCatalogHandlerCodes } from "@lottery/infrastructure";
import { Big8TerminalCartHandler } from "./big8-terminal-cart-handler.js";
import { Big8MockTerminalHandler } from "./big8-mock-terminal-handler.js";

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

  constructor(handlers: readonly LotteryPurchaseHandlerContract[] = createDefaultHandlersFromEnv()) {
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
  readonly lotteryCode: string;
  readonly bindingKey: string;

  constructor(lotteryCode: string) {
    this.lotteryCode = lotteryCode.trim().toLowerCase();
    this.bindingKey = `${this.lotteryCode}-terminal-handler-v1`;
  }

  async purchase(context: LotteryPurchaseContext): Promise<LotteryPurchaseResult> {
    return {
      externalTicketReference: `${context.lotteryCode}-${context.requestId}-terminal-stub`,
      executionOutcome: "ticket_purchased",
      rawTerminalOutput: `[demo-terminal-handler] draw=${context.draw.drawId} attempt=${context.attempt}`
    };
  }
}

function createDefaultHandlersFromEnv(): readonly LotteryPurchaseHandlerContract[] {
  const big8CartAutomationEnabled =
    (process.env.LOTTERY_BIG8_CART_AUTOMATION_ENABLED ?? "true").trim().toLowerCase() !== "false";
  const big8TerminalMode = (process.env.LOTTERY_BIG8_TERMINAL_MODE ?? "real").trim().toLowerCase();
  const useBig8MockTerminal = big8TerminalMode === "mock";
  const big8MockLatencyMs = readPositiveIntFromEnv("LOTTERY_BIG8_MOCK_LATENCY_MS");
  const big8ActionTimeoutMs = readPositiveIntFromEnv("LOTTERY_BIG8_ACTION_TIMEOUT_MS");
  const big8DrawModalWaitMs = readPositiveIntFromEnv("LOTTERY_BIG8_DRAW_MODAL_WAIT_MS");
  const big8HandlerOptions = {
    ...(process.env.LOTTERY_TERMINAL_BROWSER_URL
      ? { browserUrl: process.env.LOTTERY_TERMINAL_BROWSER_URL }
      : {}),
    ...(process.env.LOTTERY_TERMINAL_PAGE_URL ? { pageUrl: process.env.LOTTERY_TERMINAL_PAGE_URL } : {}),
    ...(big8ActionTimeoutMs ? { stepTimeoutMs: big8ActionTimeoutMs } : {}),
    ...(big8DrawModalWaitMs ? { drawModalWaitMs: big8DrawModalWaitMs } : {}),
    ...(process.env.LOTTERY_BIG8_RELOAD_BEFORE_PURCHASE
      ? {
          reloadBeforeRun:
            process.env.LOTTERY_BIG8_RELOAD_BEFORE_PURCHASE.trim().toLowerCase() !== "false"
        }
      : {})
  };

  const codes = readDefaultLotteryCodes();
  return codes.map((code) =>
    code === "bolshaya-8" && big8CartAutomationEnabled
      ? useBig8MockTerminal
        ? new Big8MockTerminalHandler({
            ...(big8MockLatencyMs ? { latencyMs: big8MockLatencyMs } : {})
          })
        : new Big8TerminalCartHandler(big8HandlerOptions)
      : new DemoLotteryPurchaseHandler(code)
  );
}

function readPositiveIntFromEnv(key: string): number | null {
  const raw = process.env[key];
  if (!raw) {
    return null;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.trunc(parsed);
}

function readDefaultLotteryCodes(): readonly string[] {
  const raw = process.env.LOTTERY_TERMINAL_HANDLER_CODES;
  if (!raw) {
    return listDefaultCatalogHandlerCodes();
  }

  const codes = raw
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0);

  return codes.length > 0 ? [...new Set(codes)] : listDefaultCatalogHandlerCodes();
}
