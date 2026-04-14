import type { ReactElement } from "react";
import Link from "next/link";
import { listMockTerminalInboxRows } from "../../../lib/purchase/mock-terminal-inbox";
import { MockTerminalLiveMonitor } from "../../../lib/purchase/mock-terminal-live-monitor";

export default async function MockTerminalPage(): Promise<ReactElement> {
  const rows = await listMockTerminalInboxRows();

  return (
    <section>
      <h1>Mock Terminal Page (Big 8)</h1>
      <p>Локальная имитация терминала. Показывает payload, который воркер забрал из очереди и обработал.</p>
      <p>Страница нужна для проверки канала web -&gt; worker на одном компьютере, без реальной оплаты в НЛ.</p>

      <MockTerminalLiveMonitor initialRows={rows} />

      <p>
        <Link href="/lottery/bolshaya-8">Open Bolshaya 8 Client Page</Link>
      </p>
      <p>
        <Link href="/debug/purchase-lab">Open Purchase Lab</Link>
      </p>
      <p>
        <Link href="/debug/terminal-lab">Open Terminal Lab</Link>
      </p>
      <p>
        <Link href="/">Back to shell</Link>
      </p>
    </section>
  );
}
