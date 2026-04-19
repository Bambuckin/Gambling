import type { ReactElement } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdminAccess, submitLogout } from "../../lib/access/entry-flow";
import { getDrawRefreshService } from "../../lib/draw/draw-runtime";
import { AdminAutoRefresh } from "../../lib/purchase/admin-auto-refresh";
import { AdminDrawMonitor } from "../../lib/purchase/admin-draw-monitor";
import { listMockTerminalInboxRows } from "../../lib/purchase/mock-terminal-inbox";
import {
  getAdminOperationsQueryService,
  getAdminQueueService,
  getAdminTestResetService,
  getDrawClosureService,
  getPurchaseRuntimeStores
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
  const [operationsSnapshot, queueSnapshot, terminalRows] = await Promise.all([
    getAdminOperationsQueryService().getSnapshot(),
    getAdminQueueService().getQueueSnapshot(),
    listMockTerminalInboxRows()
  ]);

  const resolvedSearchParams = await searchParams;
  const status = readSingleParam(resolvedSearchParams.status);
  const statusMessage = readSingleParam(resolvedSearchParams.message);

  return (
    <section className="page-column">
      <AdminAutoRefresh intervalMs={3_000} />

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
            <span className="value">{formatTerminalState(operationsSnapshot.terminal.state)}</span>
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
                    <td>{formatQueueStatus(row.status)}</td>
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
                    <td>{formatRequestState(row.state)}</td>
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

async function adminMarkTicketAction(ticketId: string, mark: "win" | "lose"): Promise<void> {
  "use server";

  const access = await requireAdminAccess("/admin");
  await getDrawClosureService().markTicketResult({
    ticketId,
    mark,
    markedBy: access.identity.identityId
  });
}

async function adminCloseDrawAction(lotteryCode: string, drawId: string): Promise<void> {
  "use server";

  const access = await requireAdminAccess("/admin");
  const result = await getDrawClosureService().closeDraw({
    lotteryCode,
    drawId,
    closedBy: access.identity.identityId
  });

  if (result.alreadyClosed) {
    throw new Error(`Тираж ${drawId} уже закрыт.`);
  }
}

async function adminDeleteDrawAction(lotteryCode: string, drawId: string): Promise<string> {
  "use server";

  await requireAdminAccess("/admin");

  const [tickets, requests, closure] = await Promise.all([
    getTicketQueryService().listAllTickets(),
    getPurchaseRuntimeStores().requestStore.listRequests(),
    getDrawClosureService().getDrawClosure(lotteryCode, drawId)
  ]);

  if (tickets.some((ticket) => ticket.lotteryCode === lotteryCode && ticket.drawId === drawId)) {
    throw new Error(`Тираж ${drawId} нельзя удалить, пока по нему есть купленные билеты.`);
  }

  if (
    requests.some(
      (request) =>
        request.snapshot.lotteryCode === lotteryCode &&
        request.snapshot.drawId === drawId &&
        request.state !== "canceled" &&
        request.state !== "reserve_released"
    )
  ) {
    throw new Error(`Тираж ${drawId} нельзя удалить, пока по нему есть активные заявки.`);
  }

  const removed = await getDrawRefreshService().removeDraw(lotteryCode, drawId);
  await getDrawClosureService().deleteDraw(lotteryCode, drawId);

  if (!removed && !closure) {
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
  await getAdminTestResetService().resetTestData();
  return "Тестовый runtime полностью очищен.";
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

function formatTerminalState(state: string): string {
  switch (state) {
    case "idle":
      return "Свободен";
    case "executing":
      return "Обрабатывает заявку";
    case "error":
      return "Ошибка";
    default:
      return state;
  }
}

function formatQueueStatus(status: string): string {
  switch (status) {
    case "queued":
      return "В очереди";
    case "executing":
      return "Исполняется";
    default:
      return status;
  }
}

function formatRequestState(state: string): string {
  switch (state) {
    case "queued":
      return "В очереди";
    case "executing":
      return "Исполняется";
    case "added_to_cart":
      return "Добавлен в корзину";
    case "success":
      return "Успешно";
    case "retrying":
      return "Повтор";
    case "error":
      return "Ошибка";
    default:
      return state;
  }
}
