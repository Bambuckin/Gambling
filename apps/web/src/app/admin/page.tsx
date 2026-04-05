import type { ReactElement } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { DrawAvailabilityState } from "@lottery/domain";
import type { LotteryOrderDirection } from "@lottery/application";
import { requireAdminAccess, submitLogout } from "../../lib/access/entry-flow";
import { getDrawRefreshService } from "../../lib/draw/draw-runtime";
import { listAdminRegistryEntries, moveAdminLottery, setAdminLotteryEnabled } from "../../lib/registry/admin-registry";

type AdminPageProps = {
  readonly searchParams: Promise<{
    readonly status?: string | string[];
    readonly message?: string | string[];
  }>;
};

export default async function AdminPage({ searchParams }: AdminPageProps): Promise<ReactElement> {
  const access = await requireAdminAccess("/admin");
  const entries = await listAdminRegistryEntries();
  const drawStates = await Promise.all(
    entries.map(async (entry) => [entry.lotteryCode, await getDrawRefreshService().getDrawState(entry.lotteryCode)] as const)
  );
  const drawStateByLotteryCode = new Map<string, DrawAvailabilityState>(drawStates);
  const resolvedSearchParams = await searchParams;
  const status = readSingleParam(resolvedSearchParams.status);
  const statusMessage = readSingleParam(resolvedSearchParams.message);

  return (
    <section>
      <h1>Admin Registry Console</h1>
      <p>Registry controls for enable/disable/reorder without handler or history deletion.</p>
      <p>Signed in as: {access.identity.displayName}</p>
      <p>Role: {access.identity.role}</p>
      <p>Session id: {access.session.sessionId}</p>
      <p>Total lotteries: {entries.length}</p>
      {status && statusMessage ? <p>Action [{status}]: {statusMessage}</p> : null}

      <table>
        <thead>
          <tr>
            <th>Code</th>
            <th>Title</th>
            <th>Enabled</th>
            <th>Display order</th>
            <th>Draw state</th>
            <th>Purchase state</th>
            <th>Controls</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, index) => {
            const drawState = drawStateByLotteryCode.get(entry.lotteryCode);
            const purchaseState = drawState?.isPurchaseBlocked ? "blocked" : "active";
            const drawLabel = drawState
              ? drawState.status === "stale" && drawState.freshness?.staleSince
                ? `stale (since ${drawState.freshness.staleSince})`
                : drawState.status
              : "missing";
            const isFirst = index === 0;
            const isLast = index === entries.length - 1;

            return (
              <tr key={entry.lotteryCode}>
                <td>{entry.lotteryCode}</td>
                <td>{entry.title}</td>
                <td>{entry.enabled ? "yes" : "no"}</td>
                <td>{entry.displayOrder}</td>
                <td>{drawLabel}</td>
                <td>{purchaseState}</td>
                <td>
                  <form action={setLotteryEnabledAction}>
                    <input type="hidden" name="lotteryCode" value={entry.lotteryCode} />
                    <input type="hidden" name="enabled" value={entry.enabled ? "false" : "true"} />
                    <button type="submit">{entry.enabled ? "Disable" : "Enable"}</button>
                  </form>
                  <form action={moveLotteryAction}>
                    <input type="hidden" name="lotteryCode" value={entry.lotteryCode} />
                    <input type="hidden" name="direction" value="up" />
                    <button type="submit" disabled={isFirst}>Move Up</button>
                  </form>
                  <form action={moveLotteryAction}>
                    <input type="hidden" name="lotteryCode" value={entry.lotteryCode} />
                    <input type="hidden" name="direction" value="down" />
                    <button type="submit" disabled={isLast}>Move Down</button>
                  </form>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <p>
        <Link href="/">Back to shell</Link>
      </p>
      <p>
        <Link href="/debug/registry-lab">Open Registry Lab</Link>
      </p>
      <p>
        <Link href="/lottery/demo-lottery">Open Demo Lottery</Link>
      </p>
      <p>
        <Link href="/lottery/gosloto-6x45">Open Gosloto 6x45</Link>
      </p>

      <form action={logoutFromAdminAction}>
        <button type="submit">Logout</button>
      </form>
    </section>
  );
}

async function setLotteryEnabledAction(formData: FormData): Promise<void> {
  "use server";

  await requireAdminAccess("/admin");

  try {
    const lotteryCode = readRequiredFormValue(formData, "lotteryCode");
    const enabled = readBooleanFormValue(formData.get("enabled"));
    const updated = await setAdminLotteryEnabled(lotteryCode, enabled);
    return redirect(
      `/admin?status=ok&message=${encodeURIComponent(
        `${updated.lotteryCode} is now ${updated.enabled ? "enabled" : "disabled"}`
      )}`
    );
  } catch (error) {
    return redirect(
      `/admin?status=error&message=${encodeURIComponent(resolveErrorMessage(error, "Failed to update visibility"))}`
    );
  }
}

async function moveLotteryAction(formData: FormData): Promise<void> {
  "use server";

  await requireAdminAccess("/admin");

  try {
    const lotteryCode = readRequiredFormValue(formData, "lotteryCode");
    const direction = readDirectionFormValue(formData.get("direction"));
    await moveAdminLottery(lotteryCode, direction);
    return redirect(`/admin?status=ok&message=${encodeURIComponent(`${lotteryCode} moved ${direction}`)}`);
  } catch (error) {
    return redirect(`/admin?status=error&message=${encodeURIComponent(resolveErrorMessage(error, "Failed to reorder"))}`);
  }
}

async function logoutFromAdminAction(): Promise<void> {
  "use server";

  await submitLogout();
  redirect("/login");
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

function readRequiredFormValue(formData: FormData, key: string): string {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) {
    throw new Error(`Missing form value: ${key}`);
  }
  return value;
}

function readBooleanFormValue(value: FormDataEntryValue | null): boolean {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "true") {
    return true;
  }

  if (normalized === "false") {
    return false;
  }

  throw new Error("Invalid boolean form value");
}

function readDirectionFormValue(value: FormDataEntryValue | null): LotteryOrderDirection {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "up" || normalized === "down") {
    return normalized;
  }

  throw new Error("Invalid reorder direction");
}

function resolveErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallback;
}
