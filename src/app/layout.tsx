import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Adulting Copilot",
  description: "Privacy-first receipts, warranties & subscription killer. Your money story, local-first.",
};

const NAV = [
  { href: "/", label: "Upload" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/subscriptions", label: "Subscriptions" },
  { href: "/vault", label: "Warranty Vault" },
  { href: "/settings", label: "Settings" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div style={{ position: "relative", zIndex: 1 }}>
          <header className="flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
            <Link href="/" className="flex items-center gap-3">
              <span
                className="font-display"
                style={{
                  fontSize: 26,
                  fontWeight: 700,
                  color: "var(--gold)",
                  letterSpacing: "0.5px",
                }}
              >
                Adulting&nbsp;Copilot
              </span>
              <span className="pill">local-first</span>
            </Link>
            <nav className="flex gap-1 text-sm">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  data-testid={`nav-${n.label.toLowerCase().replace(/\s/g, "-")}`}
                  className="ghost-btn px-3 py-2"
                  style={{ textDecoration: "none" }}
                >
                  {n.label}
                </Link>
              ))}
            </nav>
          </header>
          <main className="max-w-6xl mx-auto px-6 pb-24">{children}</main>
          <footer className="max-w-6xl mx-auto px-6 py-10 text-xs" style={{ color: "var(--mist)" }}>
            Adulting Copilot stores everything locally. Not financial, legal, or medical advice.
          </footer>
        </div>
      </body>
    </html>
  );
}
