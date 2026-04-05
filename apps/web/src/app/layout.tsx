import { Fragment, type ReactElement, type ReactNode } from "react";
import Link from "next/link";
import { resolveCurrentAccessRole } from "../lib/access/entry-flow";

type RootLayoutProps = {
  readonly children: ReactNode;
};

export default async function RootLayout({ children }: RootLayoutProps): Promise<ReactElement> {
  const role = await resolveCurrentAccessRole();
  const navLinks = [
    { href: "/", label: "Home" },
    ...(role === "admin" ? [{ href: "/admin", label: "Admin" }] : []),
    ...(role === "user" ? [{ href: "/lottery/demo-lottery", label: "Lottery" }] : []),
    { href: "/debug/access-lab", label: "Access Lab" },
    { href: "/debug/wallet-lab", label: "Wallet Lab" },
    ...(role ? [] : [{ href: "/login", label: "Login" }])
  ];

  return (
    <html lang="en">
      <body>
        <header>
          <nav>
            {navLinks.map((link, index) => (
              <Fragment key={link.href}>
                {index > 0 ? " | " : null}
                <Link href={link.href}>{link.label}</Link>
              </Fragment>
            ))}
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
