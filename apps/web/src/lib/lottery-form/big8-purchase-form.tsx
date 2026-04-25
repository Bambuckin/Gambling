"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import type { ReactElement } from "react";
import type { DrawOption } from "@lottery/domain";

interface Big8TicketState {
  readonly id: string;
  readonly boardNumbers: readonly number[];
  readonly extraNumber: number | null;
  readonly multiplier: number;
}

interface Big8PurchaseFormProps {
  readonly lotteryCode: string;
  readonly baseAmountMinor: number;
  readonly accountPhone: string;
  readonly purchaseBlockedReason: string | null;
  readonly initialDrawOptions: readonly DrawOption[];
}

interface DrawRefreshResponse {
  readonly draws: readonly DrawOption[];
  readonly status: "fresh" | "stale" | "missing";
  readonly blockedReason: string | null;
}

const BIG8_BOARD_VALUES = Array.from({ length: 20 }, (_, index) => index + 1);
const BIG8_EXTRA_VALUES = [1, 2, 3, 4] as const;
const BIG8_REQUIRED_NUMBERS = 8;
const BIG8_MAX_MULTIPLIER = 10;
const DRAW_REFRESH_INTERVAL_MS = 5_000;

export function Big8PurchaseForm({
  lotteryCode,
  baseAmountMinor,
  accountPhone,
  purchaseBlockedReason,
  initialDrawOptions
}: Big8PurchaseFormProps): ReactElement {
  const [drawOptions, setDrawOptions] = useState<readonly DrawOption[]>(initialDrawOptions);
  const [selectedDrawId, setSelectedDrawId] = useState<string>(initialDrawOptions[0]?.drawId ?? "");
  const [tickets, setTickets] = useState<readonly Big8TicketState[]>([createEmptyTicket()]);
  const [liveBlockedReason, setLiveBlockedReason] = useState<string | null>(purchaseBlockedReason);

  useEffect(() => {
    let cancelled = false;

    const refreshDraws = async (): Promise<void> => {
      try {
        const response = await fetch(`/api/lottery/${lotteryCode}/draws`, {
          cache: "no-store"
        });
        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as DrawRefreshResponse;
        if (cancelled) {
          return;
        }

        setDrawOptions(payload.draws);
        setLiveBlockedReason(payload.blockedReason);
        setSelectedDrawId((current) => {
          if (payload.draws.some((draw) => draw.drawId === current)) {
            return current;
          }

          return payload.draws[0]?.drawId ?? "";
        });
      } catch {
        // keep the last known state; stale detection comes from the server snapshot
      }
    };

    void refreshDraws();
    const intervalId = window.setInterval(() => {
      void refreshDraws();
    }, DRAW_REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [lotteryCode]);

  const totalMultiplier = useMemo(
    () => tickets.reduce((sum, ticket) => sum + ticket.multiplier, 0),
    [tickets]
  );
  const totalAmountMinor = totalMultiplier * baseAmountMinor;
  const selectedDrawLabel = drawOptions.find((draw) => draw.drawId === selectedDrawId)?.label ?? "Выбери тираж";
  const drawBlockedReason =
    liveBlockedReason ?? (drawOptions.length === 0 ? "нет открытых тиражей" : null);
  const canSubmit =
    !drawBlockedReason &&
    selectedDrawId.length > 0 &&
    tickets.every((ticket) => ticket.boardNumbers.length === BIG8_REQUIRED_NUMBERS && ticket.extraNumber !== null);

  return (
    <div className="big8-shell">
      <div className="big8-topbar">
        <div className="big8-draw-strip">
          <label className="field">
            Тираж
            <select name="selectedDrawId" value={selectedDrawId} onChange={(event) => setSelectedDrawId(event.target.value)}>
              {drawOptions.length === 0 ? <option value="">Тиражи недоступны</option> : null}
              {drawOptions.map((draw) => (
                <option key={draw.drawId} value={draw.drawId}>
                  {draw.label}
                </option>
              ))}
            </select>
          </label>
          <div className="big8-live-note" aria-live="polite">
            <span>Активно: {selectedDrawLabel}</span>
            {drawBlockedReason ? <span className="big8-live-warning">Блок: {drawBlockedReason}</span> : null}
          </div>
        </div>
        <div className="big8-ticket-counter">
          <span>Билетов</span>
          <div className="big8-counter-controls">
            <button type="button" onClick={() => setTickets((current) => shrinkTickets(current))} disabled={tickets.length === 1}>
              -
            </button>
            <strong className="big8-counter-value">{tickets.length}</strong>
            <button type="button" onClick={() => setTickets((current) => [...current, createEmptyTicket()])}>
              +
            </button>
          </div>
        </div>
      </div>

      <div className="big8-editor-layout">
        <div className="big8-ticket-grid">
          {tickets.map((ticket, index) => {
            const ticketAmountMinor = baseAmountMinor * ticket.multiplier;
            const isComplete = ticket.boardNumbers.length === BIG8_REQUIRED_NUMBERS && ticket.extraNumber !== null;

            return (
              <article key={ticket.id} className="big8-ticket-card">
                <div className="big8-ticket-head">
                  <div>
                    <strong>Билет {index + 1}</strong>
                    <span>{formatMinorAsRub(ticketAmountMinor)}</span>
                  </div>
                  <span className={`badge ${isComplete ? "success" : "warning"}`}>
                    {ticket.boardNumbers.length}/8 • {ticket.extraNumber ? "1/1" : "0/1"}
                  </span>
                </div>

                <div className="big8-ticket-section">
                  <div className="big8-section-row">
                    <strong>Поле 1</strong>
                    <span>Выбери 8 чисел</span>
                  </div>
                  <div className="big8-number-grid">
                    {BIG8_BOARD_VALUES.map((value) => {
                      const active = ticket.boardNumbers.includes(value);
                      return (
                        <button
                          key={`${ticket.id}-board-${value}`}
                          type="button"
                          className={`big8-number-button ${active ? "active" : ""}`}
                          onClick={() => {
                            setTickets((current) =>
                              current.map((entry) =>
                                entry.id === ticket.id ? toggleBoardNumber(entry, value) : entry
                              )
                            );
                          }}
                        >
                          {value}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="big8-ticket-section">
                  <div className="big8-section-row">
                    <strong>Поле 2</strong>
                    <span>Одно число из 4</span>
                  </div>
                  <div className="big8-extra-grid">
                    {BIG8_EXTRA_VALUES.map((value) => (
                      <button
                        key={`${ticket.id}-extra-${value}`}
                        type="button"
                        className={`big8-number-button ${ticket.extraNumber === value ? "active" : ""}`}
                        onClick={() =>
                          setTickets((current) =>
                            current.map((entry) =>
                              entry.id === ticket.id
                                ? {
                                    ...entry,
                                    extraNumber: value
                                  }
                                : entry
                            )
                          )
                        }
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="big8-ticket-toolbar">
                  <button
                    type="button"
                    className="big8-ghost-button"
                    onClick={() =>
                      setTickets((current) =>
                        current.map((entry) => (entry.id === ticket.id ? fillTicketWithRandomNumbers(entry) : entry))
                      )
                    }
                  >
                    Случайные числа
                  </button>
                  <button
                    type="button"
                    className="big8-ghost-button"
                    onClick={() =>
                      setTickets((current) =>
                        current.map((entry) => (entry.id === ticket.id ? createEmptyTicket(entry.id) : entry))
                      )
                    }
                  >
                    Очистить
                  </button>
                </div>

                <div className="big8-multiplier-row">
                  <span>Множитель</span>
                  <div className="big8-counter-controls">
                    <button
                      type="button"
                      onClick={() =>
                        setTickets((current) =>
                          current.map((entry) =>
                            entry.id === ticket.id
                              ? {
                                  ...entry,
                                  multiplier: Math.max(1, entry.multiplier - 1)
                                }
                              : entry
                          )
                        )
                      }
                      disabled={ticket.multiplier <= 1}
                    >
                      -
                    </button>
                    <strong>x{ticket.multiplier}</strong>
                    <button
                      type="button"
                      onClick={() =>
                        setTickets((current) =>
                          current.map((entry) =>
                            entry.id === ticket.id
                              ? {
                                  ...entry,
                                  multiplier: Math.min(BIG8_MAX_MULTIPLIER, entry.multiplier + 1)
                                }
                              : entry
                          )
                        )
                      }
                      disabled={ticket.multiplier >= BIG8_MAX_MULTIPLIER}
                    >
                      +
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <aside className="big8-summary-card">
          <div className="big8-summary-head">
            <strong>Сводка заявки</strong>
            <span>{tickets.length} бил.</span>
          </div>
          <div className="big8-summary-list">
            <div>
              <span>Телефон аккаунта</span>
              <strong>{formatPhone(accountPhone)}</strong>
            </div>
            <div>
              <span>Текущий тираж</span>
              <strong>{selectedDrawLabel}</strong>
            </div>
            <div>
              <span>Множитель</span>
              <strong>x{totalMultiplier}</strong>
            </div>
            <div>
              <span>К оплате</span>
              <strong>{formatMinorAsRub(totalAmountMinor)}</strong>
            </div>
          </div>
        </aside>
      </div>

      <div className="actions-row big8-submit-row">
        <button className="btn-primary" type="submit" disabled={!canSubmit}>
          Подготовить заявку
        </button>
      </div>

      <input type="hidden" name="big8TicketCount" value={String(tickets.length)} />
      {tickets.map((ticket, index) => (
        <Fragment key={`hidden-${ticket.id}`}>
          <input type="hidden" name={`big8TicketBoardNumbers-${index}`} value={ticket.boardNumbers.join(",")} />
          <input type="hidden" name={`big8TicketExtraNumber-${index}`} value={ticket.extraNumber ?? ""} />
          <input type="hidden" name={`big8TicketMultiplier-${index}`} value={String(ticket.multiplier)} />
        </Fragment>
      ))}
      <input type="hidden" name="structuredPayloadJson" value={JSON.stringify({ tickets })} />
    </div>
  );
}

function createEmptyTicket(existingId?: string): Big8TicketState {
  return {
    id: existingId ?? createTicketId(),
    boardNumbers: [],
    extraNumber: null,
    multiplier: 1
  };
}

function createTicketId(): string {
  const browserCrypto = globalThis.crypto;
  if (browserCrypto && typeof browserCrypto.randomUUID === "function") {
    return browserCrypto.randomUUID();
  }

  if (browserCrypto && typeof browserCrypto.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    browserCrypto.getRandomValues(bytes);
    return `ticket-${Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("")}`;
  }

  return `ticket-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function shrinkTickets(current: readonly Big8TicketState[]): readonly Big8TicketState[] {
  return current.length > 1 ? current.slice(0, current.length - 1) : current;
}

function toggleBoardNumber(ticket: Big8TicketState, value: number): Big8TicketState {
  if (ticket.boardNumbers.includes(value)) {
    return {
      ...ticket,
      boardNumbers: ticket.boardNumbers.filter((entry) => entry !== value)
    };
  }

  if (ticket.boardNumbers.length >= BIG8_REQUIRED_NUMBERS) {
    return ticket;
  }

  return {
    ...ticket,
    boardNumbers: [...ticket.boardNumbers, value].sort((left, right) => left - right)
  };
}

function fillTicketWithRandomNumbers(ticket: Big8TicketState): Big8TicketState {
  const pool = [...BIG8_BOARD_VALUES];
  const numbers: number[] = [];

  while (numbers.length < BIG8_REQUIRED_NUMBERS && pool.length > 0) {
    const index = Math.floor(Math.random() * pool.length);
    const [value] = pool.splice(index, 1);
    if (typeof value === "number") {
      numbers.push(value);
    }
  }

  return {
    ...ticket,
    boardNumbers: numbers.sort((left, right) => left - right),
    extraNumber: BIG8_EXTRA_VALUES[Math.floor(Math.random() * BIG8_EXTRA_VALUES.length)] ?? 1
  };
}

function formatMinorAsRub(amountMinor: number): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amountMinor / 100);
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11) {
    return `+${digits[0]} (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9)}`;
  }

  return phone;
}
