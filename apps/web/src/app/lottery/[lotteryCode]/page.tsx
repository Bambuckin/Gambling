import type { ReactElement } from "react";
import { redirect } from "next/navigation";
import { requireLotteryAccess, submitLogout } from "../../../lib/access/entry-flow";
import { getLotteryRegistryService } from "../../../lib/registry/registry-runtime";
import { LotteryFormFields } from "../../../lib/lottery-form/render-lottery-form-fields";

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

  return (
    <section>
      <h1>Lottery: {lottery.title}</h1>
      <p>Lottery code: {lottery.lotteryCode}</p>
      <p>Session active for: {access.identity.displayName}</p>
      <p>Role: {access.identity.role}</p>
      <p>Session id: {access.session.sessionId}</p>
      <p>Session expires at: {access.session.expiresAt}</p>
      <p>Form schema version: {lottery.formSchemaVersion}</p>
      <p>Pricing strategy: {lottery.pricing.strategy}</p>
      <p>Base amount (minor): {lottery.pricing.baseAmountMinor}</p>
      <p>Purchase handler: {lottery.handlers.purchaseHandler}</p>
      <p>Result handler: {lottery.handlers.resultHandler}</p>

      {draftStatus && draftMessage ? <p>Draft [{draftStatus}]: {draftMessage}</p> : null}

      <form action={submitPurchaseDraftAction}>
        <input type="hidden" name="lotteryCode" value={lottery.lotteryCode} />
        <LotteryFormFields fields={lottery.formFields} />
        <button type="submit">Prepare Purchase Draft</button>
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
  const lottery = await getLotteryRegistryService().getLotteryByCode(access.lotteryCode);
  if (!lottery) {
    return redirect(`/lottery/${access.lotteryCode}?draft=error&message=Lottery+not+found`);
  }

  const completedFields = lottery.formFields.reduce((count, field) => {
    const value = String(formData.get(field.fieldKey) ?? "").trim();
    return value.length > 0 ? count + 1 : count;
  }, 0);

  const message = encodeURIComponent(
    `Captured ${completedFields}/${lottery.formFields.length} metadata fields for ${lottery.lotteryCode}.`
  );

  return redirect(`/lottery/${lottery.lotteryCode}?draft=ok&message=${message}`);
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
