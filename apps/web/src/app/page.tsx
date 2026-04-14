import type { CSSProperties, ReactElement } from "react";
import Link from "next/link";
import { readLotteryShellCatalog } from "../lib/access/lottery-catalog";
import { resolveLotteryPresentation } from "../lib/ui/lottery-presentation";

export default async function HomePage(): Promise<ReactElement> {
  const lotteries = await readLotteryShellCatalog();

  return (
    <section className="page-column home-page">
      <header className="hero-card">
        <p className="hero-eyebrow">Lottery Terminal Operations</p>
        <h1>Покупка билетов через единый терминал</h1>
        <p className="hero-lead">
          Выбирай лотерею, собирай билет, подтверждай заявку и отправляй её в терминальную очередь с прозрачным
          статусом на каждом шаге.
        </p>
        <div className="hero-actions">
          <Link className="btn-primary" href="/login">
            Войти и начать
          </Link>
          <Link className="btn-ghost" href="/admin">
            Операционная панель
          </Link>
        </div>
      </header>

      <section className="lottery-grid" aria-label="Доступные лотереи">
        {lotteries.map((lottery) => {
          const presentation = resolveLotteryPresentation(lottery.code);
          return (
            <article
              key={lottery.code}
              className="lottery-card"
              style={
                {
                  "--lottery-accent-from": presentation.accentFrom,
                  "--lottery-accent-to": presentation.accentTo
                } as CSSProperties
              }
            >
              <p className="lottery-category">{presentation.category}</p>
              <h2>{lottery.title}</h2>
              <p>{presentation.tagline}</p>
              <div className="lottery-card-footer">
                <span className="lottery-code">{lottery.code}</span>
                <Link className="lottery-link" href={`/lottery/${lottery.code}`}>
                  Купить билет
                </Link>
              </div>
            </article>
          );
        })}
      </section>

      <section className="system-strip">
        <article className="system-pill">
          <h3>Логин и роли</h3>
          <p>Единый вход с разделением user/admin и возвратом в выбранную лотерею.</p>
        </article>
        <article className="system-pill">
          <h3>Очередь терминала</h3>
          <p>Одна активная покупка в момент времени, retries и трассировка попыток.</p>
        </article>
        <article className="system-pill">
          <h3>Статусы и баланс</h3>
          <p>Деньги, заявки и тикеты видны в интерфейсе без «слепых зон».</p>
        </article>
      </section>
    </section>
  );
}
