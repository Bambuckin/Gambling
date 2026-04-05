import type { ReactElement } from "react";
import { redirect } from "next/navigation";
import { requireLotteryAccess, submitLogout } from "../../../lib/access/entry-flow";

type LotteryPageProps = {
  readonly params: Promise<{
    readonly lotteryCode: string;
  }>;
};

export default async function LotteryPage({ params }: LotteryPageProps): Promise<ReactElement> {
  const resolvedParams = await params;
  const access = await requireLotteryAccess(resolvedParams.lotteryCode);

  return (
    <section>
      <h1>Lottery: {access.lotteryCode}</h1>
      <p>Session active for: {access.identity.displayName}</p>
      <p>Role: {access.identity.role}</p>
      <p>Session id: {access.session.sessionId}</p>
      <p>Session expires at: {access.session.expiresAt}</p>

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
