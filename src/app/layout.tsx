import type { Metadata } from "next";
import Link from "next/link";
import "./layout.css";

export const metadata: Metadata = {
  title: "NextChat",
  description: "A simple Next.js chat app with live WebSocket messaging",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <nav className="navbar">
          <div className="nav-container">
            <h1 className="logo">NextChat</h1>
            <ul className="nav-links">
              <li>
                <Link href="/">Chat</Link>
              </li>
            </ul>
          </div>
        </nav>

        <main className="main-content">{children}</main>

        <footer className="footer">
          <p>NextChat built with Next.js and Socket.IO.</p>
        </footer>
      </body>
    </html>
  );
}
