"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactElement,
  type ReactNode
} from "react";
import type { LotteryLiveRequestView } from "./lottery-live-request-presenter";
import type { LotteryLiveTicketView } from "./lottery-live-ticket-presenter";

export type LotteryLiveRequestRow = LotteryLiveRequestView;
export type LotteryLiveTicketRow = LotteryLiveTicketView;

export interface LotteryLiveWalletSnapshot {
  readonly availableMinor: number;
  readonly reservedMinor: number;
  readonly currency: string;
}

export interface LotteryLiveCurrentDraw {
  readonly drawId: string;
  readonly label: string;
  readonly drawAt: string | null;
}

interface LotteryLiveCabinetResponse {
  readonly requests: readonly LotteryLiveRequestRow[];
  readonly tickets: readonly LotteryLiveTicketRow[];
  readonly wallet: LotteryLiveWalletSnapshot;
  readonly currentDraw: LotteryLiveCurrentDraw | null;
}

interface LotteryLiveCabinetContextValue {
  readonly requests: readonly LotteryLiveRequestRow[];
  readonly tickets: readonly LotteryLiveTicketRow[];
  readonly wallet: LotteryLiveWalletSnapshot;
  readonly currentDraw: LotteryLiveCurrentDraw | null;
  readonly error: string | null;
}

interface LotteryLiveCabinetProviderProps {
  readonly lotteryCode: string;
  readonly initialRequests: readonly LotteryLiveRequestRow[];
  readonly initialTickets: readonly LotteryLiveTicketRow[];
  readonly initialWallet: LotteryLiveWalletSnapshot;
  readonly initialCurrentDraw: LotteryLiveCurrentDraw | null;
  readonly children: ReactNode;
}

interface LiveRequestStatusProps {
  readonly requestId: string;
  readonly initialStatusLabel: string;
}

interface LiveRequestAttemptCountProps {
  readonly requestId: string;
  readonly initialAttemptCount: number;
}

interface LiveRequestUpdatedAtProps {
  readonly requestId: string;
  readonly initialUpdatedAt: string;
}

interface LiveRequestResultProps {
  readonly requestId: string;
  readonly initialResultLabel: string;
}

interface LiveTicketStatusProps {
  readonly ticketId: string;
  readonly initialStatusLabel: string;
}

interface LiveTicketOutcomeProps {
  readonly ticketId: string;
  readonly initialOutcomeLabel: string;
}

interface LiveTicketClaimStateProps {
  readonly ticketId: string;
  readonly initialClaimStateLabel: string;
}

interface LiveRequestActionProps {
  readonly requestId: string;
  readonly initialCanCancel: boolean;
  readonly children: ReactNode;
}

interface LiveTicketActionProps {
  readonly ticketId: string;
  readonly initialCanFulfill: boolean;
  readonly initialClaimStateLabel: string;
  readonly children: ReactNode;
}

const REFRESH_INTERVAL_MS = 2_500;

const LotteryLiveCabinetContext = createContext<LotteryLiveCabinetContextValue | null>(null);

export function LotteryLiveCabinetProvider(props: LotteryLiveCabinetProviderProps): ReactElement {
  const [requests, setRequests] = useState<readonly LotteryLiveRequestRow[]>(props.initialRequests);
  const [tickets, setTickets] = useState<readonly LotteryLiveTicketRow[]>(props.initialTickets);
  const [wallet, setWallet] = useState<LotteryLiveWalletSnapshot>(props.initialWallet);
  const [currentDraw, setCurrentDraw] = useState<LotteryLiveCurrentDraw | null>(props.initialCurrentDraw);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const refresh = async (): Promise<void> => {
      try {
        const response = await fetch(`/api/lottery/${props.lotteryCode}/requests`, {
          cache: "no-store"
        });
        if (!response.ok) {
          throw new Error("refresh failed");
        }

        const payload = (await response.json()) as LotteryLiveCabinetResponse;
        if (cancelled) {
          return;
        }

        setRequests(payload.requests);
        setTickets(payload.tickets);
        setWallet(payload.wallet);
        setCurrentDraw(payload.currentDraw);
        setError(null);
      } catch {
        if (!cancelled) {
          setError("Данные временно не обновляются.");
        }
      }
    };

    void refresh();
    const intervalId = window.setInterval(() => {
      void refresh();
    }, REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [props.lotteryCode]);

  return (
    <LotteryLiveCabinetContext.Provider
      value={{
        requests,
        tickets,
        wallet,
        currentDraw,
        error
      }}
    >
      {props.children}
    </LotteryLiveCabinetContext.Provider>
  );
}

export function LotteryLiveCabinetWarning(): ReactElement | null {
  const cabinet = useLotteryLiveCabinet();

  if (!cabinet.error) {
    return null;
  }

  return <p className="alert-row warn">{cabinet.error}</p>;
}

export function LotteryLivePurchaseFacts(): ReactElement {
  const cabinet = useLotteryLiveCabinet();
  const showReserve = cabinet.wallet.reservedMinor > 0 || cabinet.requests.some((request) => request.affectsReserve);

  return (
    <article className="panel purchase-facts-panel">
      <h2>Кошелёк и тираж</h2>
      <div className="mini-grid">
        <article className="mini-stat">
          <span className="label">Доступно</span>
          <span className="value">{formatMinorAsRub(cabinet.wallet.availableMinor)}</span>
        </article>
        {showReserve ? (
          <article className="mini-stat">
            <span className="label">В резерве</span>
            <span className="value">{formatMinorAsRub(cabinet.wallet.reservedMinor)}</span>
          </article>
        ) : null}
        <article className="mini-stat">
          <span className="label">Текущий тираж</span>
          <span className="value">{cabinet.currentDraw?.label ?? "нет данных"}</span>
        </article>
        <article className="mini-stat">
          <span className="label">Время тиража</span>
          <span className="value">{formatIso(cabinet.currentDraw?.drawAt) ?? "-"}</span>
        </article>
      </div>
    </article>
  );
}

export function LotteryLiveRequestStatus(props: LiveRequestStatusProps): ReactElement {
  const request = useLiveRequest(props.requestId);
  return <>{request?.statusLabel ?? props.initialStatusLabel}</>;
}

export function LotteryLiveRequestAttemptCount(props: LiveRequestAttemptCountProps): ReactElement {
  const request = useLiveRequest(props.requestId);
  return <>{request?.attemptCount ?? props.initialAttemptCount}</>;
}

export function LotteryLiveRequestUpdatedAt(props: LiveRequestUpdatedAtProps): ReactElement {
  const request = useLiveRequest(props.requestId);
  return <>{formatIso(request?.updatedAt ?? props.initialUpdatedAt) ?? "-"}</>;
}

export function LotteryLiveRequestResult(props: LiveRequestResultProps): ReactElement {
  const request = useLiveRequest(props.requestId);
  return <>{request?.resultLabel ?? props.initialResultLabel}</>;
}

export function LotteryLiveTicketStatus(props: LiveTicketStatusProps): ReactElement {
  const ticket = useLiveTicket(props.ticketId);
  return <>{ticket?.statusLabel ?? props.initialStatusLabel}</>;
}

export function LotteryLiveTicketOutcome(props: LiveTicketOutcomeProps): ReactElement {
  const ticket = useLiveTicket(props.ticketId);
  return <>{ticket?.outcomeLabel ?? props.initialOutcomeLabel}</>;
}

export function LotteryLiveTicketClaimState(props: LiveTicketClaimStateProps): ReactElement {
  const ticket = useLiveTicket(props.ticketId);
  return <>{ticket?.claimStateLabel ?? props.initialClaimStateLabel}</>;
}

export function LotteryLiveRequestAction(props: LiveRequestActionProps): ReactElement {
  const request = useLiveRequest(props.requestId);
  const canCancel = request?.canCancel ?? props.initialCanCancel;

  if (canCancel) {
    return <>{props.children}</>;
  }

  return <span className="muted">закрыта</span>;
}

export function LotteryLiveTicketAction(props: LiveTicketActionProps): ReactElement {
  const ticket = useLiveTicket(props.ticketId);
  const canFulfill = ticket?.canFulfill ?? props.initialCanFulfill;
  const claimStateLabel = ticket?.claimStateLabel ?? props.initialClaimStateLabel;

  if (canFulfill) {
    return <>{props.children}</>;
  }

  return <span className="muted">{claimStateLabel}</span>;
}

function useLotteryLiveCabinet(): LotteryLiveCabinetContextValue {
  const context = useContext(LotteryLiveCabinetContext);
  if (!context) {
    throw new Error("LotteryLiveCabinetContext is missing");
  }

  return context;
}

function useLiveRequest(requestId: string): LotteryLiveRequestRow | null {
  const cabinet = useLotteryLiveCabinet();
  const normalizedRequestId = requestId.trim();

  return cabinet.requests.find((request) => request.requestId === normalizedRequestId) ?? null;
}

function useLiveTicket(ticketId: string): LotteryLiveTicketRow | null {
  const cabinet = useLotteryLiveCabinet();
  const normalizedTicketId = ticketId.trim();

  return cabinet.tickets.find((ticket) => ticket.ticketId === normalizedTicketId) ?? null;
}

function formatIso(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function formatMinorAsRub(amountMinor: number): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amountMinor / 100);
}
