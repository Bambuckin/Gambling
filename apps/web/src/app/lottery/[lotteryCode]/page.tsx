import type { CSSProperties, ReactElement } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import {
  PurchaseDraftService,
  PurchaseDraftServiceError,
  PurchaseOrchestrationServiceError,
  PurchaseRequestServiceError
} from "@lottery/application";
import type {
  DrawAvailabilityState,
  PurchaseDraftPayload,
  RequestState
} from "@lottery/domain";
import { isBig8PurchaseDraftPayload, sanitizePurchaseDraftPayload } from "@lottery/domain";
import { requireLotteryAccess, submitLogout } from "../../../lib/access/entry-flow";
import { loadPurchasableDrawContext } from "../../../lib/draw/purchasable-draws";
import { LEDGER_DEFAULT_CURRENCY, getWalletLedgerService } from "../../../lib/ledger/ledger-runtime";
import { Big8PurchaseForm } from "../../../lib/lottery-form/big8-purchase-form";
import { LotteryFormFields } from "../../../lib/lottery-form/render-lottery-form-fields";
import {
  getNotificationService,
  getPurchaseOrchestrationService,
  getPurchaseRequestQueryService,
  getPurchaseRequestService
} from "../../../lib/purchase/purchase-runtime";
import { LotteryLiveMonitor } from "../../../lib/purchase/lottery-live-monitor";
import { LotteryNotificationMonitor } from "../../../lib/purchase/lottery-notification-monitor";
import { getLotteryRegistryService } from "../../../lib/registry/registry-runtime";
import { getTicketQueryService } from "../../../lib/ticket/ticket-runtime";
import { resolveLotteryPresentation } from "../../../lib/ui/lottery-presentation";

type LotteryPageProps = {
  readonly params: Promise<{
    readonly lotteryCode: string;
  }>;
  readonly searchParams: Promise<{
    readonly draft?: string | string[];
    readonly message?: string | string[];
    readonly quote?: string | string[];
  }>;
};

export default async function LotteryPage({ params, searchParams }: LotteryPageProps): Promise<ReactElement> {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const access = await requireLotteryAccess(resolvedParams.lotteryCode);
  const registryService = getLotteryRegistryService();
  const lottery = await registryService.getLotteryByCode(access.lotteryCode);
  const draftStatus = readSingleParam(resolvedSearchParams.draft);
  const draftMessage = readSingleParam(resolvedSearchParams.message);
  const quoteToken = readSingleParam(resolvedSearchParams.quote);

  if (!lottery) {
    return (
      <section className="panel">
        <h1>Лотерея не найдена</h1>
        <p className="muted">Код: {access.lotteryCode}</p>
      </section>
    );
  }

  const drawContext = await loadPurchasableDrawContext(lottery.lotteryCode, lottery.drawFreshnessMode);
  const drawState = drawContext.drawState;
  const availableDraws = drawContext.draws;
  const purchaseBlockedReason = drawContext.blockedReason;
  const walletLedgerService = getWalletLedgerService();
  const walletSnapshot = await walletLedgerService.getWalletSnapshot(access.identity.identityId, LEDGER_DEFAULT_CURRENCY);
  const confirmationDraft = decodeConfirmationToken(quoteToken, lottery.lotteryCode);
  const purchaseRequests = (await getPurchaseRequestQueryService().listUserRequests(access.identity.identityId))
    .filter((request) => request.lotteryCode === lottery.lotteryCode);
  const tickets = (await getTicketQueryService().listUserTickets(access.identity.identityId)).filter(
    (ticket) => ticket.lotteryCode === lottery.lotteryCode
  );
  const notifications = (await getNotificationService().listUserNotifications(access.identity.identityId)).filter(
    (notification) => notification.referenceLotteryCode === lottery.lotteryCode
  );
  const presentation = resolveLotteryPresentation(lottery.lotteryCode);
  const drawBadge = resolveDrawBadge(drawState);
  const draftBadge = resolveDraftBadge(draftStatus);
  const purchaseStatusTone = purchaseBlockedReason ? "warn" : resolvePurchaseStatusTone(drawState);
  const purchaseStatusMessage = purchaseBlockedReason
    ? `Покупка заблокирована: ${purchaseBlockedReason}.`
    : resolvePurchaseStatusMessage(drawState);
  const isBig8Lottery = lottery.formSchemaVersion === "v3-big8-live";

  return (
    <section className="lottery-page">
      <header
        className="lottery-hero"
        style={
          {
            background: `linear-gradient(145deg, ${presentation.accentFrom} 0%, ${presentation.accentTo} 100%)`
          } as CSSProperties
        }
      >
        <div className="lottery-hero-head">
          <div>
            <p className="hero-eyebrow">{presentation.category}</p>
            <h1>{lottery.title}</h1>
          </div>
          <span className={`badge ${drawBadge.kind}`}>{drawBadge.label}</span>
        </div>
        <p>{presentation.tagline}</p>
        <div className="actions-row">
          <Link className="btn-ghost" href="/">
            Ко всем лотереям
          </Link>
          <form action={handleLogoutAction}>
            <button className="btn-ghost" type="submit">
              Выйти
            </button>
          </form>
        </div>
      </header>

      {draftStatus && draftMessage ? (
        <p className={`alert-row ${draftBadge}`}>{draftMessage}</p>
      ) : (
        <p className={`alert-row ${purchaseStatusTone}`}>{purchaseStatusMessage}</p>
      )}

      <section className="split-grid">
        <article className="panel">
          <h2>Новый билет</h2>
          <p className="muted">
            {isBig8Lottery
              ? `Базовая ставка: ${formatMinorAsRub(lottery.pricing.baseAmountMinor)} • список тиражей синхронизируется каждые 20 секунд`
              : `Стоимость билета: ${formatMinorAsRub(lottery.pricing.baseAmountMinor)} • схема: ${lottery.formSchemaVersion}`}
          </p>
          {isBig8Lottery ? (
            <form action={submitPurchaseDraftAction} className="page-column">
              <input type="hidden" name="lotteryCode" value={lottery.lotteryCode} />
              <Big8PurchaseForm
                lotteryCode={lottery.lotteryCode}
                baseAmountMinor={lottery.pricing.baseAmountMinor}
                accountPhone={access.identity.phone}
                purchaseBlockedReason={purchaseBlockedReason}
                initialDrawOptions={availableDraws}
              />
            </form>
          ) : (
            <form action={submitPurchaseDraftAction} className="page-column">
              <input type="hidden" name="lotteryCode" value={lottery.lotteryCode} />
              <LotteryFormFields fields={lottery.formFields} />
              <div className="actions-row">
                <button className="btn-primary" type="submit" disabled={Boolean(purchaseBlockedReason)}>
                  Подготовить заявку
                </button>
              </div>
            </form>
          )}

          {confirmationDraft ? (
            <section className="panel">
              <h3>{isBig8PurchaseDraftPayload(confirmationDraft.payload) ? "Подтверждение корзины Big 8" : "Подтверждение заявки"}</h3>
              <div className="mini-grid">
                <article className="mini-stat">
                  <span className="label">Заявка</span>
                  <span className="value">{confirmationDraft.requestId}</span>
                </article>
                <article className="mini-stat">
                  <span className="label">Тираж</span>
                  <span className="value">{confirmationDraft.drawLabel ?? confirmationDraft.drawId}</span>
                </article>
                <article className="mini-stat">
                  <span className="label">Сумма</span>
                  <span className="value">{formatMinorAsRub(confirmationDraft.costMinor)}</span>
                </article>
                {confirmationDraft.ticketCount ? (
                  <article className="mini-stat">
                    <span className="label">Билетов</span>
                    <span className="value">{confirmationDraft.ticketCount}</span>
                  </article>
                ) : null}
              </div>
              {renderConfirmationPayloadDetails(confirmationDraft.payload, lottery.pricing.baseAmountMinor)}
              <div className="actions-row">
                <form action={confirmPurchaseRequestAction}>
                  <input type="hidden" name="lotteryCode" value={lottery.lotteryCode} />
                  <input type="hidden" name="quoteToken" value={quoteToken ?? ""} />
                  <button className="btn-primary" type="submit" disabled={Boolean(purchaseBlockedReason)}>
                    Подтвердить и отправить в очередь
                  </button>
                </form>
                <Link className="btn-ghost" href={`/lottery/${lottery.lotteryCode}`}>
                  Отменить и редактировать
                </Link>
              </div>
            </section>
          ) : null}
        </article>

        <article className="panel">
          <h2>Кошелёк и тираж</h2>
          <p className="muted">Здесь только минимум, который нужен перед отправкой билета.</p>
          <div className="mini-grid">
            <article className="mini-stat">
              <span className="label">Доступно</span>
              <span className="value">{formatMinorAsRub(walletSnapshot.availableMinor)}</span>
            </article>
            <article className="mini-stat">
              <span className="label">В резерве</span>
              <span className="value">{formatMinorAsRub(walletSnapshot.reservedMinor)}</span>
            </article>
            <article className="mini-stat">
              <span className="label">Текущий тираж</span>
              <span className="value">{drawState.snapshot?.drawId ?? "нет данных"}</span>
            </article>
            <article className="mini-stat">
              <span className="label">Время тиража</span>
              <span className="value">{formatIso(drawState.snapshot?.drawAt)}</span>
            </article>
            <article className="mini-stat">
              <span className="label">Обновлено</span>
              <span className="value">{formatIso(drawState.snapshot?.fetchedAt)}</span>
            </article>
            <article className="mini-stat">
              <span className="label">Свежесть</span>
              <span className="value">{drawState.freshness?.isFresh ? "актуально" : "нужна проверка"}</span>
            </article>
          </div>
          <p className="muted" style={{ marginTop: "0.75rem" }}>
            Пользователь: {access.identity.displayName} | Телефон: {formatPhone(access.identity.phone)}
          </p>
        </article>
      </section>

      <LotteryLiveMonitor
        lotteryCode={lottery.lotteryCode}
        initialRequests={purchaseRequests.map((request) => ({
          requestId: request.requestId,
          status: request.status,
          drawId: request.drawId,
          attemptCount: request.attemptCount,
          updatedAt: request.updatedAt,
          finalResult: request.finalResult
        }))}
      />

      <LotteryNotificationMonitor
        lotteryCode={lottery.lotteryCode}
        initialNotifications={notifications.map((notification) => ({
          notificationId: notification.notificationId,
          type: notification.type,
          title: notification.title,
          body: notification.body,
          read: notification.read,
          createdAt: notification.createdAt,
          referenceTicketId: notification.referenceTicketId,
          referenceDrawId: notification.referenceDrawId
        }))}
      />

      <section className="two-col">
        <article className="panel">
          <h2>Заявки на покупку</h2>
          {purchaseRequests.length === 0 ? (
            <p className="muted">Заявок пока нет.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Заявка</th>
                    <th>Статус</th>
                    <th>Тираж</th>
                    <th>Попытки</th>
                    <th>Сумма</th>
                    <th>Создана</th>
                    <th>Итог</th>
                    <th>Действие</th>
                  </tr>
                </thead>
                <tbody>
                  {purchaseRequests.map((request) => (
                    <tr key={request.requestId}>
                      <td>{request.requestId}</td>
                      <td>{formatRequestStatus(request.status)}</td>
                      <td>{request.drawId}</td>
                      <td>{request.attemptCount}</td>
                      <td>{formatMinorAsRub(request.costMinor)}</td>
                      <td>{formatIso(request.createdAt)}</td>
                      <td>{formatRequestResult(request.finalResult)}</td>
                      <td>
                        {isRequestCancelableStatus(request.status) ? (
                          <form action={cancelPurchaseRequestAction}>
                            <input type="hidden" name="lotteryCode" value={lottery.lotteryCode} />
                            <input type="hidden" name="requestId" value={request.requestId} />
                            <button className="btn-danger" type="submit">
                              Отменить
                            </button>
                          </form>
                        ) : (
                          <span className="muted">закрыта</span>
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
          <h2>Билеты и результаты</h2>
          {tickets.length === 0 ? (
            <p className="muted">Результатов проверки пока нет.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Билет</th>
                    <th>Тираж</th>
                    <th>Статус</th>
                    <th>Выигрыш</th>
                    <th>Источник</th>
                    <th>Статус выплаты</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((ticket) => (
                    <tr key={ticket.ticketId}>
                      <td>{ticket.ticketId}</td>
                      <td>{ticket.drawId}</td>
                      <td>{formatTicketVerificationStatus(ticket.verificationStatus)}</td>
                      <td>{formatTicketOutcome(ticket.verificationStatus, ticket.winningAmountMinor)}</td>
                      <td>{formatTicketResultSource(ticket.resultSource)}</td>
                      <td>{formatClaimState(ticket.claimState)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      </section>
    </section>
  );
}

async function handleLogoutAction(): Promise<void> {
  "use server";

  await submitLogout();
  redirect("/login");
}

async function submitPurchaseDraftAction(formData: FormData): Promise<void> {
  "use server";

  const requestedLotteryCode = String(formData.get("lotteryCode") ?? "");
  const access = await requireLotteryAccess(requestedLotteryCode);
  const registryService = getLotteryRegistryService();
  const lottery = await registryService.getLotteryByCode(access.lotteryCode);
  if (!lottery) {
    return redirect(`/lottery/${access.lotteryCode}?draft=error&message=Lottery+not+found`);
  }
  const drawContext = await loadPurchasableDrawContext(lottery.lotteryCode, lottery.drawFreshnessMode);
  const liveDraws = drawContext.draws;
  const purchaseBlockedReason = drawContext.blockedReason;
  if (purchaseBlockedReason) {
    const blockedMessage = encodeURIComponent(`Покупка заблокирована: ${purchaseBlockedReason}.`);
    return redirect(`/lottery/${lottery.lotteryCode}?draft=error&message=${blockedMessage}`);
  }

  const purchaseDraftService = new PurchaseDraftService({
    registryService
  });

  try {
    const isBig8Lottery = lottery.formSchemaVersion === "v3-big8-live";
    const preparedDraft = isBig8Lottery
      ? await purchaseDraftService.prepareDraft({
          lotteryCode: lottery.lotteryCode,
          structuredPayload: readBig8StructuredPayload(formData, access.identity.phone)
        })
      : await purchaseDraftService.prepareDraft({
          lotteryCode: lottery.lotteryCode,
          rawFieldValues: readRawFieldValues(formData, lottery.formFields)
        });
    const drawId = isBig8Lottery
      ? String(formData.get("selectedDrawId") ?? "").trim()
      : drawContext.drawState.snapshot?.drawId;
    const selectedDraw = drawId ? liveDraws.find((draw) => draw.drawId === drawId) ?? null : null;
    if (!drawId || (isBig8Lottery && !selectedDraw)) {
      return redirect(
        `/lottery/${lottery.lotteryCode}?draft=error&message=${encodeURIComponent("Для заявки не найден актуальный тираж.")}`
      );
    }

    const confirmationToken = encodeConfirmationToken({
      requestId: `req-${crypto.randomUUID()}`,
      lotteryCode: preparedDraft.lotteryCode,
      drawId,
      ...(selectedDraw ? { drawLabel: selectedDraw.label } : {}),
      payload: preparedDraft.validatedPayload,
      ticketCount: preparedDraft.ticketCount,
      costMinor: preparedDraft.costMinor,
      currency: preparedDraft.currency
    });

    const message = encodeURIComponent(
      isBig8Lottery
        ? `Черновик Big 8 готов: ${preparedDraft.ticketCount} бил., ${formatMinorAsRub(preparedDraft.costMinor)}.`
        : `Черновик готов: ${formatMinorAsRub(preparedDraft.costMinor)} (${preparedDraft.validatedFieldCount}/${preparedDraft.totalFieldCount} полей).`
    );
    return redirect(
      `/lottery/${lottery.lotteryCode}?draft=ready&message=${message}&quote=${encodeURIComponent(confirmationToken)}`
    );
  } catch (error) {
    rethrowIfRedirectError(error);

    if (error instanceof PurchaseDraftServiceError) {
      const firstFieldError = error.fieldErrors[0];
      const message = firstFieldError
        ? `Поле "${firstFieldError.fieldKey}": ${firstFieldError.message}.`
        : error.message;
      return redirect(`/lottery/${lottery.lotteryCode}?draft=error&message=${encodeURIComponent(message)}`);
    }

    if (error instanceof Error && error.message.trim().length > 0) {
      return redirect(`/lottery/${lottery.lotteryCode}?draft=error&message=${encodeURIComponent(error.message)}`);
    }

    return redirect(
      `/lottery/${lottery.lotteryCode}?draft=error&message=${encodeURIComponent("Не удалось подготовить черновик покупки.")}`
    );
  }
}

async function confirmPurchaseRequestAction(formData: FormData): Promise<void> {
  "use server";

  const requestedLotteryCode = String(formData.get("lotteryCode") ?? "");
  const access = await requireLotteryAccess(requestedLotteryCode);
  const registryService = getLotteryRegistryService();
  const lottery = await registryService.getLotteryByCode(access.lotteryCode);
  if (!lottery) {
    return redirect(`/lottery/${access.lotteryCode}?draft=error&message=Lottery+not+found`);
  }

  const confirmationToken = String(formData.get("quoteToken") ?? "");
  const confirmationDraft = decodeConfirmationToken(confirmationToken, lottery.lotteryCode);
  if (!confirmationDraft) {
    return redirect(
      `/lottery/${lottery.lotteryCode}?draft=error&message=${encodeURIComponent("Снимок подтверждения отсутствует или поврежден.")}`
    );
  }

  const drawContext = await loadPurchasableDrawContext(lottery.lotteryCode, lottery.drawFreshnessMode);
  const liveDraws = drawContext.draws;
  const purchaseBlockedReason = drawContext.blockedReason;
  if (purchaseBlockedReason) {
    return redirect(
      `/lottery/${lottery.lotteryCode}?draft=error&message=${encodeURIComponent(`Покупка заблокирована: ${purchaseBlockedReason}.`)}`
    );
  }

  if (
    lottery.formSchemaVersion === "v3-big8-live" &&
    !liveDraws.some((draw) => draw.drawId === confirmationDraft.drawId)
  ) {
    return redirect(
      `/lottery/${lottery.lotteryCode}?draft=error&message=${encodeURIComponent("Выбранный тираж уже не доступен. Обновите список и соберите билет заново.")}`
    );
  }

  try {
    await getPurchaseRequestService().createAwaitingConfirmation({
      requestId: confirmationDraft.requestId,
      userId: access.identity.identityId,
      lotteryCode: lottery.lotteryCode,
      drawId: confirmationDraft.drawId,
      payload: confirmationDraft.payload,
      costMinor: confirmationDraft.costMinor,
      currency: confirmationDraft.currency
    });

    const queueResult = await getPurchaseOrchestrationService().confirmAndQueueRequest({
      requestId: confirmationDraft.requestId,
      userId: access.identity.identityId
    });

    const message = queueResult.replayed
      ? `Заявка ${queueResult.request.snapshot.requestId} уже стоит в очереди (попытка ${queueResult.queueItem.attemptCount}).`
      : `Заявка ${queueResult.request.snapshot.requestId} отправлена в очередь со статусом ${queueResult.request.state}.`;

    return redirect(`/lottery/${lottery.lotteryCode}?draft=queued&message=${encodeURIComponent(message)}`);
  } catch (error) {
    rethrowIfRedirectError(error);

    if (error instanceof PurchaseRequestServiceError || error instanceof PurchaseOrchestrationServiceError) {
      return redirect(`/lottery/${lottery.lotteryCode}?draft=error&message=${encodeURIComponent(error.message)}`);
    }

    return redirect(
      `/lottery/${lottery.lotteryCode}?draft=error&message=${encodeURIComponent("Не удалось создать заявку на покупку.")}`
    );
  }
}

async function cancelPurchaseRequestAction(formData: FormData): Promise<void> {
  "use server";

  const requestedLotteryCode = String(formData.get("lotteryCode") ?? "");
  const requestId = String(formData.get("requestId") ?? "");
  const access = await requireLotteryAccess(requestedLotteryCode);
  const registryService = getLotteryRegistryService();
  const lottery = await registryService.getLotteryByCode(access.lotteryCode);
  if (!lottery) {
    return redirect(`/lottery/${access.lotteryCode}?draft=error&message=Lottery+not+found`);
  }

  if (!requestId.trim()) {
    return redirect(
      `/lottery/${lottery.lotteryCode}?draft=error&message=${encodeURIComponent("Нужен request id для отмены.")}`
    );
  }

  try {
    const canceled = await getPurchaseOrchestrationService().cancelQueuedRequest({
      requestId,
      userId: access.identity.identityId
    });
    const message = canceled.replayed
      ? `Заявка ${canceled.request.snapshot.requestId} уже была отменена.`
      : `Заявка ${canceled.request.snapshot.requestId} отменена со статусом ${canceled.request.state}.`;

    return redirect(`/lottery/${lottery.lotteryCode}?draft=canceled&message=${encodeURIComponent(message)}`);
  } catch (error) {
    rethrowIfRedirectError(error);

    if (error instanceof PurchaseOrchestrationServiceError) {
      return redirect(`/lottery/${lottery.lotteryCode}?draft=error&message=${encodeURIComponent(error.message)}`);
    }

    return redirect(
      `/lottery/${lottery.lotteryCode}?draft=error&message=${encodeURIComponent("Не удалось отменить заявку.")}`
    );
  }
}

interface PurchaseConfirmationToken {
  readonly requestId: string;
  readonly lotteryCode: string;
  readonly drawId: string;
  readonly drawLabel?: string;
  readonly payload: PurchaseDraftPayload;
  readonly ticketCount?: number;
  readonly costMinor: number;
  readonly currency: string;
}

function encodeConfirmationToken(input: PurchaseConfirmationToken): string {
  const json = JSON.stringify(input);
  return Buffer.from(json, "utf8").toString("base64url");
}

function decodeConfirmationToken(token: string | null, expectedLotteryCode: string): PurchaseConfirmationToken | null {
  if (!token) {
    return null;
  }

  try {
    const decodedJson = Buffer.from(token, "base64url").toString("utf8");
    const parsed = JSON.parse(decodedJson) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const record = parsed as Record<string, unknown>;
    const requestId = typeof record.requestId === "string" ? record.requestId.trim() : "";
    const lotteryCode = typeof record.lotteryCode === "string" ? record.lotteryCode.trim().toLowerCase() : "";
    const drawId = typeof record.drawId === "string" ? record.drawId.trim() : "";
    const drawLabel = typeof record.drawLabel === "string" ? record.drawLabel.trim() : undefined;
    const costMinor = typeof record.costMinor === "number" ? Math.trunc(record.costMinor) : NaN;
    const currency = typeof record.currency === "string" ? record.currency.trim().toUpperCase() : "";
    const ticketCount = typeof record.ticketCount === "number" ? Math.trunc(record.ticketCount) : undefined;
    const payload = sanitizePurchaseDraftPayload(record.payload);

    if (
      !requestId ||
      !lotteryCode ||
      !drawId ||
      !Number.isFinite(costMinor) ||
      costMinor <= 0 ||
      !currency ||
      !payload
    ) {
      return null;
    }

    if (lotteryCode !== expectedLotteryCode.toLowerCase()) {
      return null;
    }

    return {
      requestId,
      lotteryCode,
      drawId,
      ...(drawLabel ? { drawLabel } : {}),
      payload,
      ...(typeof ticketCount === "number" && ticketCount > 0 ? { ticketCount } : {}),
      costMinor,
      currency
    };
  } catch {
    return null;
  }
}

function readRawFieldValues(
  formData: FormData,
  fields: readonly {
    readonly fieldKey: string;
  }[]
): Record<string, string | undefined> {
  const rawFieldValues: Record<string, string | undefined> = {};
  for (const field of fields) {
    const value = formData.get(field.fieldKey);
    rawFieldValues[field.fieldKey] = typeof value === "string" ? value : undefined;
  }

  return rawFieldValues;
}

function readBig8StructuredPayload(formData: FormData, accountPhone: string): unknown {
  const payloadFromFields = readBig8StructuredPayloadFromFields(formData, accountPhone);
  if (payloadFromFields) {
    return payloadFromFields;
  }

  const rawJson = String(formData.get("structuredPayloadJson") ?? "");
  if (!rawJson.trim()) {
    throw new Error("Нужен JSON билета Big 8");
  }

  const parsed = JSON.parse(rawJson) as unknown;
  if (!parsed || typeof parsed !== "object") {
    throw new Error("JSON билета Big 8 поврежден");
  }

  return {
    schema: "big8-v1",
    ...(parsed as Record<string, unknown>),
    contactPhone: accountPhone
  };
}

function readBig8StructuredPayloadFromFields(formData: FormData, accountPhone: string): unknown | null {
  if (!formData.has("big8TicketCount")) {
    return null;
  }

  const rawTicketCount = String(formData.get("big8TicketCount") ?? "").trim();
  const parsedTicketCount = Number.parseInt(rawTicketCount, 10);
  const ticketCount = Number.isInteger(parsedTicketCount) && parsedTicketCount > 0 ? parsedTicketCount : 0;
  const tickets: Array<{
    readonly boardNumbers: readonly number[];
    readonly extraNumber: number | null;
    readonly multiplier: number | null;
  }> = [];

  for (let index = 0; index < ticketCount; index += 1) {
    const rawBoardNumbers = String(formData.get(`big8TicketBoardNumbers-${index}`) ?? "").trim();
    const boardNumbers =
      rawBoardNumbers.length === 0
        ? []
        : rawBoardNumbers.split(",").map((entry) => Number.parseInt(entry.trim(), 10));
    const rawExtraNumber = String(formData.get(`big8TicketExtraNumber-${index}`) ?? "").trim();
    const parsedExtraNumber = Number.parseInt(rawExtraNumber, 10);
    const extraNumber = Number.isInteger(parsedExtraNumber) ? parsedExtraNumber : null;
    const rawMultiplier = String(formData.get(`big8TicketMultiplier-${index}`) ?? "").trim();
    const parsedMultiplier = Number.parseInt(rawMultiplier, 10);
    const multiplier = Number.isInteger(parsedMultiplier) ? parsedMultiplier : null;

    tickets.push({
      boardNumbers,
      extraNumber,
      multiplier
    });
  }

  return {
    schema: "big8-v1",
    contactPhone: accountPhone,
    tickets
  };
}

function renderConfirmationPayloadDetails(payload: PurchaseDraftPayload, baseAmountMinor: number): ReactElement {
  if (!isBig8PurchaseDraftPayload(payload)) {
    return (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Поле</th>
              <th>Значение</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(payload).map(([fieldKey, value]) => (
              <tr key={fieldKey}>
                <td>{fieldKey}</td>
                <td>{String(value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="big8-confirmation-grid">
      {payload.tickets.map((ticket, index) => (
        <article key={`confirm-${index + 1}`} className="big8-confirmation-card">
          <div className="big8-confirmation-head">
            <strong>Билет {index + 1}</strong>
            <span>{formatMinorAsRub(baseAmountMinor * ticket.multiplier)}</span>
          </div>
          <p>
            Поле 1: {ticket.boardNumbers.join(", ")}
          </p>
          <p>Поле 2: {ticket.extraNumber}</p>
          <p>Множитель: x{ticket.multiplier}</p>
        </article>
      ))}
      <article className="big8-confirmation-card">
        <div className="big8-confirmation-head">
          <strong>Телефон</strong>
          <span>{formatPhone(payload.contactPhone)}</span>
        </div>
        <p>Телефон подтянут из учетной записи и попадет в terminal payload без ручного ввода на клиенте.</p>
      </article>
    </div>
  );
}

function isRequestCancelableStatus(state: RequestState): boolean {
  return state === "queued" || state === "retrying";
}

function formatRequestStatus(state: RequestState): string {
  switch (state) {
    case "awaiting_confirmation":
      return "Ждёт подтверждения";
    case "confirmed":
      return "Подтверждена";
    case "queued":
      return "В очереди";
    case "executing":
      return "Исполняется";
    case "retrying":
      return "Повторная попытка";
    case "added_to_cart":
      return "В корзине";
    case "success":
      return "Завершена";
    case "error":
      return "Ошибка";
    case "canceled":
      return "Отменена";
    default:
      return state;
  }
}

function formatRequestResult(result: string | null): string {
  if (!result) {
    return "Нет";
  }

  switch (result) {
    case "ticket_purchased":
      return "Билет куплен";
    case "added_to_cart":
      return "В корзине";
    default:
      return result;
  }
}

function formatTicketVerificationStatus(status: string): string {
  switch (status) {
    case "pending":
      return "Ожидает";
    case "verified":
      return "Проверен";
    case "failed":
      return "Ошибка";
    default:
      return status;
  }
}

function formatTicketOutcome(verificationStatus: string, winningAmountMinor: number | null | undefined): string {
  if (verificationStatus === "pending") {
    return "Ждёт результата";
  }

  if (verificationStatus === "failed") {
    return "Проверка завершилась ошибкой";
  }

  if ((winningAmountMinor ?? 0) > 0) {
    return formatMinorAsRub(winningAmountMinor ?? 0);
  }

  return "Проигрыш";
}

function formatTicketResultSource(resultSource: string | null | undefined): string {
  switch (resultSource) {
    case "terminal":
      return "Терминал";
    case "admin_emulated":
      return "Администратор";
    default:
      return "—";
  }
}

function formatClaimState(claimState: string): string {
  switch (claimState) {
    case "unclaimed":
      return "Не обработан";
    case "credit_pending":
      return "Зачисление в очереди";
    case "credited":
      return "Зачислен";
    case "cash_desk_pending":
      return "Ожидает кассу";
    case "cash_desk_paid":
      return "Выдан в кассе";
    default:
      return claimState;
  }
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

function rethrowIfRedirectError(error: unknown): void {
  if (isRedirectError(error)) {
    throw error;
  }
}

function describePurchaseBlockReason(drawState: DrawAvailabilityState): string | null {
  if (drawState.status === "missing") {
    return "данные тиража отсутствуют";
  }

  return null;
}

function resolvePurchaseStatusTone(drawState: DrawAvailabilityState): "ok" | "warn" {
  return drawState.status === "stale" ? "warn" : "ok";
}

function resolvePurchaseStatusMessage(drawState: DrawAvailabilityState): string {
  if (drawState.status === "missing") {
    return "Покупка заблокирована: данные тиража отсутствуют.";
  }

  if (drawState.status === "stale") {
    return "Покупка доступна, проверка свежести тиража временно отключена.";
  }

  return "Покупка доступна, данные тиража актуальны.";
}

function resolveDrawBadge(drawState: DrawAvailabilityState): { readonly label: string; readonly kind: "success" | "warning" | "danger" } {
  switch (drawState.status) {
    case "fresh":
      return { label: "Тираж активен", kind: "success" };
    case "stale":
      return { label: "Тираж устарел", kind: "warning" };
    case "missing":
      return { label: "Нет данных тиража", kind: "danger" };
    default:
      return { label: "Статус неизвестен", kind: "warning" };
  }
}

function resolveDraftBadge(draftStatus: string | null): "ok" | "warn" | "error" {
  if (draftStatus === "queued" || draftStatus === "ready" || draftStatus === "canceled") {
    return "ok";
  }
  if (draftStatus === "warning") {
    return "warn";
  }
  return "error";
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
    minute: "2-digit"
  });
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

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11) {
    return `+${digits[0]} (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9)}`;
  }

  return phone;
}


