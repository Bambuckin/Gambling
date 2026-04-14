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
    <section className="page-column login-shell">
      <header className="hero-card">
        <p className="hero-eyebrow">Secure Access</p>
        <h1>Вход в терминальную витрину</h1>
        <p className="hero-lead">После авторизации система вернёт тебя в выбранную лотерею и сохранит контекст покупки.</p>
      </header>

      <section className="panel">
        <h2>Авторизация</h2>
        {errorMessage ? <p className="alert-row error">{errorMessage}</p> : null}

        <form action={handleLoginAction} className="page-column">
          <input type="hidden" name="returnTo" value={returnToPath ?? ""} />
          <label className="field">
            Логин
            <input name="login" type="text" autoComplete="username" required />
          </label>
          <label className="field">
            Пароль
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          <div className="actions-row">
            <button className="btn-primary" type="submit">
              Войти
            </button>
          </div>
        </form>

        <div className="mini-grid">
          <article className="mini-stat">
            <span className="label">User</span>
            <span className="value">operator / operator</span>
          </article>
          <article className="mini-stat">
            <span className="label">Tester</span>
            <span className="value">tester / tester</span>
          </article>
          <article className="mini-stat">
            <span className="label">Admin</span>
            <span className="value">admin / admin</span>
          </article>
        </div>
      </section>
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
      return "Доступ пользователя отключён.";
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
