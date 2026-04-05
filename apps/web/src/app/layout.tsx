import type { ReactElement, ReactNode } from "react";
import Link from "next/link";
import { resolveCurrentAccessRole } from "../lib/access/entry-flow";

type RootLayoutProps = {
  readonly children: ReactNode;
};

export default async function RootLayout({ children }: RootLayoutProps): Promise<ReactElement> {
  const role = await resolveCurrentAccessRole();

  return (
    <html lang="en">
      <body>
        <header>
          <nav>
            <Link href="/">Home</Link>
            {" | "}
            {role === "admin" ? <Link href="/admin">Admin</Link> : null}
            {role === "user" ? <Link href="/lottery/demo-lottery">Lottery</Link> : null}
            {role ? null : <Link href="/login">Login</Link>}
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
