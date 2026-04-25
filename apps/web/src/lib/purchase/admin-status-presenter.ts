export interface AdminAlertPresentationInput {
  readonly alertId: string;
  readonly severity: string;
  readonly category: string;
  readonly referenceIds: readonly string[];
}

export interface AdminAuditTargetInput {
  readonly targetType: string;
  readonly targetId: string;
}

export interface AdminOperationsReferenceInput {
  readonly requestId?: string;
  readonly userId?: string;
  readonly lotteryCode?: string;
  readonly drawId?: string;
  readonly terminalId?: string;
  readonly ledgerEntryId?: string;
}

export interface AdminDrawTicketOutcomeInput {
  readonly verificationStatus: string;
  readonly adminResultMark: string | null;
  readonly winningAmountMinor: number | null;
  readonly resultSource: string | null;
}

export interface AdminAlertPresentation {
  readonly severityLabel: string;
  readonly title: string;
  readonly description: string;
  readonly referenceLabel: string;
}

export function formatAdminTerminalState(state: string): string {
  switch (state) {
    case "idle":
      return "Свободен";
    case "busy":
    case "executing":
      return "Обрабатывает заявку";
    case "degraded":
      return "Работает с ошибками";
    case "error":
    case "offline":
      return "Ошибка терминала";
    default:
      return "Состояние уточняется";
  }
}

export function formatAdminQueueStatus(status: string): string {
  switch (status) {
    case "queued":
      return "В очереди";
    case "executing":
      return "Исполняется";
    case "missing":
      return "Нет в очереди";
    default:
      return "Статус очереди уточняется";
  }
}

export function formatAdminReceiverState(state: string): string {
  switch (state) {
    case "awaiting_confirmation":
      return "Ожидает подтверждения";
    case "confirmed":
      return "Подтверждена";
    case "queued":
      return "В очереди";
    case "executing":
      return "Исполняется";
    case "added_to_cart":
      return "Добавлен в корзину терминала";
    case "success":
      return "Билет куплен";
    case "completed":
      return "Завершено";
    case "retrying":
      return "Повтор покупки";
    case "error":
      return "Ошибка покупки";
    case "canceled":
      return "Отменена";
    case "reserve_released":
      return "Резерв снят";
    default:
      return "Статус заявки уточняется";
  }
}

export function formatAdminCashDeskStatus(status: string): string {
  switch (status) {
    case "pending":
      return "Ожидает кассу";
    case "paid":
      return "Выдано";
    default:
      return "Статус выплаты уточняется";
  }
}

export function formatAdminWinningsCreditStatus(status: string, lastError: string | null): string {
  switch (status) {
    case "queued":
      return "В очереди";
    case "processing":
      return "Обрабатывается";
    case "done":
      return "Зачислено";
    case "error":
      return lastError ? `Ошибка зачисления: ${lastError}` : "Ошибка зачисления";
    default:
      return "Статус зачисления уточняется";
  }
}

export function presentAdminAlert(alert: AdminAlertPresentationInput): AdminAlertPresentation {
  const content = resolveAdminAlertContent(alert.alertId, alert.category);

  return {
    severityLabel: formatAdminAlertSeverity(alert.severity),
    title: content.title,
    description: content.description,
    referenceLabel: alert.referenceIds.length > 0 ? alert.referenceIds.join(", ") : "нет"
  };
}

export function formatAdminAlertSeverity(severity: string): string {
  switch (severity) {
    case "critical":
      return "Критично";
    case "warning":
      return "Предупреждение";
    default:
      return "Уровень уточняется";
  }
}

export function formatAdminAuditDomain(domain: string): string {
  switch (domain) {
    case "admin-queue":
      return "Очередь администратора";
    case "terminal":
      return "Терминал";
    case "finance":
      return "Финансы";
    default:
      return "Операции";
  }
}

export function formatAdminAuditAction(action: string): string {
  switch (action) {
    case "queue_priority_changed":
      return "Приоритет очереди изменён";
    case "admin_priority_enqueued":
      return "Заявка добавлена с приоритетом администратора";
    case "terminal_degraded":
      return "Терминал работает с ошибками";
    case "terminal_offline":
      return "Терминал недоступен";
    case "terminal_execution_error":
      return "Ошибка исполнения на терминале";
    case "terminal_execution_stale":
      return "Исполнение на терминале зависло";
    case "financial_anomaly_detected":
      return "Обнаружена финансовая аномалия";
    default:
      return "Операционное событие";
  }
}

export function formatAdminAuditSeverity(severity: string): string {
  switch (severity) {
    case "critical":
      return "Критично";
    case "warning":
      return "Предупреждение";
    case "info":
      return "Инфо";
    default:
      return "Уровень уточняется";
  }
}

export function formatAdminAuditTarget(target: AdminAuditTargetInput): string {
  return `${formatAdminAuditTargetType(target.targetType)}: ${target.targetId}`;
}

export function formatAdminOperationsReference(reference: AdminOperationsReferenceInput): string {
  const parts = [
    reference.requestId ? `Заявка ${reference.requestId}` : null,
    reference.userId ? `Пользователь ${reference.userId}` : null,
    reference.lotteryCode ? `Лотерея ${reference.lotteryCode}` : null,
    reference.drawId ? `Тираж ${reference.drawId}` : null,
    reference.terminalId ? `Терминал ${reference.terminalId}` : null,
    reference.ledgerEntryId ? `Запись баланса ${reference.ledgerEntryId}` : null
  ].filter((part): part is string => part !== null);

  return parts.length > 0 ? parts.join(", ") : "нет";
}

export function formatAdminDrawStatus(status: string): string {
  switch (status) {
    case "open":
      return "Открыт";
    case "closed":
      return "Закрыт";
    case "settled":
      return "Опубликован";
    default:
      return "Статус тиража уточняется";
  }
}

export function resolveAdminDrawBadgeClass(status: string): string {
  switch (status) {
    case "open":
    case "closed":
      return "warning";
    case "settled":
      return "success";
    default:
      return "";
  }
}

export function formatAdminDrawVerificationStatus(status: string): string {
  switch (status) {
    case "pending":
      return "Куплен, ждёт закрытия тиража";
    case "verified":
      return "Результат опубликован";
    case "failed":
      return "Ошибка проверки";
    default:
      return "Статус проверки уточняется";
  }
}

export function formatAdminDrawMark(mark: string | null): string {
  if (mark === "win") {
    return "Выигрыш";
  }

  if (mark === "lose") {
    return "Проигрыш";
  }

  if (mark === null) {
    return "Не задана";
  }

  return "Пометка уточняется";
}

export function formatAdminDrawTicketOutcome(ticket: AdminDrawTicketOutcomeInput): string {
  if (ticket.verificationStatus === "pending") {
    return ticket.adminResultMark === "win"
      ? "Будет выигрышным"
      : ticket.adminResultMark === "lose"
        ? "Будет проигрышным"
        : "Ждёт решения";
  }

  if (ticket.verificationStatus === "failed") {
    return "Проверка завершилась ошибкой";
  }

  if ((ticket.winningAmountMinor ?? 0) > 0) {
    return `Выигрыш ${formatAdminMinorAsRub(ticket.winningAmountMinor ?? 0)}`;
  }

  if (ticket.resultSource === "admin_emulated") {
    return "Проигрыш по решению администратора";
  }

  if (ticket.verificationStatus === "verified") {
    return "Проигрыш";
  }

  return "Итог уточняется";
}

function resolveAdminAlertContent(
  alertId: string,
  category: string
): {
  readonly title: string;
  readonly description: string;
} {
  switch (alertId) {
    case "terminal-offline":
      return {
        title: "Терминал недоступен",
        description: "Главный терминал не отвечает. Проверь соединение и последний сбой."
      };
    case "terminal-degraded":
      return {
        title: "Терминал работает с ошибками",
        description: "Есть повторяющиеся сбои. Проверь активную заявку и журнал терминала."
      };
    case "queue-errors":
      return {
        title: "Заявки застряли в ошибке",
        description: "Нужна операторская проверка заявок из списка ссылок."
      };
    case "queue-stale-executing":
      return {
        title: "Зависшее исполнение в терминале",
        description: "Заявки слишком долго находятся в исполнении."
      };
    case "queue-retrying":
      return {
        title: "Несколько заявок повторяются",
        description: "Очередь выполняет повторные попытки. Проверь терминальный контур."
      };
    case "finance-anomaly":
      return {
        title: "Финансовая аномалия",
        description: "Критические события аудита баланса требуют проверки."
      };
    default:
      return {
        title: formatAdminAlertCategory(category),
        description: "Требуется проверка оператором."
      };
  }
}

function formatAdminAlertCategory(category: string): string {
  switch (category) {
    case "terminal":
      return "Сигнал терминала";
    case "queue":
      return "Сигнал очереди";
    case "finance":
      return "Финансовый сигнал";
    default:
      return "Операционный сигнал";
  }
}

function formatAdminAuditTargetType(targetType: string): string {
  switch (targetType) {
    case "request":
      return "Заявка";
    case "terminal":
      return "Терминал";
    case "ledger":
      return "Запись баланса";
    case "user":
      return "Пользователь";
    default:
      return "Цель";
  }
}

function formatAdminMinorAsRub(amountMinor: number): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amountMinor / 100);
}
