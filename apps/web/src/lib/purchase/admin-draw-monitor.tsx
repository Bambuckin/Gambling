"use client";

import { useCallback, useEffect, useState, type ReactElement } from "react";
import {
  formatAdminDrawMark,
  formatAdminDrawStatus,
  formatAdminDrawTicketOutcome,
  formatAdminDrawVerificationStatus,
  resolveAdminDrawBadgeClass
} from "./admin-status-presenter";

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
  readonly status: "open" | "closed" | "settled";
  readonly closedAt: string | null;
  readonly settledAt: string | null;
  readonly tickets: readonly AdminDrawTicket[];
}

interface AdminDrawsResponse {
  readonly fetchedAt: string;
  readonly draws: readonly AdminDraw[];
}

interface AdminDrawMonitorProps {
  readonly onMarkTicket: (requestId: string, mark: "win" | "lose") => Promise<void>;
  readonly onCloseDraw: (lotteryCode: string, drawId: string, drawAt: string) => Promise<void>;
  readonly onDeleteDraw: (lotteryCode: string, drawId: string) => Promise<string>;
  readonly onClearQueue: () => Promise<string>;
  readonly onResetAll: () => Promise<string>;
}

const REFRESH_INTERVAL_MS = 5_000;
const drawCreateFieldStyle = { minWidth: 0 };
const drawCreateControlStyle = { width: "100%" };
const CONFIRM_CLOSE_DRAW =
  "\u0417\u0430\u043a\u0440\u044b\u0442\u044c \u0442\u0438\u0440\u0430\u0436 \u0438 \u0441\u0440\u0430\u0437\u0443 \u043e\u043f\u0443\u0431\u043b\u0438\u043a\u043e\u0432\u0430\u0442\u044c \u0440\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442\u044b \u0434\u043b\u044f \u043a\u043b\u0438\u0435\u043d\u0442\u043e\u0432? \u041f\u043e\u0441\u043b\u0435 \u044d\u0442\u043e\u0433\u043e \u0441\u043f\u0438\u0441\u043e\u043a \u0431\u0438\u043b\u0435\u0442\u043e\u0432 \u0438 \u043e\u0442\u043c\u0435\u0442\u043a\u0438 \u043f\u043e \u0442\u0438\u0440\u0430\u0436\u0443 \u043c\u0435\u043d\u044f\u0442\u044c \u043d\u0435\u043b\u044c\u0437\u044f.";
const CONFIRM_CLEAR_QUEUE =
  "\u041e\u0447\u0438\u0441\u0442\u0438\u0442\u044c \u043e\u0447\u0435\u0440\u0435\u0434\u044c \u0438 \u0441\u043d\u044f\u0442\u044c \u0437\u0430\u0432\u0438\u0441\u0448\u0438\u0435 pending-\u0437\u0430\u044f\u0432\u043a\u0438?";
const CONFIRM_RESET_RUNTIME =
  "\u041f\u043e\u043b\u043d\u043e\u0441\u0442\u044c\u044e \u043e\u0447\u0438\u0441\u0442\u0438\u0442\u044c \u0442\u0435\u0441\u0442\u043e\u0432\u044b\u0439 runtime? \u042d\u0442\u043e \u0443\u0434\u0430\u043b\u0438\u0442 \u0442\u0438\u0440\u0430\u0436\u0438, \u043e\u0447\u0435\u0440\u0435\u0434\u044c, \u0431\u0438\u043b\u0435\u0442\u044b, \u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u044f \u0438 \u0438\u0441\u0442\u043e\u0440\u0438\u044e \u0442\u0435\u0441\u0442\u043e\u0432\u043e\u0433\u043e \u043a\u043e\u043d\u0442\u0443\u0440\u0430.";

function confirmDeleteDrawText(drawId: string): string {
  return `\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u0442\u0438\u0440\u0430\u0436 ${drawId}? \u0420\u0430\u0437\u0440\u0435\u0448\u0435\u043d\u043e \u0442\u043e\u043b\u044c\u043a\u043e \u0434\u043b\u044f \u043f\u0443\u0441\u0442\u043e\u0433\u043e \u0442\u0435\u0441\u0442\u043e\u0432\u043e\u0433\u043e \u0442\u0438\u0440\u0430\u0436\u0430.`;
}

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
        throw new Error(`Ошибка загрузки (${response.status})`);
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
      if (!cancelled) {
        await refresh();
      }
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

  const handleMark = async (requestId: string, mark: "win" | "lose"): Promise<void> => {
    setActionError(null);
    setActionMessage(null);

    try {
      await props.onMarkTicket(requestId, mark);
      setActionMessage(mark === "win" ? "Результат помечен как выигрыш." : "Результат помечен как проигрыш.");
      await refresh();
    } catch (actionFailure) {
      setActionError(actionFailure instanceof Error ? actionFailure.message : String(actionFailure));
    }
  };

  const handleClose = async (lotteryCode: string, drawId: string, drawAt: string): Promise<void> => {
    const confirmed = window.confirm(CONFIRM_CLOSE_DRAW);
    if (!confirmed) {
      return;
    }

    setActionError(null);
    setActionMessage(null);

    try {
      await props.onCloseDraw(lotteryCode, drawId, drawAt);
      setActionMessage(`Тираж ${drawId} закрыт, результаты опубликованы.`);
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
    const confirmed = window.confirm(confirmDeleteDrawText(drawId));
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
    const confirmed = window.confirm(CONFIRM_CLEAR_QUEUE);
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
    const confirmed = window.confirm(CONFIRM_RESET_RUNTIME);
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

  const unfinishedDraws = draws.filter((draw) => draw.status !== "settled");
  const settledDraws = draws.filter((draw) => draw.status === "settled");

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
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(12rem, 1fr))",
            gap: "0.75rem",
            alignItems: "end",
            marginTop: "0.75rem"
          }}
        >
          <div style={drawCreateFieldStyle}>
            <label>
              <small>Лотерея</small>
            </label>
            <select
              value={newLottery}
              onChange={(event) => setNewLottery(event.target.value)}
              style={drawCreateControlStyle}
            >
              <option value="bolshaya-8">Большая 8</option>
              <option value="mechtallion">Мечталлион</option>
              <option value="velikolepnaya-8">Великолепная 8</option>
              <option value="super-8">Супер 8</option>
              <option value="top-12">Топ 12</option>
            </select>
          </div>

          <div style={drawCreateFieldStyle}>
            <label>
              <small>ID тиража</small>
            </label>
            <input
              value={newDrawId}
              onChange={(event) => setNewDrawId(event.target.value)}
              placeholder="draw-001"
              style={drawCreateControlStyle}
              required
            />
          </div>

          <div style={drawCreateFieldStyle}>
            <label>
              <small>Дата и время</small>
            </label>
            <input
              type="datetime-local"
              value={newDrawAt}
              onChange={(event) => setNewDrawAt(event.target.value)}
              style={drawCreateControlStyle}
              required
            />
          </div>

          <button
            type="submit"
            className="btn-primary"
            style={drawCreateControlStyle}
            disabled={creating || !newDrawId || !newDrawAt}
          >
            {creating ? "Создание..." : "Создать тираж"}
          </button>
        </form>
      </details>

      <DrawGroup
        title={`Тиражи к закрытию (${unfinishedDraws.length})`}
        emptyText="Тиражей к закрытию нет."
        draws={unfinishedDraws}
        onMark={handleMark}
        onClose={handleClose}
        onDelete={handleDelete}
      />

      {settledDraws.length > 0 ? (
        <DrawGroup
          title={`Опубликованные тиражи (${settledDraws.length})`}
          emptyText=""
          draws={settledDraws}
          onMark={handleMark}
          onClose={handleClose}
          onDelete={handleDelete}
        />
      ) : null}
    </article>
  );
}

function DrawGroup(props: {
  readonly title: string;
  readonly emptyText: string;
  readonly draws: readonly AdminDraw[];
  readonly onMark: (requestId: string, mark: "win" | "lose") => Promise<void>;
  readonly onClose: (lotteryCode: string, drawId: string, drawAt: string) => Promise<void>;
  readonly onDelete: (lotteryCode: string, drawId: string) => Promise<void>;
}): ReactElement {
  return (
    <>
      <h3>{props.title}</h3>
      {props.draws.length === 0 ? (
        props.emptyText ? <p className="muted">{props.emptyText}</p> : <></>
      ) : (
        props.draws.map((draw) => (
          <DrawSection
            key={`${draw.lotteryCode}:${draw.drawId}`}
            draw={draw}
            onMark={props.onMark}
            onClose={props.onClose}
            onDelete={props.onDelete}
          />
        ))
      )}
    </>
  );
}

function DrawSection(props: {
  readonly draw: AdminDraw;
  readonly onMark: (requestId: string, mark: "win" | "lose") => Promise<void>;
  readonly onClose: (lotteryCode: string, drawId: string, drawAt: string) => Promise<void>;
  readonly onDelete: (lotteryCode: string, drawId: string) => Promise<void>;
}): ReactElement {
  const { draw, onMark, onClose, onDelete } = props;
  const showRowActions = draw.status !== "settled";

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
            {draw.settledAt ? ` | Опубликован: ${formatIso(draw.settledAt)}` : ""}
          </p>
        </div>

        <div className="actions-row">
          <span className={`badge ${resolveAdminDrawBadgeClass(draw.status)}`}>
            {formatAdminDrawStatus(draw.status)}
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
                void onClose(draw.lotteryCode, draw.drawId, draw.drawAt);
              }}
            >
              Закрыть и опубликовать
            </button>
          ) : null}
          {draw.status === "closed" ? (
            <button
              type="button"
              className="btn-danger"
              onClick={() => {
                void onClose(draw.lotteryCode, draw.drawId, draw.drawAt);
              }}
            >
              Завершить закрытие
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
                <th>Пометка</th>
                <th>Итог</th>
                {showRowActions ? <th>Действие</th> : null}
              </tr>
            </thead>
            <tbody>
              {draw.tickets.map((ticket) => (
                <tr key={ticket.ticketId}>
                  <td className="mono">{ticket.ticketId}</td>
                  <td className="mono">{ticket.requestId}</td>
                  <td>{ticket.userId}</td>
                  <td>{formatIso(ticket.purchasedAt)}</td>
                  <td>{formatAdminDrawVerificationStatus(ticket.verificationStatus)}</td>
                  <td>{formatAdminDrawMark(ticket.adminResultMark)}</td>
                  <td>{formatAdminDrawTicketOutcome(ticket)}</td>
                  {showRowActions ? (
                    <td>
                      <div className="actions-row">
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={() => {
                            void onMark(ticket.requestId, "win");
                          }}
                        >
                          Выигрыш
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void onMark(ticket.requestId, "lose");
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
