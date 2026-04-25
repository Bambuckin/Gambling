import type { ReactElement } from "react";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminUserService } from "../../lib/access/access-runtime";
import { requireAdminAccess, submitLogout } from "../../lib/access/entry-flow";
import { getDrawRefreshService } from "../../lib/draw/draw-runtime";
import { getOperationsAlertService, getOperationsAuditService } from "../../lib/observability/operations-runtime";
import {
  formatAdminAuditAction,
  formatAdminAuditDomain,
  formatAdminAuditSeverity,
  formatAdminAuditTarget,
  formatAdminCashDeskStatus,
  formatAdminOperationsReference,
  formatAdminQueueStatus,
  formatAdminReceiverState,
  formatAdminTerminalState,
  formatAdminWinningsCreditStatus,
  presentAdminAlert
} from "../../lib/purchase/admin-status-presenter";
import { AdminAutoRefresh } from "../../lib/purchase/admin-auto-refresh";
import { AdminDrawMonitor } from "../../lib/purchase/admin-draw-monitor";
import { listMockTerminalInboxRows } from "../../lib/purchase/mock-terminal-inbox";
import {
  getAdminOperationsQueryService,
  getAdminManualFinanceService,
  getAdminQueueService,
  getAdminTestResetService,
  getCashDeskService,
  getDrawClosureService,
  getPurchaseRequestQueryService,
  getWinningsCreditService
} from "../../lib/purchase/purchase-runtime";
import { getTicketQueryService } from "../../lib/ticket/ticket-runtime";

type AdminPageProps = {
  readonly searchParams: Promise<{
    readonly status?: string | string[];
    readonly message?: string | string[];
  }>;
};

export default async function AdminPage({ searchParams }: AdminPageProps): Promise<ReactElement> {
  const access = await requireAdminAccess("/admin");
  const [operationsSnapshot, queueSnapshot, terminalRows, cashDeskRequests, winningsCreditJobs, alerts, auditEvents, adminUsers] = await Promise.all([
    getAdminOperationsQueryService().getSnapshot(),
    getAdminQueueService().getQueueSnapshot(),
    listMockTerminalInboxRows(),
    getCashDeskService().listCashDeskRequests(),
    getWinningsCreditService().listJobs(),
    getOperationsAlertService().listActiveAlerts(),
    getOperationsAuditService().listEvents({ limit: 10 }),
    getAdminUserService().listUsers()
  ]);
  const userBalances = await getAdminManualFinanceService().listUserBalances({
    userIds: adminUsers.map((user) => user.identityId),
    currency: "RUB"
  });
  const balanceByUserId = new Map(userBalances.map((balance) => [balance.userId, balance] as const));

  const resolvedSearchParams = await searchParams;
  const status = readSingleParam(resolvedSearchParams.status);
  const statusMessage = readSingleParam(resolvedSearchParams.message);

  return (
    <section className="page-column">
      <AdminAutoRefresh intervalMs={5_000} />

      <article className="panel">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "1rem",
            flexWrap: "wrap"
          }}
        >
          <div>
            <h1 style={{ marginBottom: "0.5rem" }}>Админ-панель</h1>
            <p className="muted" style={{ margin: 0 }}>
              Оператор: <strong>{access.identity.displayName}</strong>. Экран обновляется автоматически.
            </p>
          </div>

          <div className="actions-row">
            <Link className="btn-ghost" href="/terminal/receiver">
              Экран терминала
            </Link>
            <form action={logoutFromAdminAction}>
              <button type="submit">Выйти</button>
            </form>
          </div>
        </div>

        {status && statusMessage ? <p className={`alert-row ${status === "error" ? "error" : "ok"}`}>{statusMessage}</p> : null}
      </article>

      <article className="panel">
        <h2>Сейчас в системе</h2>
        <div className="mini-grid">
          <article className="mini-stat">
            <span className="label">Терминал</span>
            <span className="value">{formatAdminTerminalState(operationsSnapshot.terminal.state)}</span>
          </article>
          <article className="mini-stat">
            <span className="label">Очередь</span>
            <span className="value">{operationsSnapshot.queue.queueDepth}</span>
          </article>
          <article className="mini-stat">
            <span className="label">В работе</span>
            <span className="value">{queueSnapshot.activeExecutionRequestId ?? "Нет"}</span>
          </article>
          <article className="mini-stat">
            <span className="label">В очереди / исполняется</span>
            <span className="value">
              {operationsSnapshot.queue.queuedCount} / {operationsSnapshot.queue.executingCount}
            </span>
          </article>
          <article className="mini-stat">
            <span className="label">Ошибок подряд</span>
            <span className="value">{operationsSnapshot.terminal.consecutiveFailures}</span>
          </article>
          <article className="mini-stat">
            <span className="label">Последняя проверка</span>
            <span className="value">{formatIso(operationsSnapshot.terminal.checkedAt)}</span>
          </article>
        </div>
      </article>

      <article className="panel">
        <h2>Балансы пользователей</h2>
        <p className="muted">Доступные и зарезервированные суммы считаются по ledger. Ручная корректировка добавляет отдельную аудируемую запись.</p>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Пользователь</th>
                <th>Логин</th>
                <th>Роль</th>
                <th>На счету</th>
                <th>В резерве</th>
                <th>Последняя операция</th>
                <th>Корректировка</th>
              </tr>
            </thead>
            <tbody>
              {adminUsers.map((user) => {
                const balance = balanceByUserId.get(user.identityId);

                return (
                  <tr key={user.identityId}>
                    <td>
                      <strong>{user.displayName}</strong>
                      <br />
                      <span className="mono">{user.identityId}</span>
                    </td>
                    <td>{user.login}</td>
                    <td>{formatRole(user.role)}</td>
                    <td>{formatMinorAsRub(balance?.availableMinor ?? 0, balance?.currency ?? "RUB")}</td>
                    <td>{formatMinorAsRub(balance?.reservedMinor ?? 0, balance?.currency ?? "RUB")}</td>
                    <td>{formatIso(balance?.lastLedgerAt)}</td>
                    <td>
                      <form action={adminAdjustUserBalanceAction} className="actions-row">
                        <input type="hidden" name="userId" value={user.identityId} />
                        <select name="operation" defaultValue="manual_credit" aria-label="Тип корректировки">
                          <option value="manual_credit">Пополнить</option>
                          <option value="manual_debit">Списать</option>
                        </select>
                        <input
                          name="amountRub"
                          type="number"
                          min="0.01"
                          step="0.01"
                          placeholder="100.00"
                          aria-label="Сумма"
                          required
                          style={{ width: "7rem" }}
                        />
                        <input
                          name="reason"
                          placeholder="Причина"
                          aria-label="Причина"
                          required
                          style={{ minWidth: "10rem" }}
                        />
                        <button type="submit">Применить</button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </article>

      <article className="panel">
        <h2>Очередь покупок</h2>
        <p className="muted">Здесь появляются заявки, пока их ещё не забрал главный терминал.</p>

        {queueSnapshot.rows.length === 0 ? (
          <p className="muted">Очередь пока пустая.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Заявка</th>
                  <th>Пользователь</th>
                  <th>Лотерея</th>
                  <th>Тираж</th>
                  <th>Статус</th>
                  <th>Попыток</th>
                  <th>Добавлена</th>
                </tr>
              </thead>
              <tbody>
                {queueSnapshot.rows.map((row) => (
                  <tr key={row.requestId}>
                    <td className="mono">{row.requestId}</td>
                    <td>{row.userId}</td>
                    <td>{row.lotteryCode}</td>
                    <td>{row.drawId}</td>
                    <td>{formatAdminQueueStatus(row.status)}</td>
                    <td>{row.attemptCount}</td>
                    <td>{formatIso(row.enqueuedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>

      <article className="panel">
        <h2>Терминал и последние заявки</h2>
        <p className="muted">Даже если очередь уже разобрана, здесь видно, что билет дошёл до терминала и в каком он состоянии.</p>

        {terminalRows.length === 0 ? (
          <p className="muted">Терминал пока не получил ни одной заявки.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Заявка</th>
                  <th>Тираж</th>
                  <th>Статус</th>
                  <th>Билетов</th>
                  <th>Попыток</th>
                  <th>Обновлено</th>
                </tr>
              </thead>
              <tbody>
                {terminalRows.map((row) => (
                  <tr key={row.requestId}>
                    <td className="mono">{row.requestId}</td>
                    <td>{row.drawId}</td>
                    <td>{formatAdminReceiverState(row.state)}</td>
                    <td>{row.ticketCount}</td>
                    <td>{row.attemptCount}</td>
                    <td>{formatIso(row.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>

      <article className="panel">
        <h2>Кассовые выплаты</h2>
        {cashDeskRequests.length === 0 ? (
          <p className="muted">Кассовых выплат пока нет.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Заявка</th>
                  <th>Покупка</th>
                  <th>Тираж</th>
                  <th>Сумма</th>
                  <th>Статус</th>
                  <th>Создана</th>
                  <th>Действие</th>
                </tr>
              </thead>
              <tbody>
                {cashDeskRequests.map((request) => (
                  <tr key={request.cashDeskRequestId}>
                    <td className="mono">{request.requestId}</td>
                    <td className="mono">{request.purchaseId}</td>
                    <td>{request.drawId}</td>
                    <td>{formatMinorAsRub(request.winningAmountMinor, request.currency)}</td>
                    <td>{formatAdminCashDeskStatus(request.status)}</td>
                    <td>{formatIso(request.createdAt)}</td>
                    <td>
                      {request.status === "paid" ? (
                        <span className="muted">закрыта</span>
                      ) : (
                        <form action={adminPayCashDeskRequestAction}>
                          <input type="hidden" name="cashDeskRequestId" value={request.cashDeskRequestId} />
                          <button type="submit">Выдать</button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>

      <article className="panel">
        <h2>Зачисления выигрышей</h2>
        {winningsCreditJobs.length === 0 ? (
          <p className="muted">Заданий на зачисление пока нет.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Заявка</th>
                  <th>Покупка</th>
                  <th>Билет</th>
                  <th>Сумма</th>
                  <th>Статус</th>
                  <th>Создано</th>
                  <th>Обработано</th>
                </tr>
              </thead>
              <tbody>
                {winningsCreditJobs.map((job) => (
                  <tr key={job.jobId}>
                    <td className="mono">{job.requestId}</td>
                    <td className="mono">{job.purchaseId}</td>
                    <td className="mono">{job.ticketId}</td>
                    <td>{formatMinorAsRub(job.winningAmountMinor, job.currency)}</td>
                    <td>{formatAdminWinningsCreditStatus(job.status, job.lastError)}</td>
                    <td>{formatIso(job.createdAt)}</td>
                    <td>{formatIso(job.processedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>

      <article className="panel">
        <h2>Сигналы и аудит</h2>
        {alerts.length === 0 ? (
          <p className="muted">Активных сигналов сейчас нет.</p>
        ) : (
          <div className="page-column">
            {alerts.map((alert) => {
              const presentedAlert = presentAdminAlert(alert);

              return (
                <article key={alert.alertId} className="panel" style={{ padding: "0.9rem 1rem" }}>
                  <p style={{ margin: 0, fontWeight: 700 }}>
                    {presentedAlert.severityLabel}: {presentedAlert.title}
                  </p>
                  <p className="muted" style={{ marginBottom: "0.3rem" }}>
                    {presentedAlert.description}
                  </p>
                  <p className="muted" style={{ margin: 0 }}>
                    Ссылки: {presentedAlert.referenceLabel} | Обнаружено: {formatIso(alert.detectedAt)}
                  </p>
                </article>
              );
            })}
          </div>
        )}

        <div style={{ marginTop: "1rem" }}>
          <h3 style={{ marginBottom: "0.5rem" }}>Последние события</h3>
          {auditEvents.length === 0 ? (
            <p className="muted">Операционных записей аудита пока нет.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Домен</th>
                    <th>Действие</th>
                    <th>Уровень</th>
                    <th>Цель</th>
                    <th>Контекст</th>
                    <th>Время</th>
                  </tr>
                </thead>
                <tbody>
                  {auditEvents.map((event) => (
                    <tr key={event.eventId}>
                      <td>{formatAdminAuditDomain(event.domain)}</td>
                      <td>{formatAdminAuditAction(event.action)}</td>
                      <td>{formatAdminAuditSeverity(event.severity)}</td>
                      <td>{formatAdminAuditTarget(event.target)}</td>
                      <td>{formatAdminOperationsReference(event.reference)}</td>
                      <td>{formatIso(event.occurredAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </article>

      <AdminDrawMonitor
        onMarkTicket={adminMarkTicketAction}
        onCloseDraw={adminCloseDrawAction}
        onDeleteDraw={adminDeleteDrawAction}
        onClearQueue={adminClearQueueAction}
        onResetAll={adminResetAllAction}
      />
    </section>
  );
}

async function logoutFromAdminAction(): Promise<void> {
  "use server";

  await submitLogout();
  redirect("/login");
}

async function adminPayCashDeskRequestAction(formData: FormData): Promise<void> {
  "use server";

  const access = await requireAdminAccess("/admin");
  const cashDeskRequestId = String(formData.get("cashDeskRequestId") ?? "").trim();
  if (!cashDeskRequestId) {
    return redirect(`/admin?status=error&message=${encodeURIComponent("Нужен cashDeskRequestId для выплаты.")}`);
  }

  try {
    await getCashDeskService().payCashDeskRequest(
      cashDeskRequestId,
      access.identity.identityId,
      new Date().toISOString()
    );
    return redirect(`/admin?status=ok&message=${encodeURIComponent(`Кассовая выплата ${cashDeskRequestId} отмечена как выданная.`)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось отметить кассовую выплату.";
    return redirect(`/admin?status=error&message=${encodeURIComponent(message)}`);
  }
}

async function adminAdjustUserBalanceAction(formData: FormData): Promise<void> {
  "use server";

  const access = await requireAdminAccess("/admin");
  const userId = String(formData.get("userId") ?? "").trim();
  const operation = readManualFinanceOperation(formData.get("operation"));
  const amountMinor = parseRubAmountToMinor(formData.get("amountRub"));
  const reason = String(formData.get("reason") ?? "").trim();

  if (!userId || !operation || amountMinor === null || !reason) {
    return redirect(`/admin?status=error&message=${encodeURIComponent("Заполните пользователя, тип операции, сумму и причину корректировки.")}`);
  }

  try {
    await getAdminManualFinanceService().performAdjustment({
      adjustmentId: `manual:${randomUUID()}`,
      userId,
      operation,
      amountMinor,
      currency: "RUB",
      reason,
      performedBy: access.identity.identityId
    });
    return redirect(`/admin?status=ok&message=${encodeURIComponent(`Баланс пользователя ${userId} скорректирован.`)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось скорректировать баланс.";
    return redirect(`/admin?status=error&message=${encodeURIComponent(message)}`);
  }
}

async function adminMarkTicketAction(requestId: string, mark: "win" | "lose"): Promise<void> {
  "use server";

  const access = await requireAdminAccess("/admin");
  await getDrawClosureService().markTicketResult({
    requestId,
    mark,
    markedBy: access.identity.identityId
  });
}

async function adminCloseDrawAction(lotteryCode: string, drawId: string, drawAt: string): Promise<void> {
  "use server";

  const access = await requireAdminAccess("/admin");
  const result = await getDrawClosureService().closeDraw({
    lotteryCode,
    drawId,
    drawAt,
    closedBy: access.identity.identityId
  });

  if (result.alreadyClosed) {
    throw new Error(`Тираж ${drawId} уже закрыт.`);
  }
}

async function adminDeleteDrawAction(lotteryCode: string, drawId: string): Promise<string> {
  "use server";

  await requireAdminAccess("/admin");

  const [tickets, requests, draw] = await Promise.all([
    getTicketQueryService().listAllTickets(),
    getPurchaseRequestQueryService().listRequestsByDraw(lotteryCode, drawId),
    getDrawClosureService().getDraw(lotteryCode, drawId)
  ]);

  if (tickets.some((ticket) => ticket.lotteryCode === lotteryCode && ticket.drawId === drawId)) {
    throw new Error(`Тираж ${drawId} нельзя удалить, пока по нему есть купленные билеты.`);
  }

  if (
    requests.some(
      (request) =>
        request.status !== "canceled" &&
        request.status !== "reserve_released"
    )
  ) {
    throw new Error(`Тираж ${drawId} нельзя удалить, пока по нему есть активные заявки.`);
  }

  const removed = await getDrawRefreshService().removeDraw(lotteryCode, drawId);
  await getDrawClosureService().deleteDraw(lotteryCode, drawId);

  if (!removed && !draw) {
    throw new Error(`Тираж ${drawId} не найден.`);
  }

  return `Тираж ${drawId} удалён.`;
}

async function adminClearQueueAction(): Promise<string> {
  "use server";

  await requireAdminAccess("/admin");
  const result = await getAdminTestResetService().clearQueue();
  return `Очередь очищена: ${result.removedQueueItems}, резервов освобождено: ${result.releasedReserves}, заявок обновлено: ${result.updatedRequests}.`;
}

async function adminResetAllAction(): Promise<string> {
  "use server";

  await requireAdminAccess("/admin");
  const result = await getAdminTestResetService().resetTestData();
  return `Тестовый runtime очищен: тиражи удалены, очередь очищена, записей баланса восстановлено ${result.restoredSeedLedgerEntries}.`;
}

function readManualFinanceOperation(value: FormDataEntryValue | null): "manual_credit" | "manual_debit" | null {
  return value === "manual_credit" || value === "manual_debit" ? value : null;
}

function parseRubAmountToMinor(value: FormDataEntryValue | null): number | null {
  const normalized = String(value ?? "").trim().replace(",", ".");
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  const amountMinor = Math.round(parsed * 100);
  return amountMinor > 0 ? amountMinor : null;
}

function formatRole(role: "admin" | "user"): string {
  return role === "admin" ? "Админ" : "Клиент";
}

function readSingleParam(value: string | string[] | undefined): string | null {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return null;
}

function formatMinorAsRub(amountMinor: number, currency = "RUB"): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amountMinor / 100);
}

function formatIso(value: string | null | undefined): string {
  if (!value) {
    return "Нет";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}
