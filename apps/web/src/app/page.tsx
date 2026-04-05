import type { ReactElement } from "react";
import Link from "next/link";
import { readLotteryShellCatalog } from "../lib/access/lottery-catalog";

export default function HomePage(): ReactElement {
  const lotteries = readLotteryShellCatalog();

  return (
    <section>
      <h1>Lottery Terminal Operations System</h1>
      <p>Phase 2 shell is active.</p>
      <p>Выбери лотерею: если сессии нет, тебя отправит на логин и вернет обратно.</p>
      <ul>
        {lotteries.map((lottery) => (
          <li key={lottery.code}>
            <Link href={`/lottery/${lottery.code}`}>{lottery.title}</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
