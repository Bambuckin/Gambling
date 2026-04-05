import type { ReactElement } from "react";
import { redirect } from "next/navigation";
import {
  PurchaseDraftService,
  PurchaseDraftServiceError,
  PurchaseOrchestrationServiceError,
  PurchaseRequestServiceError
} from "@lottery/application";
import type {
  DrawAvailabilityState,
  PurchaseDraftPayload,
  PurchaseDraftPayloadValue,
  RequestState
} from "@lottery/domain";
import { requireLotteryAccess, submitLogout } from "../../../lib/access/entry-flow";
import { getLotteryRegistryService } from "../../../lib/registry/registry-runtime";
import { LotteryFormFields } from "../../../lib/lottery-form/render-lottery-form-fields";
import { getDrawRefreshService } from "../../../lib/draw/draw-runtime";
import { LEDGER_DEFAULT_CURRENCY, getWalletLedgerService } from "../../../lib/ledger/ledger-runtime";
import { buildWalletMovementRows } from "../../../lib/ledger/wallet-view";
import {
  getPurchaseOrchestrationService,
  getPurchaseRequestQueryService,
  getPurchaseRequestService
} from "../../../lib/purchase/purchase-runtime";
import { getTicketQueryService } from "../../../lib/ticket/ticket-runtime";

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
      <section>
        <h1>Lottery not found</h1>
        <p>Lottery code: {access.lotteryCode}</p>
      </section>
    );
  }

  const drawState = await getDrawRefreshService().getDrawState(lottery.lotteryCode);
  const purchaseBlockedReason = describePurchaseBlockReason(drawState);
  const walletLedgerService = getWalletLedgerService();
  const walletSnapshot = await walletLedgerService.getWalletSnapshot(access.identity.identityId, LEDGER_DEFAULT_CURRENCY);
  const walletEntries = await walletLedgerService.listEntries(access.identity.identityId);
  const walletMovements = buildWalletMovementRows(walletEntries, { limit: 10 });
  const confirmationDraft = decodeConfirmationToken(quoteToken, lottery.lotteryCode);
  const purchaseRequests = (await getPurchaseRequestQueryService().listUserRequests(access.identity.identityId))
    .filter((request) => request.lotteryCode === lottery.lotteryCode);
  const tickets = (await getTicketQueryService().listUserTickets(access.identity.identityId)).filter(
    (ticket) => ticket.lotteryCode === lottery.lotteryCode
  );

  return (
    <section>
      <h1>Lottery: {lottery.title}</h1>
      <p>Lottery code: {lottery.lotteryCode}</p>
      <h2>Wallet Snapshot</h2>
      <table>
        <thead>
          <tr>
            <th>Currency</th>
            <th>Available (minor)</th>
            <th>Reserved (minor)</th>
            <th>Total movements</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{walletSnapshot.currency}</td>
            <td>{walletSnapshot.availableMinor}</td>
            <td>{walletSnapshot.reservedMinor}</td>
            <td>{walletEntries.length}</td>
          </tr>
        </tbody>
      </table>
      <h2>Latest Wallet Movements</h2>
      {walletMovements.length === 0 ? (
        <p>No wallet movements recorded for this user.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Operation</th>
              <th>Amount (minor)</th>
              <th>Reference</th>
              <th>Created at</th>
            </tr>
          </thead>
          <tbody>
            {walletMovements.map((movement) => (
              <tr key={movement.entryId}>
                <td>{movement.operation}</td>
                <td>{movement.amountLabel}</td>
                <td>{movement.referenceLabel}</td>
                <td>{movement.createdAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p>Session active for: {access.identity.displayName}</p>
      <p>Role: {access.identity.role}</p>
      <p>Session id: {access.session.sessionId}</p>
      <p>Session expires at: {access.session.expiresAt}</p>
      <p>Current draw status: {drawState.status}</p>
      <p>Current draw id: {drawState.snapshot?.drawId ?? "none"}</p>
      <p>Current draw at: {drawState.snapshot?.drawAt ?? "none"}</p>
      <p>Draw fetched at: {drawState.snapshot?.fetchedAt ?? "none"}</p>
      <p>Draw freshness: {drawState.freshness?.isFresh ? "fresh" : drawState.status === "missing" ? "missing" : "stale"}</p>
      <p>Draw stale since: {drawState.freshness?.staleSince ?? "n/a"}</p>
      <p>Form schema version: {lottery.formSchemaVersion}</p>
      <p>Pricing strategy: {lottery.pricing.strategy}</p>
      <p>Base amount (minor): {lottery.pricing.baseAmountMinor}</p>
      <p>Purchase handler: {lottery.handlers.purchaseHandler}</p>
      <p>Result handler: {lottery.handlers.resultHandler}</p>
      {purchaseBlockedReason ? <p>Purchase blocked: {purchaseBlockedReason}</p> : <p>Purchase controls are active.</p>}

      {draftStatus && draftMessage ? <p>Draft [{draftStatus}]: {draftMessage}</p> : null}

      <form action={submitPurchaseDraftAction}>
        <input type="hidden" name="lotteryCode" value={lottery.lotteryCode} />
        <LotteryFormFields fields={lottery.formFields} />
        <button type="submit" disabled={Boolean(purchaseBlockedReason)}>
          Prepare Purchase Draft
        </button>
      </form>

      {confirmationDraft ? (
        <section>
          <h2>Confirm Purchase Request</h2>
          <p>Request id: {confirmationDraft.requestId}</p>
          <p>Draw id: {confirmationDraft.drawId}</p>
          <p>
            Final quote: {confirmationDraft.costMinor} {confirmationDraft.currency} minor
          </p>
          <h3>Validated Payload Snapshot</h3>
          <table>
            <thead>
              <tr>
                <th>Field</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(confirmationDraft.payload).map(([fieldKey, value]) => (
                <tr key={fieldKey}>
                  <td>{fieldKey}</td>
                  <td>{String(value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <form action={confirmPurchaseRequestAction}>
            <input type="hidden" name="lotteryCode" value={lottery.lotteryCode} />
            <input type="hidden" name="quoteToken" value={quoteToken ?? ""} />
            <button type="submit" disabled={Boolean(purchaseBlockedReason)}>
              Confirm And Create Request
            </button>
          </form>
          <p>
            <a href={`/lottery/${lottery.lotteryCode}`}>Cancel And Return To Editable Form</a>
          </p>
        </section>
      ) : null}

      <h2>Purchase Requests</h2>
      {purchaseRequests.length === 0 ? (
        <p>No purchase requests yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Request</th>
              <th>State</th>
              <th>Draw</th>
              <th>Attempts</th>
              <th>Cost (minor)</th>
              <th>Created at</th>
              <th>Final result</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {purchaseRequests.map((request) => (
              <tr key={request.requestId}>
                <td>{request.requestId}</td>
                <td>{request.status}</td>
                <td>{request.drawId}</td>
                <td>{request.attemptCount}</td>
                <td>
                  {request.costMinor} {request.currency}
                </td>
                <td>{request.createdAt}</td>
                <td>{request.finalResult ?? "n/a"}</td>
                <td>
                  {isRequestCancelableStatus(request.status) ? (
                    <form action={cancelPurchaseRequestAction}>
                      <input type="hidden" name="lotteryCode" value={lottery.lotteryCode} />
                      <input type="hidden" name="requestId" value={request.requestId} />
                      <button type="submit">Cancel Request</button>
                    </form>
                  ) : (
                    "Not cancelable"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Ticket Outcomes</h2>
      {tickets.length === 0 ? (
        <p>No ticket verification outcomes yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Ticket</th>
              <th>Request</th>
              <th>Draw</th>
              <th>Verification</th>
              <th>Winning (minor)</th>
              <th>Verified at</th>
              <th>External reference</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((ticket) => (
              <tr key={ticket.ticketId}>
                <td>{ticket.ticketId}</td>
                <td>{ticket.requestId}</td>
                <td>{ticket.drawId}</td>
                <td>{ticket.verificationStatus}</td>
                <td>{ticket.winningAmountMinor ?? 0}</td>
                <td>{ticket.verifiedAt ?? "pending"}</td>
                <td>{ticket.externalReference}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <form action={handleLogoutAction}>
        <button type="submit">Logout</button>
      </form>
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
  const drawState = await getDrawRefreshService().getDrawState(lottery.lotteryCode);
  const purchaseBlockedReason = describePurchaseBlockReason(drawState);
  if (purchaseBlockedReason) {
    const blockedMessage = encodeURIComponent(`Purchase blocked: ${purchaseBlockedReason}.`);
    return redirect(`/lottery/${lottery.lotteryCode}?draft=error&message=${blockedMessage}`);
  }

  const rawFieldValues: Record<string, string | undefined> = {};
  for (const field of lottery.formFields) {
    const value = formData.get(field.fieldKey);
    rawFieldValues[field.fieldKey] = typeof value === "string" ? value : undefined;
  }

  const purchaseDraftService = new PurchaseDraftService({
    registryService
  });

  try {
    const preparedDraft = await purchaseDraftService.prepareDraft({
      lotteryCode: lottery.lotteryCode,
      rawFieldValues
    });
    const drawId = drawState.snapshot?.drawId;
    if (!drawId) {
      return redirect(
        `/lottery/${lottery.lotteryCode}?draft=error&message=${encodeURIComponent("Missing draw id for confirmation quote.")}`
      );
    }

    const confirmationToken = encodeConfirmationToken({
      requestId: `req-${crypto.randomUUID()}`,
      lotteryCode: preparedDraft.lotteryCode,
      drawId,
      payload: preparedDraft.validatedPayload,
      costMinor: preparedDraft.costMinor,
      currency: preparedDraft.currency
    });

    const message = encodeURIComponent(
      `Quote ready: ${preparedDraft.costMinor} ${preparedDraft.currency} minor (${preparedDraft.validatedFieldCount}/${preparedDraft.totalFieldCount} fields).`
    );
    return redirect(
      `/lottery/${lottery.lotteryCode}?draft=ready&message=${message}&quote=${encodeURIComponent(confirmationToken)}`
    );
  } catch (error) {
    if (error instanceof PurchaseDraftServiceError) {
      const firstFieldError = error.fieldErrors[0];
      const message = firstFieldError
        ? `Invalid "${firstFieldError.fieldKey}": ${firstFieldError.message}.`
        : error.message;
      return redirect(
        `/lottery/${lottery.lotteryCode}?draft=error&message=${encodeURIComponent(message)}`
      );
    }

    return redirect(
      `/lottery/${lottery.lotteryCode}?draft=error&message=${encodeURIComponent("Failed to prepare purchase quote.")}`
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
      `/lottery/${lottery.lotteryCode}?draft=error&message=${encodeURIComponent("Confirmation snapshot is missing or invalid.")}`
    );
  }

  const drawState = await getDrawRefreshService().getDrawState(lottery.lotteryCode);
  const purchaseBlockedReason = describePurchaseBlockReason(drawState);
  if (purchaseBlockedReason) {
    return redirect(
      `/lottery/${lottery.lotteryCode}?draft=error&message=${encodeURIComponent(`Purchase blocked: ${purchaseBlockedReason}.`)}`
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
      ? `Request ${queueResult.request.snapshot.requestId} is already queued (attempts ${queueResult.queueItem.attemptCount}).`
      : `Request ${queueResult.request.snapshot.requestId} queued with status ${queueResult.request.state}.`;

    return redirect(
      `/lottery/${lottery.lotteryCode}?draft=queued&message=${encodeURIComponent(message)}`
    );
  } catch (error) {
    if (error instanceof PurchaseRequestServiceError || error instanceof PurchaseOrchestrationServiceError) {
      return redirect(
        `/lottery/${lottery.lotteryCode}?draft=error&message=${encodeURIComponent(error.message)}`
      );
    }

    return redirect(
      `/lottery/${lottery.lotteryCode}?draft=error&message=${encodeURIComponent("Failed to create purchase request snapshot.")}`
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
      `/lottery/${lottery.lotteryCode}?draft=error&message=${encodeURIComponent("Request id is required for cancellation.")}`
    );
  }

  try {
    const canceled = await getPurchaseOrchestrationService().cancelQueuedRequest({
      requestId,
      userId: access.identity.identityId
    });
    const message = canceled.replayed
      ? `Request ${canceled.request.snapshot.requestId} was already canceled.`
      : `Request ${canceled.request.snapshot.requestId} canceled with state ${canceled.request.state}.`;

    return redirect(
      `/lottery/${lottery.lotteryCode}?draft=canceled&message=${encodeURIComponent(message)}`
    );
  } catch (error) {
    if (error instanceof PurchaseOrchestrationServiceError) {
      return redirect(
        `/lottery/${lottery.lotteryCode}?draft=error&message=${encodeURIComponent(error.message)}`
      );
    }

    return redirect(
      `/lottery/${lottery.lotteryCode}?draft=error&message=${encodeURIComponent("Failed to cancel request.")}`
    );
  }
}

interface PurchaseConfirmationToken {
  readonly requestId: string;
  readonly lotteryCode: string;
  readonly drawId: string;
  readonly payload: PurchaseDraftPayload;
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
    const costMinor = typeof record.costMinor === "number" ? Math.trunc(record.costMinor) : NaN;
    const currency = typeof record.currency === "string" ? record.currency.trim().toUpperCase() : "";
    const payload = sanitizeConfirmationPayload(record.payload);

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
      payload,
      costMinor,
      currency
    };
  } catch {
    return null;
  }
}

function sanitizeConfirmationPayload(input: unknown): PurchaseDraftPayload | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const output: Record<string, PurchaseDraftPayloadValue> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (typeof value !== "string" && typeof value !== "number") {
      return null;
    }
    output[key] = value;
  }

  return output;
}

function isRequestCancelableStatus(state: RequestState): boolean {
  return state === "queued" || state === "retrying";
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

function describePurchaseBlockReason(drawState: DrawAvailabilityState): string | null {
  if (drawState.status === "missing") {
    return "draw data is missing";
  }

  if (drawState.status === "stale") {
    return drawState.freshness?.staleSince
      ? `draw data is stale since ${drawState.freshness.staleSince}`
      : "draw data is stale";
  }

  return null;
}
