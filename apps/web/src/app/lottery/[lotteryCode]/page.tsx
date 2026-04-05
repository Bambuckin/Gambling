import type { ReactElement } from "react";
import { redirect } from "next/navigation";
import { PurchaseDraftService, PurchaseDraftServiceError } from "@lottery/application";
import type { DrawAvailabilityState } from "@lottery/domain";
import { requireLotteryAccess, submitLogout } from "../../../lib/access/entry-flow";
import { getLotteryRegistryService } from "../../../lib/registry/registry-runtime";
import { LotteryFormFields } from "../../../lib/lottery-form/render-lottery-form-fields";
import { getDrawRefreshService } from "../../../lib/draw/draw-runtime";
import { LEDGER_DEFAULT_CURRENCY, getWalletLedgerService } from "../../../lib/ledger/ledger-runtime";
import { buildWalletMovementRows } from "../../../lib/ledger/wallet-view";

type LotteryPageProps = {
  readonly params: Promise<{
    readonly lotteryCode: string;
  }>;
  readonly searchParams: Promise<{
    readonly draft?: string | string[];
    readonly message?: string | string[];
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

    const message = encodeURIComponent(
      `Quote ready: ${preparedDraft.costMinor} ${preparedDraft.currency} minor (${preparedDraft.validatedFieldCount}/${preparedDraft.totalFieldCount} fields).`
    );
    return redirect(`/lottery/${lottery.lotteryCode}?draft=ok&message=${message}`);
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
