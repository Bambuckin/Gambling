import { SystemTimeSource, TerminalHealthService } from "@lottery/application";
import { getPurchaseRuntimeStores } from "../purchase/purchase-runtime";

let cachedTerminalHealthService: TerminalHealthService | null = null;

export function getTerminalHealthService(): TerminalHealthService {
  if (!cachedTerminalHealthService) {
    const stores = getPurchaseRuntimeStores();
    cachedTerminalHealthService = new TerminalHealthService({
      requestStore: stores.requestStore,
      queueStore: stores.queueStore,
      timeSource: new SystemTimeSource()
    });
  }

  return cachedTerminalHealthService;
}
