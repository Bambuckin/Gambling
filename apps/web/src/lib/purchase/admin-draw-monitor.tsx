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
  readonly onSettleDraw: (lotteryCode: string, drawId: string) => Promise<void>;
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
    const confirmed = window.confirm("Закрыть тираж? После этого можно только помечать результаты и публиковать settlement.");
    if (!confirmed) {
      return;
    }

    setActionError(null);
    setActionMessage(null);

    try {
      await props.onCloseDraw(lotteryCode, drawId, drawAt);
      setActionMessage(`Тираж ${drawId} закрыт.`);
      await refresh();
    } catch (actionFailure) {
      setActionError(actionFailure instanceof Error ? actionFailure.message : String(actionFailure));
    }
  };

  const handleSettle = async (lotteryCode: string, drawId: string): Promise<void> => {
    const confirmed = window.confirm("Опубликовать settlement? После этого результат станет видимым пользователю.");
    if (!confirmed) {
      return;
    }

    setActionError(null);
    setActionMessage(null);

    try {
      await props.onSettleDraw(lotteryCode, drawId);
      setActionMessage(`Тираж ${drawId} опубликован.`);
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
    const confirmed = window.confirm(`Удалить тираж ${drawId}? Разрешено только для пустого тестового тиража.`);
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
    const confirmed = window.confirm("Очистить очередь и снять зависшие pending-заявки?");
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

      <DrawGroup
        title={`Открытые тиражи (${openDraws.length})`}
        emptyText="Открытых тиражей нет."
        draws={openDraws}
        onMark={handleMark}
        onClose={handleClose}
        onSettle={handleSettle}
        onDelete={handleDelete}
      />

      <DrawGroup
        title={`Закрытые, ждут settlement (${closedDraws.length})`}
        emptyText="Закрытых тиражей без публикации нет."
        draws={closedDraws}
        onMark={handleMark}
        onClose={handleClose}
        onSettle={handleSettle}
        onDelete={handleDelete}
      />

      {settledDraws.length > 0 ? (
        <DrawGroup
          title={`Опубликованные тиражи (${settledDraws.length})`}
          emptyText=""
          draws={settledDraws}
          onMark={handleMark}
          onClose={handleClose}
          onSettle={handleSettle}
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
  readonly onSettle: (lotteryCode: string, drawId: string) => Promise<void>;
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
            onSettle={props.onSettle}
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
  readonly onSettle: (lotteryCode: string, drawId: string) => Promise<void>;
  readonly onDelete: (lotteryCode: string, drawId: string) => Promise<void>;
}): ReactElement {
  const { draw, onMark, onClose, onSettle, onDelete } = props;
  const showRowActions = draw.status === "closed";

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
            {draw.settledAt ? ` | Settlement: ${formatIso(draw.settledAt)}` : ""}
          </p>
        </div>

        <div className="actions-row">
          <span className={`badge ${resolveDrawBadgeClass(draw.status)}`}>{formatDrawStatus(draw.status)}</span>
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
              Закрыть тираж
            </button>
          ) : null}
          {draw.status === "closed" ? (
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                void onSettle(draw.lotteryCode, draw.drawId);
              }}
            >
              Опубликовать settlement
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
                  <td>{formatVerificationStatus(ticket.verificationStatus)}</td>
                  <td>{formatAdminMark(ticket.adminResultMark)}</td>
                  <td>{formatTicketOutcome(ticket)}</td>
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

function formatDrawStatus(status: AdminDraw["status"]): string {
  switch (status) {
    case "open":
      return "Открыт";
    case "closed":
      return "Закрыт";
    case "settled":
      return "Опубликован";
  }
}

function resolveDrawBadgeClass(status: AdminDraw["status"]): string {
  switch (status) {
    case "open":
      return "warning";
    case "closed":
      return "warning";
    case "settled":
      return "success";
  }
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
      return "Скрыт до settlement";
    case "verified":
      return "Опубликован";
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
    return "Проигрыш по settlement";
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
