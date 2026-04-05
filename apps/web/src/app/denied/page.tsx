import type { ReactElement } from "react";
import Link from "next/link";

type DeniedPageProps = {
  readonly searchParams: Promise<{
    readonly returnTo?: string | string[];
    readonly required?: string | string[];
    readonly actual?: string | string[];
  }>;
};

export default async function DeniedPage({ searchParams }: DeniedPageProps): Promise<ReactElement> {
  const resolvedSearchParams = await searchParams;
  const returnTo = readSingleParam(resolvedSearchParams.returnTo) ?? "/";
  const required = readSingleParam(resolvedSearchParams.required) ?? "unknown";
  const actual = readSingleParam(resolvedSearchParams.actual) ?? "unknown";

  return (
    <section>
      <h1>Access Denied</h1>
      <p>Insufficient permissions for this action.</p>
      <p>Required: {required}</p>
      <p>Actual: {actual}</p>
      <p>
        <Link href={returnTo}>Back</Link>
      </p>
    </section>
  );
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
