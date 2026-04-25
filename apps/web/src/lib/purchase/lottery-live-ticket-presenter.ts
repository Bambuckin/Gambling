export interface LotteryLiveTicketInput {
  readonly ticketId: string;
  readonly requestId: string;
  readonly drawId: string;
  readonly verificationStatus: string;
  readonly winningAmountMinor: number | null;
  readonly claimState: string;
}

export interface LotteryLiveTicketView {
  readonly ticketId: string;
  readonly requestId: string;
  readonly drawId: string;
  readonly statusLabel: string;
  readonly outcomeLabel: string;
  readonly claimStateLabel: string;
  readonly canFulfill: boolean;
}

export function presentLotteryLiveTicket(input: LotteryLiveTicketInput): LotteryLiveTicketView {
  const isWinningTicket = input.verificationStatus === "verified" && (input.winningAmountMinor ?? 0) > 0;

  return {
    ticketId: input.ticketId,
    requestId: input.requestId,
    drawId: input.drawId,
    statusLabel: formatTicketStatus(input.verificationStatus),
    outcomeLabel: formatTicketOutcome(input.verificationStatus, input.winningAmountMinor),
    claimStateLabel: formatClaimState(input.claimState, isWinningTicket),
    canFulfill: isWinningTicket && input.claimState === "unclaimed"
  };
}

function formatTicketStatus(status: string): string {
  switch (status) {
    case "pending":
      return "Билет куплен";
    case "verified":
      return "Проверен";
    case "failed":
      return "Проверка не прошла";
    default:
      return "Статус уточняется";
  }
}

function formatTicketOutcome(verificationStatus: string, winningAmountMinor: number | null | undefined): string {
  if (verificationStatus === "pending") {
    return "Ждёт закрытия тиража";
  }

  if (verificationStatus === "failed") {
    return "Результат недоступен";
  }

  if (verificationStatus === "verified" && (winningAmountMinor ?? 0) > 0) {
    return formatMinorAsRub(winningAmountMinor ?? 0);
  }

  if (verificationStatus === "verified") {
    return "Без выигрыша";
  }

  return "Итог уточняется";
}

function formatClaimState(claimState: string, isWinningTicket: boolean): string {
  if (!isWinningTicket) {
    return "Нет выплаты";
  }

  switch (claimState) {
    case "unclaimed":
      return "Доступно зачисление";
    case "credit_pending":
      return "Зачисление в очереди";
    case "credited":
      return "Зачислен";
    case "cash_desk_pending":
      return "Ожидает кассу";
    case "cash_desk_paid":
      return "Выдан в кассе";
    default:
      return "Статус выплаты уточняется";
  }
}

function formatMinorAsRub(amountMinor: number): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amountMinor / 100);
}
