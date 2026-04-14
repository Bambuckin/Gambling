import { Fragment, type ReactElement, type ReactNode } from "react";
import Link from "next/link";
import { Exo_2, Manrope } from "next/font/google";
import { resolveCurrentAccessRole } from "../lib/access/entry-flow";
import "./styles.css";

type RootLayoutProps = {
  readonly children: ReactNode;
};

const headingFont = Exo_2({
  subsets: ["latin", "cyrillic"],
  weight: ["600", "700", "800"],
  variable: "--font-heading"
});

const bodyFont = Manrope({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body"
});

export default async function RootLayout({ children }: RootLayoutProps): Promise<ReactElement> {
  const role = await resolveCurrentAccessRole();
  const navLinks = [
    { href: "/", label: "Лотереи" },
    ...(role === "admin" ? [{ href: "/admin", label: "Админ" }] : []),
    { href: "/debug/purchase-lab", label: "Очередь" },
    { href: "/debug/mock-terminal", label: "Mock terminal" },
    { href: "/debug/ticket-lab", label: "Тикеты" },
    ...(role ? [] : [{ href: "/login", label: "Вход" }])
  ];

  return (
    <html lang="ru">
      <body className={`${headingFont.variable} ${bodyFont.variable}`}>
        <div className="app-shell">
          <header className="top-bar">
            <div className="top-bar-inner">
              <Link href="/" className="brand-mark">
                <span className="brand-dot" />
                <span>National Lottery Console</span>
              </Link>
              <nav className="top-nav" aria-label="Основная навигация">
                {navLinks.map((link, index) => (
                  <Fragment key={link.href}>
                    {index > 0 ? <span className="nav-separator" /> : null}
                    <Link href={link.href} className="nav-link">
                      {link.label}
                    </Link>
                  </Fragment>
                ))}
              </nav>
            </div>
          </header>
          <main className="main-wrap">{children}</main>
        </div>
      </body>
    </html>
  );
}
