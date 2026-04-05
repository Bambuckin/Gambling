import type { ReactElement, ReactNode } from "react";
import Link from "next/link";

type RootLayoutProps = {
  readonly children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps): ReactElement {
  return (
    <html lang="en">
      <body>
        <header>
          <nav>
            <Link href="/">Home</Link> | <Link href="/login">Login</Link>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
