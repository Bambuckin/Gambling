import type { ReactElement } from "react";
import { redirect } from "next/navigation";
import { loginPath, normalizeReturnToPath, submitLogin } from "../../lib/access/entry-flow";

type LoginPageProps = {
  readonly searchParams: Promise<{
    readonly returnTo?: string | string[];
    readonly error?: string | string[];
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps): Promise<ReactElement> {
  const resolvedSearchParams = await searchParams;
  const returnToPath = normalizeReturnToPath(readSingleParam(resolvedSearchParams.returnTo));
  const errorCode = readSingleParam(resolvedSearchParams.error);
  const errorMessage = errorCode ? describeAccessError(errorCode) : null;

  return (
    <section>
      <h1>Login</h1>
      <p>Авторизуйся, чтобы продолжить в выбранную лотерею.</p>
      {errorMessage ? <p>{errorMessage}</p> : null}

      <form action={handleLoginAction}>
        <input type="hidden" name="returnTo" value={returnToPath ?? ""} />
        <label>
          Login
          <input name="login" type="text" autoComplete="username" required />
        </label>
        <label>
          Password
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        <button type="submit">Sign In</button>
      </form>

      <p>Demo user: operator / operator</p>
      <p>Demo tester: tester / tester</p>
      <p>Demo admin: admin / admin</p>
    </section>
  );
}

async function handleLoginAction(formData: FormData): Promise<void> {
  "use server";

  const login = String(formData.get("login") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const returnToPath = normalizeReturnToPath(String(formData.get("returnTo") ?? ""));

  if (!login || !password) {
    redirect(loginPath(returnToPath, "invalid_password"));
  }

  await submitLogin({
    login,
    password,
    returnToPath
  });
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

function describeAccessError(errorCode: string): string {
  switch (errorCode) {
    case "identity_not_found":
      return "Пользователь не найден.";
    case "identity_disabled":
      return "Доступ пользователя отключен.";
    case "invalid_password":
      return "Неверный пароль.";
    case "session_not_found":
      return "Сессия не найдена. Войди заново.";
    case "session_expired":
      return "Сессия истекла. Войди снова.";
    case "session_revoked":
      return "Сессия закрыта. Войди снова.";
    default:
      return "Не удалось выполнить вход.";
  }
}
