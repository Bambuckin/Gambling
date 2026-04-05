export type AccessLabRunner =
  | "login_user_with_return"
  | "login_admin"
  | "login_user_for_admin_probe"
  | "logout";

export interface AccessLabScenario {
  readonly code: string;
  readonly title: string;
  readonly description: string;
  readonly runner: AccessLabRunner;
  readonly expectedOutcome: string;
  readonly probePath?: string;
  readonly login?: string;
  readonly password?: string;
  readonly returnToLotteryCode?: string;
}

export const SCENARIOS: readonly AccessLabScenario[] = [
  {
    code: "user-return-flow",
    title: "User Login With Return",
    description: "Logs in as the demo user and restores return path to the selected lottery.",
    runner: "login_user_with_return",
    login: "operator",
    password: "operator",
    returnToLotteryCode: "demo-lottery",
    probePath: "/lottery/demo-lottery",
    expectedOutcome: "User session is created and lottery path opens without re-login prompt."
  },
  {
    code: "admin-shell-flow",
    title: "Admin Login",
    description: "Logs in as the demo admin and opens the admin route.",
    runner: "login_admin",
    login: "admin",
    password: "admin",
    probePath: "/admin",
    expectedOutcome: "Admin session is created and admin page renders."
  },
  {
    code: "admin-denied-flow",
    title: "User To Admin Denied",
    description: "Logs in as user and probes admin page to validate denial path.",
    runner: "login_user_for_admin_probe",
    login: "operator",
    password: "operator",
    probePath: "/admin",
    expectedOutcome: "Admin page redirects to /denied with required role metadata."
  },
  {
    code: "logout-flow",
    title: "Logout Flow",
    description: "Revokes active session and clears cookies.",
    runner: "logout",
    probePath: "/login",
    expectedOutcome: "Session becomes invalid and login screen is shown on next protected route."
  }
];

export function resolveScenario(code: string): AccessLabScenario | null {
  return SCENARIOS.find((scenario) => scenario.code === code) ?? null;
}
