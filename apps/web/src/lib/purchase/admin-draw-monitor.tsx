"use client";

import { useCallback, useEffect, useState, type ReactElement } from "react";

interface AdminDrawTicket {
  readonly ticketId: string;
  readonly requestId: string;
  readonly userId: string;
  readonly verificationStatus: "pending" | "verified" | "failed";
  readonly purchasedAt: string;
  readonly adminResultMark: "win" | "lose" | null;
  readonly winningAmountMinor: number | null;
  readonly resultSource: "terminal" | "admin_emulated" | null;
  readonly externalReference: string | null;
}

interface AdminDraw {
  readonly lotteryCode: string;
  readonly drawId: string;
  readonly drawAt: string;
  readonly fetchedAt: string;
  readonly status: "open" | "closed";
  readonly closedAt: string | null;
  readonly tickets: readonly AdminDrawTicket[];
}

interface AdminDrawsResponse {
  readonly fetchedAt: string;
  readonly draws: readonly AdminDraw[];
}

interface AdminDrawMonitorProps {
  readonly onMarkTicket: (ticketId: string, mark: "win" | "lose") => Promise<void>;
  readonly onCloseDraw: (lotteryCode: string, drawId: string) => Promise<void>;
  readonly onDeleteDraw: (lotteryCode: string, drawId: string) => Promise<string>;
  readonly onClearQueue: () => Promise<string>;
  readonly onResetAll: () => Promise<string>;
}

const REFRESH_INTERVAL_MS = 3_000;

export function AdminDrawMonitor(props: AdminDrawMonitorProps): ReactElement {
  const [draws, setDraws] = useState<readonly AdminDraw[]>([]);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [cleaningQueue, setCleaningQueue] = useState(false);
  const [resettingAll, setResettingAll] = useState(false);
  const [newLottery, setNewLottery] = useState("bolshaya-8");
  const [newDrawId, setNewDrawId] = useState("");
  const [newDrawAt, setNewDrawAt] = useState("");

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch("/api/admin/draws", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`status=${response.status}`);
      }

      const payload = (await response.json()) as AdminDrawsResponse;
      setDraws(payload.draws);
      setFetchedAt(payload.fetchedAt);
      setError(null);
    } catch (refreshError) {
      const message = refreshError instanceof Error ? refreshError.message : String(refreshError);
      setError(message);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const wrappedRefresh = async (): Promise<void> => {
      if (cancelled) {
        return;
      }

      await refresh();
    };

    void wrappedRefresh();
    const intervalId = window.setInterval(() => {
      void wrappedRefresh();
    }, REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [refresh]);

  const handleMark = async (ticketId: string, mark: "win" | "lose"): Promise<void> => {
    setActionError(null);
    setActionMessage(null);

    try {
      await props.onMarkTicket(ticketId, mark);
      setActionMessage(mark === "win" ? "Билет помечен как выигрышный." : "Билет помечен как проигрышный.");
      await refresh();
    } catch (actionFailure) {
      setActionError(actionFailure instanceof Error ? actionFailure.message : String(actionFailure));
    }
  };

  const handleClose = async (lotteryCode: string, drawId: string): Promise<void> => {
    const confirmed = window.confirm("Закрыть тираж? Все непомеченные билеты уйдут в проигрыш.");
    if (!confirmed) {
      return;
    }

    setActionError(null);
    setActionMessage(null);

    try {
      await props.onCloseDraw(lotteryCode, drawId);
      setActionMessage(`Тираж ${drawId} закрыт.`);
      await refresh();
    } catch (actionFailure) {
      setActionError(actionFailure instanceof Error ? actionFailure.message : String(actionFailure));
    }
  };

  const handleCreate = async (): Promise<void> => {
    if (!newLottery || !newDrawId || !newDrawAt) {
      return;
    }

    setCreating(true);
    setActionError(null);
    setActionMessage(null);

    try {
      const response = await fetch("/api/admin/draws", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          lotteryCode: newLottery,
          drawId: newDrawId,
          drawAt: newDrawAt,
          freshnessTtlSeconds: 3600
        })
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Не удалось создать тираж.");
      }

      setActionMessage(`Тираж ${newDrawId} создан.`);
      setNewDrawId("");
      setNewDrawAt("");
      await refresh();
    } catch (actionFailure) {
      setActionError(actionFailure instanceof Error ? actionFailure.message : String(actionFailure));
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (lotteryCode: string, drawId: string): Promise<void> => {
    const confirmed = window.confirm(`Удалить тираж ${drawId}? Удаление разрешено только для пустого тестового тиража.`);
    if (!confirmed) {
      return;
    }

    setActionError(null);
    setActionMessage(null);

    try {
      const message = await props.onDeleteDraw(lotteryCode, drawId);
      setActionMessage(message);
      await refresh();
    } catch (actionFailure) {
      setActionError(actionFailure instanceof Error ? actionFailure.message : String(actionFailure));
    }
  };

  const handleClearQueue = async (): Promise<void> => {
    const confirmed = window.confirm("Очистить текущую очередь и снять зависшие pending-заявки?");
    if (!confirmed) {
      return;
    }

    setCleaningQueue(true);
    setActionError(null);
    setActionMessage(null);

    try {
      const message = await props.onClearQueue();
      setActionMessage(message);
      await refresh();
    } catch (actionFailure) {
      setActionError(actionFailure instanceof Error ? actionFailure.message : String(actionFailure));
    } finally {
      setCleaningQueue(false);
    }
  };

  const handleResetAll = async (): Promise<void> => {
    const confirmed = window.confirm(
      "Полностью очистить тестовый runtime? Это удалит тиражи, очередь, билеты, уведомления и историю тестового контура."
    );
    if (!confirmed) {
      return;
    }

    setResettingAll(true);
    setActionError(null);
    setActionMessage(null);

    try {
      const message = await props.onResetAll();
      setActionMessage(message);
      await refresh();
    } catch (actionFailure) {
      setActionError(actionFailure instanceof Error ? actionFailure.message : String(actionFailure));
    } finally {
      setResettingAll(false);
    }
  };

  const openDraws = draws.filter((draw) => draw.status === "open");
  const closedDraws = draws.filter((draw) => draw.status === "closed");

  return (
    <article className="panel">
      <h2>Управление тиражами</h2>
      <p className={`alert-row ${error ? "warn" : "ok"}`}>
        {error ? `Ошибка загрузки: ${error}` : `Обновлено: ${formatIso(fetchedAt) ?? "сейчас"}`}
      </p>
      {actionError ? <p className="alert-row error">{actionError}</p> : null}
      {actionMessage ? <p className="alert-row ok">{actionMessage}</p> : null}

      <details style={{ marginBottom: "1rem" }}>
        <summary>
          <strong>Тестовая очистка</strong>
        </summary>

        <p className="muted" style={{ marginTop: "0.75rem" }}>
          Эти действия нужны только для локальных прогонов: можно снять зависшие заявки, удалить пустые тиражи и сбросить test runtime целиком.
        </p>

        <div className="actions-row" style={{ marginTop: "0.75rem" }}>
          <button type="button" onClick={() => void handleClearQueue()} disabled={cleaningQueue || resettingAll}>
            {cleaningQueue ? "Очистка..." : "Очистить очередь"}
          </button>
          <button
            type="button"
            className="btn-danger"
            onClick={() => void handleResetAll()}
            disabled={resettingAll || cleaningQueue}
          >
            {resettingAll ? "Сброс..." : "Сбросить весь runtime"}
          </button>
        </div>
      </details>

      <details open style={{ marginBottom: "1rem" }}>
        <summary>
          <strong>Создать тираж вручную</strong>
        </summary>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void handleCreate();
          }}
          style={{
            display: "flex",
            gap: "0.75rem",
            flexWrap: "wrap",
            alignItems: "end",
            marginTop: "0.75rem"
          }}
        >
          <div>
            <label>
              <small>Лотерея</small>
            </label>
            <select value={newLottery} onChange={(event) => setNewLottery(event.target.value)}>
              <option value="bolshaya-8">Большая 8</option>
              <option value="mechtallion">Мечталлион</option>
              <option value="velikolepnaya-8">Великолепная 8</option>
              <option value="super-8">Супер 8</option>
              <option value="top-12">Топ 12</option>
            </select>
          </div>

          <div>
            <label>
              <small>ID тиража</small>
            </label>
            <input
              value={newDrawId}
              onChange={(event) => setNewDrawId(event.target.value)}
              placeholder="draw-001"
              required
            />
          </div>

          <div>
            <label>
              <small>Дата и время</small>
            </label>
            <input
              type="datetime-local"
              value={newDrawAt}
              onChange={(event) => setNewDrawAt(event.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn-primary" disabled={creating || !newDrawId || !newDrawAt}>
            {creating ? "Создание..." : "Создать тираж"}
          </button>
        </form>
      </details>

      <h3>Открытые тиражи ({openDraws.length})</h3>
      {openDraws.length === 0 ? (
        <p className="muted">Открытых тиражей нет.</p>
      ) : (
        openDraws.map((draw) => (
          <DrawSection
            key={`${draw.lotteryCode}:${draw.drawId}`}
            draw={draw}
            onMark={handleMark}
            onClose={handleClose}
            onDelete={handleDelete}
          />
        ))
      )}

      {closedDraws.length > 0 ? (
        <>
          <h3>Закрытые тиражи ({closedDraws.length})</h3>
          {closedDraws.map((draw) => (
            <DrawSection
              key={`${draw.lotteryCode}:${draw.drawId}`}
              draw={draw}
              onMark={handleMark}
              onClose={handleClose}
              onDelete={handleDelete}
            />
          ))}
        </>
      ) : null}
    </article>
  );
}

function DrawSection(props: {
  readonly draw: AdminDraw;
  readonly onMark: (ticketId: string, mark: "win" | "lose") => Promise<void>;
  readonly onClose: (lotteryCode: string, drawId: string) => Promise<void>;
  readonly onDelete: (lotteryCode: string, drawId: string) => Promise<void>;
}): ReactElement {
  const { draw, onMark, onClose, onDelete } = props;

  return (
    <section
      style={{
        marginBottom: "1rem",
        padding: "0.85rem",
        border: "1px solid #ddd",
        borderRadius: "8px"
      }}
    >
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
          <h4 style={{ margin: 0 }}>
            {draw.lotteryCode} / <code>{draw.drawId}</code>
          </h4>
          <p className="muted" style={{ margin: "0.35rem 0 0" }}>
            Тираж: {formatIso(draw.drawAt) ?? draw.drawAt}
            {draw.closedAt ? ` | Закрыт: ${formatIso(draw.closedAt)}` : ""}
          </p>
        </div>

        <div className="actions-row">
          <span className={`badge ${draw.status === "closed" ? "success" : "warning"}`}>
            {draw.status === "closed" ? "Закрыт" : "Открыт"}
          </span>
          <button
            type="button"
            onClick={() => {
              void onDelete(draw.lotteryCode, draw.drawId);
            }}
          >
            Удалить тираж
          </button>
          {draw.status === "open" ? (
            <button
              type="button"
              className="btn-danger"
              onClick={() => {
                void onClose(draw.lotteryCode, draw.drawId);
              }}
            >
              Закрыть тираж
            </button>
          ) : null}
        </div>
      </div>

      {draw.tickets.length === 0 ? (
        <p className="muted" style={{ marginTop: "0.75rem" }}>
          Билетов по этому тиражу пока нет.
        </p>
      ) : (
        <div className="table-wrap" style={{ marginTop: "0.75rem" }}>
          <table>
            <thead>
              <tr>
                <th>Билет</th>
                <th>Заявка</th>
                <th>Пользователь</th>
                <th>Куплен</th>
                <th>Проверка</th>
                <th>Пометка до закрытия</th>
                <th>Итог</th>
                {draw.status === "open" ? <th>Действие</th> : null}
              </tr>
            </thead>
            <tbody>
              {draw.tickets.map((ticket) => (
                <tr key={ticket.ticketId}>
                  <td className="mono">{ticket.ticketId}</td>
                  <td className="mono">{ticket.requestId}</td>
                  <td>{ticket.userId}</td>
                  <td>{formatIso(ticket.purchasedAt)}</td>
                  <td>{formatVerificationStatus(ticket.verificationStatus)}</td>
                  <td>{formatAdminMark(ticket.adminResultMark)}</td>
                  <td>{formatTicketOutcome(ticket)}</td>
                  {draw.status === "open" ? (
                    <td>
                      <div className="actions-row">
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={() => {
                            void onMark(ticket.ticketId, "win");
                          }}
                        >
                          Выигрыш
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void onMark(ticket.ticketId, "lose");
                          }}
                        >
                          Проигрыш
                        </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function formatIso(value: string | null | undefined): string | null {
  if (!value) {
    return null;
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

function formatVerificationStatus(status: AdminDrawTicket["verificationStatus"]): string {
  switch (status) {
    case "pending":
      return "Ожидает закрытия";
    case "verified":
      return "Проверен";
    case "failed":
      return "Ошибка проверки";
    default:
      return status;
  }
}

function formatAdminMark(mark: AdminDrawTicket["adminResultMark"]): string {
  if (mark === "win") {
    return "Выигрыш";
  }

  if (mark === "lose") {
    return "Проигрыш";
  }

  return "Не задана";
}

function formatTicketOutcome(ticket: AdminDrawTicket): string {
  if (ticket.verificationStatus === "pending") {
    return ticket.adminResultMark === "win"
      ? "Будет выигрышным"
      : ticket.adminResultMark === "lose"
        ? "Будет проигрышным"
        : "Ещё не решён";
  }

  if (ticket.verificationStatus === "failed") {
    return "Проверка завершилась ошибкой";
  }

  if ((ticket.winningAmountMinor ?? 0) > 0) {
    return `Выигрыш ${formatMinorAsRub(ticket.winningAmountMinor ?? 0)}`;
  }

  if (ticket.resultSource === "admin_emulated") {
    return "Проигрыш по решению администратора";
  }

  return "Проигрыш";
}

function formatMinorAsRub(amountMinor: number): string {
  const amount = amountMinor / 100;
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}
