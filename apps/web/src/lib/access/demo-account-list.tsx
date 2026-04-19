"use client";

import { useCallback, useState } from "react";
import type { ReactElement } from "react";

export interface DemoAccountEntry {
  readonly label: string;
  readonly login: string;
  readonly password: string;
}

interface DemoAccountListProps {
  readonly accounts: readonly DemoAccountEntry[];
}

export function DemoAccountList({ accounts }: DemoAccountListProps): ReactElement {
  return (
    <div className="mini-grid">
      {accounts.map((account) => (
        <DemoAccountCard key={account.login} account={account} />
      ))}
    </div>
  );
}

function DemoAccountCard({ account }: { readonly account: DemoAccountEntry }): ReactElement {
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = useCallback(
    async (text: string, label: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(label);
        setTimeout(() => setCopied(null), 1200);
      } catch {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        setCopied(label);
        setTimeout(() => setCopied(null), 1200);
      }
    },
    []
  );

  return (
    <article className="mini-stat demo-account-card">
      <span className="label">{account.label}</span>
      <div className="demo-account-credentials">
        <span className="value">
          {account.login} / {account.password}
        </span>
      </div>
      <div className="demo-account-actions">
        <button
          type="button"
          className="btn-secondary btn-sm"
          onClick={() => copyToClipboard(account.login, "login")}
        >
          {copied === "login" ? "Скопировано" : "Логин"}
        </button>
        <button
          type="button"
          className="btn-secondary btn-sm"
          onClick={() => copyToClipboard(account.password, "password")}
        >
          {copied === "password" ? "Скопировано" : "Пароль"}
        </button>
      </div>
    </article>
  );
}
