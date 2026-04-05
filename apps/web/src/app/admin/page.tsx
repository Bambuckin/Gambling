import type { ReactElement } from "react";
import { redirect } from "next/navigation";
import { requireAdminAccess, submitLogout } from "../../lib/access/entry-flow";

type AdminPageProps = {
  readonly searchParams: Promise<{
    readonly probe?: string | string[];
  }>;
};

export default async function AdminPage({ searchParams }: AdminPageProps): Promise<ReactElement> {
  const access = await requireAdminAccess("/admin");
  const resolvedSearchParams = await searchParams;
  const probeStatus = readSingleParam(resolvedSearchParams.probe);

  return (
    <section>
      <h1>Admin Console</h1>
      <p>Signed in as: {access.identity.displayName}</p>
      <p>Role: {access.identity.role}</p>
      <p>Session id: {access.session.sessionId}</p>
      {probeStatus === "ok" ? <p>Admin probe completed.</p> : null}

      <form action={runAdminProbeAction}>
        <button type="submit">Run Admin Probe</button>
      </form>

      <form action={logoutFromAdminAction}>
        <button type="submit">Logout</button>
      </form>
    </section>
  );
}

async function runAdminProbeAction(): Promise<void> {
  "use server";

  await requireAdminAccess("/admin");
  redirect("/admin?probe=ok");
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
