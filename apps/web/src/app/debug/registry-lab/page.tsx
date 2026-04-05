import type { ReactElement } from "react";
import Link from "next/link";
import { getLotteryRegistryService } from "../../../lib/registry/registry-runtime";

export default async function RegistryLabPage(): Promise<ReactElement> {
  const entries = await getLotteryRegistryService().listAllLotteries();

  return (
    <section>
      <h1>Registry Lab</h1>
      <p>Manual verification contour for Phase 3 registry storage and ordering.</p>
      <p>
        Visible lotteries: {entries.filter((entry) => entry.enabled).length} / {entries.length}
      </p>
      <table>
        <thead>
          <tr>
            <th>Code</th>
            <th>Title</th>
            <th>Enabled</th>
            <th>Display order</th>
            <th>Form schema</th>
            <th>Field count</th>
            <th>Pricing</th>
            <th>Purchase handler</th>
            <th>Result handler</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.lotteryCode}>
              <td>{entry.lotteryCode}</td>
              <td>{entry.title}</td>
              <td>{entry.enabled ? "yes" : "no"}</td>
              <td>{entry.displayOrder}</td>
              <td>{entry.formSchemaVersion}</td>
              <td>{entry.formFields.length}</td>
              <td>
                {entry.pricing.strategy} / {entry.pricing.baseAmountMinor}
              </td>
              <td>{entry.handlers.purchaseHandler}</td>
              <td>{entry.handlers.resultHandler}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        <Link href="/">Back to shell</Link>
      </p>
    </section>
  );
}
