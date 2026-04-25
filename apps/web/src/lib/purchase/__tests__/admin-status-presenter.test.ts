import { describe, expect, it } from "vitest";
import {
  formatAdminAuditAction,
  formatAdminAuditDomain,
  formatAdminAuditSeverity,
  formatAdminAuditTarget,
  formatAdminDrawTicketOutcome,
  formatAdminDrawVerificationStatus,
  formatAdminOperationsReference,
  formatAdminQueueStatus,
  formatAdminReceiverState,
  formatAdminTerminalState,
  formatAdminWinningsCreditStatus,
  presentAdminAlert
} from "../admin-status-presenter";

describe("admin status presenter", () => {
  it("maps receiver and queue states to Russian labels without raw fallback", () => {
    expect(formatAdminTerminalState("busy")).toBe("Обрабатывает заявку");
    expect(formatAdminQueueStatus("executing")).toBe("Исполняется");
    expect(formatAdminReceiverState("success")).toBe("Билет куплен");

    expect(formatAdminTerminalState("raw_terminal_state")).toBe("Состояние уточняется");
    expect(formatAdminQueueStatus("raw_queue_status")).toBe("Статус очереди уточняется");
    expect(formatAdminReceiverState("raw_receiver_state")).toBe("Статус заявки уточняется");
  });

  it("presents alerts and audit references without English key labels", () => {
    const alert = presentAdminAlert({
      alertId: "queue-errors",
      severity: "critical",
      category: "queue",
      referenceIds: ["req-1"]
    });

    expect(alert).toEqual({
      severityLabel: "Критично",
      title: "Заявки застряли в ошибке",
      description: "Нужна операторская проверка заявок из списка ссылок.",
      referenceLabel: "req-1"
    });

    expect(
      formatAdminOperationsReference({
        requestId: "req-1",
        userId: "user-1",
        lotteryCode: "bolshaya-8",
        drawId: "draw-1",
        terminalId: "main-terminal",
        ledgerEntryId: "ledger-1"
      })
    ).toBe(
      "Заявка req-1, Пользователь user-1, Лотерея bolshaya-8, Тираж draw-1, Терминал main-terminal, Запись баланса ledger-1"
    );
  });

  it("uses safe audit fallbacks instead of raw domain/action/severity values", () => {
    expect(formatAdminAuditDomain("raw_domain")).toBe("Операции");
    expect(formatAdminAuditAction("raw_action")).toBe("Операционное событие");
    expect(formatAdminAuditSeverity("raw_severity")).toBe("Уровень уточняется");
    expect(formatAdminAuditTarget({ targetType: "raw_target", targetId: "target-1" })).toBe("Цель: target-1");
  });

  it("keeps draw result text Russian and avoids settlement/raw status leakage", () => {
    expect(formatAdminDrawVerificationStatus("pending")).toBe("Куплен, ждёт закрытия тиража");
    expect(
      formatAdminDrawTicketOutcome({
        verificationStatus: "verified",
        adminResultMark: "lose",
        winningAmountMinor: 0,
        resultSource: "admin_emulated"
      })
    ).toBe("Проигрыш по решению администратора");

    expect(formatAdminDrawVerificationStatus("raw_verification")).toBe("Статус проверки уточняется");
    expect(
      formatAdminDrawTicketOutcome({
        verificationStatus: "raw_verification",
        adminResultMark: null,
        winningAmountMinor: null,
        resultSource: null
      })
    ).toBe("Итог уточняется");
  });

  it("does not expose raw unknown money-flow statuses", () => {
    expect(formatAdminWinningsCreditStatus("raw_credit_status", null)).toBe("Статус зачисления уточняется");
  });
});
