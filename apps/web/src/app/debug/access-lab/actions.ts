import { redirect } from "next/navigation";
import { getAccessService } from "../../../lib/access/access-runtime";
import { readSessionCookie, writeSessionCookie } from "../../../lib/access/session-cookie";
import { submitLogout } from "../../../lib/access/entry-flow";
import { resolveScenario } from "../../../lib/access/lab-scenarios";

export async function runAccessLabScenarioAction(formData: FormData): Promise<void> {
  "use server";

  const scenarioCode = String(formData.get("scenarioCode") ?? "").trim();
  const scenario = resolveScenario(scenarioCode);
  if (!scenario) {
    return redirect(
      buildLabRedirect({
        status: "error",
        scenarioCode,
        message: `Unknown scenario: ${scenarioCode || "empty"}`
      })
    );
  }

  switch (scenario.runner) {
    case "login_user_with_return":
    case "login_admin":
    case "login_user_for_admin_probe":
      return runLoginScenario(scenario.code);
    case "logout":
      return runLogoutScenario(scenario.code);
    default:
      return redirect(
        buildLabRedirect({
          status: "error",
          scenarioCode,
          message: "Scenario runner is not supported."
        })
      );
  }
}

async function runLoginScenario(scenarioCode: string): Promise<void> {
  const scenario = resolveScenario(scenarioCode);
  if (!scenario || !scenario.login || !scenario.password) {
    return redirect(
      buildLabRedirect({
        status: "error",
        scenarioCode,
        message: "Scenario is missing login credentials."
      })
    );
  }

  const loginResult = await getAccessService().login({
    login: scenario.login,
    password: scenario.password,
    ...(scenario.returnToLotteryCode
      ? {
          returnToLotteryCode: scenario.returnToLotteryCode
        }
      : {})
  });

  if (!loginResult.ok) {
    return redirect(
      buildLabRedirect({
        status: "error",
        scenarioCode,
        message: `Login failed with reason: ${loginResult.reason}`
      })
    );
  }

  await writeSessionCookie(loginResult.session.sessionId, loginResult.identity.role);

  return redirect(
    buildLabRedirect({
      status: "ok",
      scenarioCode,
      message: `Session created for ${loginResult.identity.login} (${loginResult.identity.role}).`,
      ...(scenario.probePath
        ? {
            probePath: scenario.probePath
          }
        : {})
    })
  );
}

async function runLogoutScenario(scenarioCode: string): Promise<void> {
  const activeSessionId = await readSessionCookie();
  if (!activeSessionId) {
    return redirect(
      buildLabRedirect({
        status: "error",
        scenarioCode,
        message: "No active session cookie to revoke."
      })
    );
  }

  await submitLogout();

  return redirect(
    buildLabRedirect({
      status: "ok",
      scenarioCode,
      message: `Session ${activeSessionId} revoked and cookie cleared.`,
      probePath: "/login"
    })
  );
}

interface LabRedirectInput {
  readonly status: "ok" | "error";
  readonly scenarioCode: string;
  readonly message: string;
  readonly probePath?: string;
}

function buildLabRedirect(input: LabRedirectInput): string {
  const searchParams = new URLSearchParams();
  searchParams.set("status", input.status);
  searchParams.set("scenario", input.scenarioCode);
  searchParams.set("message", input.message);
  if (input.probePath) {
    searchParams.set("probe", input.probePath);
  }
  return `/debug/access-lab?${searchParams.toString()}`;
}
