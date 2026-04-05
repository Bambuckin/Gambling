import { TicketQueryService } from "@lottery/application";
import { getPurchaseRuntimeStores } from "../purchase/purchase-runtime";

let cachedTicketQueryService: TicketQueryService | null = null;

export function getTicketQueryService(): TicketQueryService {
  if (!cachedTicketQueryService) {
    const stores = getPurchaseRuntimeStores();
    cachedTicketQueryService = new TicketQueryService({
      ticketStore: stores.ticketStore
    });
  }

  return cachedTicketQueryService;
}
