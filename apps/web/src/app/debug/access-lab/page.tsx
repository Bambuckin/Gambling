import type { ReactElement } from "react";
import Link from "next/link";
import { readSessionCookie } from "../../../lib/access/session-cookie";
import { resolveCurrentAccessRole } from "../../../lib/access/entry-flow";
import { SCENARIOS } from "../../../lib/access/lab-scenarios";
import { runAccessLabScenarioAction } from "./actions";

type AccessLabPageProps = {
  readonly searchParams: Promise<{
    readonly status?: string | string[];
    readonly scenario?: string | string[];
    readonly message?: string | string[];
    readonly probe?: string | string[];
  }>;
};

export default async function AccessLabPage({ searchParams }: AccessLabPageProps): Promise<ReactElement> {
  const resolvedSearchParams = await searchParams;
  const status = readSingleParam(resolvedSearchParams.status);
  const scenarioCode = readSingleParam(resolvedSearchParams.scenario);
  const message = readSingleParam(resolvedSearchParams.message);
  const probePath = readSingleParam(resolvedSearchParams.probe);

  const role = await resolveCurrentAccessRole();
  const sessionId = await readSessionCookie();

  return (
    <section>
      <h1>Access Lab</h1>
      <p>Manual harness for Phase 2 access verification.</p>
      <p>Current role: {role ?? "guest"}</p>
      <p>Current session: {sessionId ?? "none"}</p>

      {status && message ? (
        <p>
          Result [{status}] {scenarioCode ? `for ${scenarioCode}` : ""}: {message}
          {probePath ? (
            <>
              {" "}
              <Link href={probePath}>Open probe path</Link>
            </>
          ) : null}
        </p>
      ) : null}

      {SCENARIOS.map((scenario) => (
        <article key={scenario.code}>
          <h2>{scenario.title}</h2>
          <p>{scenario.description}</p>
          <p>Expected: {scenario.expectedOutcome}</p>
          {scenario.probePath ? (
            <p>
              Probe path: <code>{scenario.probePath}</code>
            </p>
          ) : null}

          <form action={runAccessLabScenarioAction}>
            <input type="hidden" name="scenarioCode" value={scenario.code} />
            <button type="submit">Run {scenario.title}</button>
          </form>
        </article>
      ))}
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
