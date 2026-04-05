import type { TerminalHandlerBinding, TerminalHandlerRegistry } from "../ports/terminal-handler-registry.js";

export interface TerminalHandlerResolverServiceDependencies {
  readonly handlerRegistry: TerminalHandlerRegistry;
}

export type TerminalHandlerResolverServiceErrorCode = "invalid_lottery_code" | "handler_not_found";

export class TerminalHandlerResolverServiceError extends Error {
  readonly code: TerminalHandlerResolverServiceErrorCode;

  constructor(
    message: string,
    options: {
      readonly code: TerminalHandlerResolverServiceErrorCode;
    }
  ) {
    super(message);
    this.name = "TerminalHandlerResolverServiceError";
    this.code = options.code;
  }
}

export class TerminalHandlerResolverService {
  private readonly handlerRegistry: TerminalHandlerRegistry;

  constructor(dependencies: TerminalHandlerResolverServiceDependencies) {
    this.handlerRegistry = dependencies.handlerRegistry;
  }

  async resolvePurchaseBinding(lotteryCode: string): Promise<TerminalHandlerBinding> {
    const normalizedLotteryCode = normalizeLotteryCode(lotteryCode);
    const binding = await this.handlerRegistry.getPurchaseBinding(normalizedLotteryCode);
    if (!binding) {
      throw new TerminalHandlerResolverServiceError(
        `no terminal purchase handler binding found for lottery "${normalizedLotteryCode}"`,
        {
          code: "handler_not_found"
        }
      );
    }

    if (binding.lotteryCode !== normalizedLotteryCode) {
      throw new TerminalHandlerResolverServiceError(
        `handler binding mismatch for lottery "${normalizedLotteryCode}"`,
        {
          code: "handler_not_found"
        }
      );
    }

    return {
      lotteryCode: binding.lotteryCode,
      bindingKey: binding.bindingKey,
      contractVersion: binding.contractVersion
    };
  }
}

function normalizeLotteryCode(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    throw new TerminalHandlerResolverServiceError("lotteryCode is required", {
      code: "invalid_lottery_code"
    });
  }
  return normalized;
}
