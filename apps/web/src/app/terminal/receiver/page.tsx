import type { ReactElement } from "react";
import Link from "next/link";
import { listMockTerminalInboxRows } from "../../../lib/purchase/mock-terminal-inbox";
import { MockTerminalLiveMonitor } from "../../../lib/purchase/mock-terminal-live-monitor";

export default async function TerminalReceiverPage(): Promise<ReactElement> {
  const rows = await listMockTerminalInboxRows();

  return (
    <section className="page-column">
      <article className="panel">
        <h1>Экран терминала</h1>
        <p>
          Здесь видно, какие заявки дошли до главного терминала и в каком состоянии они сейчас находятся.
        </p>
        <p className="muted">
          Если билет подтверждён пользователем и встал в очередь, он должен появиться ниже без ручного обновления.
        </p>
      </article>

      <MockTerminalLiveMonitor
        initialRows={rows}
        endpointPath="/api/terminal/receiver/inbox"
        title="Очередь терминала"
        refreshNote="Обновление каждые 2 секунды."
        emptyMessage="Новых заявок на терминале пока нет."
      />

      <article className="panel">
        <h2>Переходы</h2>
        <div className="actions-row">
          <Link className="btn-primary" href="/lottery/bolshaya-8">
            Открыть клиент
          </Link>
          <Link className="btn-ghost" href="/admin">
            Открыть админку
          </Link>
        </div>
      </article>
    </section>
  );
}
