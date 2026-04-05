import type { ReactElement } from "react";
import Link from "next/link";
import { LEDGER_DEFAULT_CURRENCY, getWalletLedgerService } from "../../../lib/ledger/ledger-runtime";
import { buildWalletMovementRows, listLedgerUserIds } from "../../../lib/ledger/wallet-view";

const SEEDED_WALLET_NAMES: Readonly<Record<string, string>> = {
  "seed-user": "Operator User",
  "seed-admin": "Administrator",
  "seed-tester": "Tester User"
};

export default async function WalletLabPage(): Promise<ReactElement> {
  const walletLedgerService = getWalletLedgerService();
  const allEntries = await walletLedgerService.listAllEntries();
  const userIds = listLedgerUserIds(allEntries);
  const wallets = await Promise.all(
    userIds.map(async (userId) => {
      const userEntries = allEntries.filter((entry) => entry.userId === userId);
      const currency = userEntries.at(-1)?.currency ?? LEDGER_DEFAULT_CURRENCY;
      const snapshot = await walletLedgerService.getWalletSnapshot(userId, currency);

      return {
        userId,
        label: SEEDED_WALLET_NAMES[userId] ?? userId,
        snapshot,
        movements: buildWalletMovementRows(userEntries, { limit: 8 })
      };
    })
  );

  return (
    <section>
      <h1>Wallet Lab</h1>
      <p>Verification contour for Phase 4 wallet behavior checks.</p>
      <p>This page is for manual testing only and is not an operational screen.</p>
      <p>Wallets discovered: {wallets.length}</p>

      {wallets.map((wallet) => (
        <article key={wallet.userId}>
          <h2>{wallet.label}</h2>
          <p>User id: {wallet.userId}</p>
          <table>
            <thead>
              <tr>
                <th>Currency</th>
                <th>Available (minor)</th>
                <th>Reserved (minor)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{wallet.snapshot.currency}</td>
                <td>{wallet.snapshot.availableMinor}</td>
                <td>{wallet.snapshot.reservedMinor}</td>
              </tr>
            </tbody>
          </table>

          {wallet.movements.length === 0 ? (
            <p>No movements recorded.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Operation</th>
                  <th>Amount (minor)</th>
                  <th>Reference</th>
                  <th>Created at</th>
                </tr>
              </thead>
              <tbody>
                {wallet.movements.map((movement) => (
                  <tr key={movement.entryId}>
                    <td>{movement.operation}</td>
                    <td>{movement.amountLabel}</td>
                    <td>{movement.referenceLabel}</td>
                    <td>{movement.createdAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </article>
      ))}

      <p>
        <Link href="/">Back to shell</Link>
      </p>
      <p>
        <Link href="/debug/registry-lab">Open Registry Lab</Link>
      </p>
    </section>
  );
}
