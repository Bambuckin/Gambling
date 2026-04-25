import type { RequestState } from "@lottery/domain";

export interface LotteryLiveRequestView {
  readonly requestId: string;
  readonly drawId: string;
  readonly attemptCount: number;
  readonly updatedAt: string;
  readonly statusLabel: string;
  readonly resultLabel: string;
  readonly canCancel: boolean;
  readonly affectsReserve: boolean;
}

interface PresentableRequestInput {
  readonly requestId: string;
  readonly drawId: string;
  readonly attemptCount: number;
  readonly updatedAt: string;
  readonly status: RequestState;
  readonly finalResult: string | null;
}

export function presentLotteryLiveRequest(input: PresentableRequestInput): LotteryLiveRequestView {
  return {
    requestId: input.requestId,
    drawId: input.drawId,
    attemptCount: input.attemptCount,
    updatedAt: input.updatedAt,
    statusLabel: formatRequestStatusLabel(input.status, input.finalResult),
    resultLabel: formatRequestResultLabel(input.status, input.finalResult),
    canCancel: isCancelableRequestState(input.status),
    affectsReserve: isReserveRelevantRequestState(input.status)
  };
}

export function isCancelableRequestState(state: RequestState): boolean {
  return state === "queued" || state === "retrying";
}

function isReserveRelevantRequestState(state: RequestState): boolean {
  return state === "queued" || state === "executing" || state === "retrying";
}

function formatRequestStatusLabel(state: RequestState, result: string | null): string {
  switch (state) {
    case "created":
      return "Черновик";
    case "awaiting_confirmation":
      return "Ждёт подтверждения";
    case "confirmed":
      return "Подтверждена";
    case "queued":
      return "В очереди";
    case "executing":
      return "Покупается";
    case "retrying":
      return "Повтор покупки";
    case "added_to_cart":
      return "В корзине";
    case "success":
      return hasPublishedResult(result) ? "Результат готов" : "Билет куплен";
    case "error":
      return "Покупка не прошла";
    case "canceled":
      return "Отменена";
    case "reserve_released":
      return "Резерв снят";
    default:
      return "Статус уточняется";
  }
}

function formatRequestResultLabel(state: RequestState, result: string | null): string {
  if (!result) {
    if (state === "success") {
      return "Ждёт закрытия тиража";
    }

    if (state === "queued" || state === "executing" || state === "retrying") {
      return "Покупка в процессе";
    }

    if (state === "canceled" || state === "reserve_released") {
      return "Без покупки";
    }

    if (state === "error") {
      return "Нет результата";
    }

    return "Без итога";
  }

  if (result.startsWith("terminal_attempt")) {
    if (result.includes("status=ticket_purchased") || result.includes("outcome=success")) {
      return "Билет куплен";
    }
    if (result.includes("outcome=added_to_cart")) {
      return "В корзине";
    }
    if (result.includes("outcome=retrying")) {
      return "Повтор покупки";
    }
    if (result.includes("outcome=error")) {
      return "Покупка не прошла";
    }

    return "Итог уточняется";
  }

  switch (result) {
    case "ticket_purchased":
      return "Билет куплен";
    case "added_to_cart":
      return "В корзине";
    case "canonical result: win":
      return "Выигрыш";
    case "canonical result: lose":
      return "Без выигрыша";
    case "canonical purchase failed":
      return "Покупка не прошла";
    case "canonical purchase canceled":
      return "Без покупки";
    default:
      return "Итог уточняется";
  }
}

function hasPublishedResult(result: string | null): boolean {
  return result === "canonical result: win" || result === "canonical result: lose";
}
